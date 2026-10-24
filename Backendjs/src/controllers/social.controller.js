const { Op, fn, col, literal } = require("sequelize");
const { SocialClient, SocialPost, User, Setting } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesOf } = require("../utils/permissions");
const { notifyUsers } = require("../utils/notify");

/* JSON arrays can come back as strings on some MySQL setups — coerce. */
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

/* Brand (SocialClient) ids a user may work on, as strings — or null for
   every brand (admins only). Access is deny-by-default: a non-admin with no
   brands ticked by an admin sees no brands at all. */
function brandIdsOf(user) {
  if (user && rolesOf(user).includes("admin")) return null;
  return user ? asArr(user.socialClients).map(String).filter(Boolean) : [];
}

/* Attach req.socialScope: a Set of allowed client names, or null (all).
   Non-admins (any non-null scope) also see only posts assigned to them. */
const withScope = asyncHandler(async (req, _res, next) => {
  const ids = brandIdsOf(await User.findByPk(req.user.id));
  req.socialScope = !ids ? null
    : new Set(ids.length ? (await SocialClient.findAll({ where: { id: ids } })).map((c) => c.name) : []);
  next();
});

const allowed = (req, client) => !req.socialScope || req.socialScope.has(client);
const isMine = (req, post) => !req.socialScope || Number(post.assigneeId) === Number(req.user.id);
const DENIED = { message: "You can only work on the brands assigned to you." };

/* Adding, renaming or removing brands is for admins only. */
function requireAllBrands(req, res, next) {
  if (req.socialScope) return res.status(403).json(DENIED);
  next();
}

/* A new post (or bulk rows) must belong to an allowed brand. */
function guardBody(req, res, next) {
  const rows = Array.isArray(req.body?.posts) ? req.body.posts : [req.body || {}];
  if (rows.some((r) => !allowed(req, r.client))) return res.status(403).json(DENIED);
  next();
}

/* An existing post must be in an allowed brand and (for non-admins) assigned
   to the caller, and may not move out of the brand. */
const guardPost = asyncHandler(async (req, res, next) => {
  if (!req.socialScope) return next();
  const post = await SocialPost.findByPk(req.params.id);
  if (!post || !allowed(req, post.client) || !isMine(req, post)) return res.status(404).json({ message: "SocialPost not found." });
  if (req.body?.client !== undefined && !allowed(req, req.body.client)) return res.status(403).json(DENIED);
  next();
});

/* Scoped list handlers; unrestricted users fall through to the crud list. */
const listClients = (crudList) => asyncHandler(async (req, res, next) => {
  if (!req.socialScope) return crudList(req, res, next);
  if (!req.socialScope.size) return res.json([]);
  const items = await SocialClient.findAll({ where: { name: [...req.socialScope] }, order: [["position", "ASC"], ["name", "ASC"]] });
  res.json(items);
});
const listPosts = (crudList) => asyncHandler(async (req, res, next) => {
  try { await moveUploadedToPlannedOnce(); } catch (e) { console.warn("uploaded→Planned fix:", e.message); }
  try { await assignUnassigned(); } catch (e) { console.warn("assignUnassigned:", e.message); }
  if (!req.socialScope) return crudList(req, res, next);
  if (!req.socialScope.size) return res.json([]);
  const items = await SocialPost.findAll({ where: { client: [...req.socialScope], assigneeId: req.user.id }, order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]] });
  res.json(items);
});

/* ── Stage-based assignment ─────────────────────────────
   Who works on a post at each stage:
     reels / videos  — Planned, Need from client → Marketer (plans, shoots)
                       In production → Video editor (edits)
     posts / carousels / stories → Graphic designer
     Ready to post, Posted → Social media (posts it). */
function stageRole(status, format) {
  if (status === "ready" || status === "posted") return "social";
  if (!/reel|video|influencer/i.test(format || "")) return "graphic";
  return status === "production" ? "video" : "marketer";
}

/* Least-loaded active user holding `role` who can see `client`, or null.
   `ctx` caches users / brand ids / open-post counts across a bulk import. */
async function pickAssignee(role, client, ctx) {
  if (!ctx.users) ctx.users = await User.findAll({ where: { active: true } });
  if (!ctx.brandId) ctx.brandId = {};
  if (!(client in ctx.brandId)) {
    const c = await SocialClient.findOne({ where: { name: client } });
    ctx.brandId[client] = c ? String(c.id) : null;
  }
  if (!ctx.load) {
    const rows = await SocialPost.findAll({
      attributes: ["assigneeId", [fn("COUNT", col("id")), "n"]],
      where: { status: { [Op.ne]: "posted" }, assigneeId: { [Op.ne]: null } },
      group: ["assigneeId"], raw: true,
    });
    ctx.load = Object.fromEntries(rows.map((r) => [r.assigneeId, Number(r.n)]));
  }
  const bid = ctx.brandId[client];
  const eligible = ctx.users.filter((u) => {
    if (!rolesOf(u).includes(role)) return false;
    const ids = brandIdsOf(u);
    return ids === null || (bid !== null && ids.includes(bid));
  });
  eligible.sort((a, b) => (ctx.load[a.id] || 0) - (ctx.load[b.id] || 0) || a.id - b.id);
  return eligible.length ? eligible[0].id : null;
}

/* ── Start-work date (stored in dueDate) ────────────────
   Work starts one week before the go-live date: post on 2 Nov → start 26 Oct. */
const DEADLINE_DAYS = 7;
function weekBefore(postDate) {
  const m = String(postDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - DEADLINE_DAYS));
  return d.toISOString().slice(0, 10);
}
const day = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

/* Create: no start date given → a week before the post date. Update: same
   when the post has none; and when the post date moves, an automatic start
   date (exactly a week before the old date) moves with it. A start date
   someone set by hand is never touched. */
const deadlineDefaults = asyncHandler(async (req, _res, next) => {
  const b = req.body || {};
  if (!req.params.id) {
    if (!b.dueDate && b.postDate) b.dueDate = weekBefore(b.postDate);
    return next();
  }
  const post = await SocialPost.findByPk(req.params.id);
  if (!post) return next();
  const oldDate = day(post.postDate), oldDue = day(post.dueDate);
  const newDate = b.postDate !== undefined ? day(b.postDate) : oldDate;
  const dueTouched = b.dueDate !== undefined && day(b.dueDate) !== oldDue;
  if (dueTouched) { if (!b.dueDate && newDate) b.dueDate = weekBefore(newDate); return next(); }
  if (!oldDue && newDate) b.dueDate = weekBefore(newDate);
  else if (newDate !== oldDate && oldDue && oldDue === weekBefore(oldDate)) b.dueDate = weekBefore(newDate);
  next();
});

/* Posts with a go-live date but no start date (created before it defaulted). */
async function fillDeadlines() {
  await SocialPost.update(
    { dueDate: literal(`DATE_SUB(postDate, INTERVAL ${DEADLINE_DAYS} DAY)`) },
    { where: { dueDate: null, postDate: { [Op.ne]: null } } },
  );
}

/* New post with nobody picked → assign by its stage + format. */
const assignOnCreate = asyncHandler(async (req, _res, next) => {
  const b = req.body || {};
  if (!b.assigneeId && b.client) b.assigneeId = await pickAssignee(stageRole(b.status || "planned", b.format), b.client, {});
  next();
});

/* Stage changed → hand the post to the role for the new stage. Skipped when
   the same save picks an assignee by hand, or the current assignee already
   holds the new stage's role (e.g. Planned → In production stays put). */
const assignOnStageChange = asyncHandler(async (req, _res, next) => {
  const b = req.body || {};
  if (b.status === undefined) return next();
  const post = await SocialPost.findByPk(req.params.id);
  if (!post || b.status === post.status) return next();
  if (b.assigneeId !== undefined && Number(b.assigneeId || 0) !== Number(post.assigneeId || 0)) return next();
  const role = stageRole(b.status, b.format !== undefined ? b.format : post.format);
  const current = post.assigneeId ? await User.findByPk(post.assigneeId) : null;
  if (current && current.active && rolesOf(current).includes(role)) return next();
  const who = await pickAssignee(role, b.client !== undefined ? b.client : post.client, {});
  if (who) b.assigneeId = who;
  next();
});

/* Give every unassigned post to the person its stage + brand calls for —
   posts created before auto-assignment existed, or ones nobody could take at
   the time (role / brand not set up yet). Each new assignee gets a single
   summary notification. Throttled to once a minute unless forced (after an
   admin changes someone's roles or brands). */
let lastSweep = 0;
async function assignUnassigned({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < 60000) return;
  lastSweep = Date.now();
  try { await fillDeadlines(); } catch (e) { console.warn("fillDeadlines:", e.message); }
  const posts = await SocialPost.findAll({ where: { assigneeId: null }, order: [["postDate", "ASC"]] });
  if (!posts.length) return;
  const ctx = {}, gained = {};
  for (const p of posts) {
    const who = await pickAssignee(stageRole(p.status, p.format), p.client, ctx);
    if (!who) continue;
    await p.update({ assigneeId: who });
    if (p.status !== "posted") { ctx.load[who] = (ctx.load[who] || 0) + 1; (gained[who] = gained[who] || []).push(p); }
  }
  for (const [uid, ps] of Object.entries(gained)) {
    await notifyUsers([Number(uid)], {
      type: "assigned",
      title: ps.length === 1 ? `Social post assigned to you: ${ps[0].theme}` : `${ps.length} social posts assigned to you`,
      link: "/dashboard/social",
    });
  }
}

/* A post is really live only with a real post link (http…) in its channel
   links AND a go-live date that has arrived. Sheet text like "Instagram,
   Facebook" or a future date means it was planned, not published. */
const todayStr = () => new Date().toISOString().slice(0, 10);
const isLive = (p) => /https?:\/\//i.test(p.channels || "") && !!p.postDate && day(p.postDate) <= todayStr();

/* Move a wrongly-Posted post back to Planned, to its maker. */
async function backToPlanned(p, ctx) {
  const who = await pickAssignee(stageRole("planned", p.format), p.client, ctx);
  await p.update({ status: "planned", assigneeId: who, dueDate: p.dueDate || weekBefore(p.postDate) });
  if (who) ctx.load[who] = (ctx.load[who] || 0) + 1;
}

/* One-time fix for sheets uploaded while uploads went to Posted: every
   Posted post that isn't really live goes back to Planned and to its maker.
   (v2: v1 only caught posts with empty channel links.) Recorded in settings
   so it runs once — posts the team marks Posted later are untouched. */
const UPLOAD_FIX_KEY = "social.uploadedToPlanned.v2";
let uploadFixDone = false;
async function moveUploadedToPlannedOnce() {
  if (uploadFixDone) return;
  const [flag, created] = await Setting.findOrCreate({ where: { key: UPLOAD_FIX_KEY }, defaults: { value: "running", group: "system", isPublic: false } });
  if (!created) { uploadFixDone = true; return; }
  const posts = (await SocialPost.findAll({ where: { status: "posted" } })).filter((p) => !isLive(p));
  const ctx = {};
  for (const p of posts) await backToPlanned(p, ctx);
  await flag.update({ value: `done ${new Date().toISOString()} (${posts.length} posts)` });
  uploadFixDone = true;
  if (posts.length) console.log(`✔ Moved ${posts.length} not-yet-live social posts back to Planned`);
}

/* ── Sheet uploads ──────────────────────────────────────
   Re-uploading a sheet updates matching posts instead of duplicating them.
   A row matches an existing post of the same brand by go-live date + post
   theme (case and spacing ignored). Matches get the sheet's content fields
   refreshed and keep their stage, assignee and time log; other rows are
   added (Planned, assigned to their maker). Every upload is a batch, so an
   admin can review or delete it later. */
const SHEET_FIELDS = ["festive", "topic", "format", "requirements", "reference", "dataStatus", "poc", "caption",
  "driveLink", "tags", "keywords", "channels", "remarks"];
const matchKey = (r) => `${String(r.postDate || "").slice(0, 10)}|${String(r.theme || "").trim().toLowerCase().replace(/\s+/g, " ")}`;

async function importRows(rows) {
  const batch = `up-${Date.now()}`;
  const toCreate = [];
  const fixCtx = {};
  let updated = 0;
  for (const client of [...new Set(rows.map((r) => r.client))]) {
    const existing = await SocialPost.findAll({ where: { client } });
    const byKey = new Map();
    for (const p of existing) { const k = matchKey(p); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); }
    for (const r of rows.filter((x) => x.client === client)) {
      const hit = (byKey.get(matchKey(r)) || []).shift(); // each existing post matches at most one row
      // An uploaded sheet is a plan: new rows always start in Planned.
      if (!hit) { toCreate.push({ ...r, status: "planned", assigneeId: null, dueDate: r.dueDate || weekBefore(r.postDate), importBatch: batch }); continue; }
      const patch = { importBatch: batch };
      for (const f of SHEET_FIELDS) if (r[f] !== undefined && r[f] !== null && r[f] !== "") patch[f] = r[f];
      await hit.update(patch);
      if (hit.status === "posted" && !isLive(hit)) await backToPlanned(hit, fixCtx);
      updated++;
    }
  }
  await assignRows(toCreate);
  await SocialPost.bulkCreate(toCreate);
  return { created: toCreate.length, updated, batch };
}

/* Admin: uploads (batches) with their brand, size and date range. */
const listUploads = asyncHandler(async (_req, res) => {
  const rows = await SocialPost.findAll({
    attributes: ["importBatch", "client", [fn("COUNT", col("id")), "posts"], [fn("MIN", col("postDate")), "from"], [fn("MAX", col("postDate")), "to"]],
    where: { importBatch: { [Op.ne]: null } }, group: ["importBatch", "client"], raw: true,
  });
  res.json(rows
    .map((r) => ({ ...r, posts: Number(r.posts), uploadedAt: new Date(Number(String(r.importBatch).replace("up-", "")) || 0).toISOString() }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
});

/* Admin: delete one upload's posts. */
const deleteUpload = asyncHandler(async (req, res) => {
  const n = await SocialPost.destroy({ where: { importBatch: req.params.batch } });
  res.json({ deleted: n });
});

/* Admin: delete every post of one brand (older uploads have no batch). */
const deleteBrandPosts = asyncHandler(async (req, res) => {
  const client = String(req.body?.client || "");
  if (!client) return res.status(400).json({ message: "Choose a brand." });
  const n = await SocialPost.destroy({ where: { client } });
  res.json({ deleted: n });
});

/* Bulk import: fill assignees row by row, keeping the load balance honest. */
async function assignRows(rows) {
  const ctx = {};
  for (const r of rows) {
    if (r.assigneeId) continue;
    r.assigneeId = await pickAssignee(stageRole(r.status || "planned", r.format), r.client, ctx);
    if (r.assigneeId && r.status !== "posted") ctx.load[r.assigneeId] = (ctx.load[r.assigneeId] || 0) + 1;
  }
}

module.exports = { brandIdsOf, withScope, requireAllBrands, guardBody, guardPost, listClients, listPosts,
  stageRole, assignOnCreate, assignOnStageChange, assignRows, assignUnassigned, importRows, listUploads, deleteUpload, deleteBrandPosts, deadlineDefaults };
