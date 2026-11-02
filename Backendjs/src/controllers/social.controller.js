const { Op, fn, col, literal } = require("sequelize");
const { SocialClient, SocialPost, SocialPostEvent, User, Setting } = require("../models");

/* Stage history for the performance KPIs. Never throws: a history write
   must not break saving the post itself. */
async function recordEvents(rows) {
  try { if (rows.length) await SocialPostEvent.bulkCreate(rows); } catch (e) { console.warn("post history:", e.message); }
}
const eventOf = (p, { from = null, fromAssigneeId = null, byUserId = null } = {}) => ({
  postId: p.id, client: p.client, format: p.format || null, fromStatus: from, toStatus: p.status,
  fromAssigneeId, toAssigneeId: p.assigneeId || null, byUserId, postDate: p.postDate || null, at: new Date(),
});
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

/* Brand ids → names, cached briefly per process (brands are renamed or
   removed rarely; any brand write calls forgetScopes()). */
const SCOPE_TTL_MS = 60 * 1000;
const scopeCache = new Map(); // "1,2,3" → { at, names: Promise<string[]> }
function brandNames(ids) {
  const key = [...ids].sort().join(",");
  const hit = scopeCache.get(key);
  if (hit && Date.now() - hit.at < SCOPE_TTL_MS) return hit.names;
  const names = SocialClient.findAll({ attributes: ["name"], where: { id: ids }, order: [["id", "ASC"]], raw: true }).then((rows) => rows.map((c) => c.name));
  if (scopeCache.size > 200) scopeCache.clear();
  scopeCache.set(key, { at: Date.now(), names });
  names.catch(() => { if (scopeCache.get(key)?.names === names) scopeCache.delete(key); });
  return names;
}
function forgetScopes() { scopeCache.clear(); }

/* Attach req.socialScope: a Set of allowed client names, or null (all).
   Non-admins see every post of their allotted brands, but may change only
   the posts assigned to them. The user row comes from requireAuth (no
   second read). */
const withScope = asyncHandler(async (req, _res, next) => {
  const { loadUser } = require("../middleware/auth");
  const ids = brandIdsOf(req.userRow || await loadUser(req.user.id));
  req.socialScope = !ids ? null : new Set(ids.length ? await brandNames(ids) : []);
  next();
});

/* The post named in the URL, loaded once per request and shared by the
   guards, the deadline / assignment steps and the update itself. */
function postOf(req) {
  if (!req._post) req._post = SocialPost.findByPk(req.params.id);
  return req._post;
}

/* Who was picked for a role on this post (people choose; nothing is automatic). */
const teamOf = (p) => { const t = p && p.team; if (t && typeof t === "object") return t; try { return JSON.parse(t || "{}") || {}; } catch { return {}; } };
const pickedFor = (p, role) => { const id = Number(teamOf(p)[role]); return Number.isFinite(id) && id > 0 ? id : null; };

/* Someone picked for a brand's post gets that brand in their access list,
   so they can see and work on it. Admins see every brand already. */
async function grantBrand(userIds, client) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map(Number).filter((x) => x > 0))];
  if (!ids.length || !client) return;
  const brand = await SocialClient.findOne({ where: { name: client } });
  if (!brand) return;
  for (const u of await User.findAll({ where: { id: ids } })) {
    const have = brandIdsOf(u);
    if (have === null || have.includes(String(brand.id))) continue;
    await u.update({ socialClients: [...have, String(brand.id)] });
    require("../middleware/auth").forgetUser(u.id);
  }
}

const allowed = (req, client) => !req.socialScope || req.socialScope.has(client);
const isMine = (req, post) => !req.socialScope || Number(post.assigneeId) === Number(req.user.id);
const DENIED = { message: "You can only work on the brands assigned to you." };
const NOT_YOURS = { message: "This post is assigned to someone else — only they or an admin can delete it." };

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

/* An existing post must be in an allowed brand; changing it (anything but
   reading) also needs it to be assigned to the caller. It may not move out
   of the brand. */
const guardPost = asyncHandler(async (req, res, next) => {
  if (!req.socialScope) return next();
  const post = await postOf(req);
  if (!post || !allowed(req, post.client)) return res.status(404).json({ message: "SocialPost not found." });
  // Anyone with the brand may edit any of its posts; deleting stays with the
  // person the post is assigned to (or an admin).
  if (req.method === "DELETE" && !isMine(req, post)) return res.status(403).json(NOT_YOURS);
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
/* GET /social-posts. With no query params it behaves exactly as before
   (every column of every post the caller may see). Optional params:
     ?fields=card              → leave out the heavy text/JSON fields (CARD_OMIT)
     ?from=YYYY-MM-DD&to=…     → postDate inside the window, PLUS every post
                                 with no postDate and every post not yet
                                 'posted' (so overdue work never drops out)
     ?mine=1                   → only posts assigned to the caller
   Brand scoping (req.socialScope) applies either way. Maintenance sweeps no
   longer run here — see maintenance() (boot + timer + /cron/tick).
   Rows are read raw (no model instances): same JSON, a fraction of the CPU
   on thousands of posts. */
const CARD_OMIT = ["caption", "requirements", "remarks", "reference", "tags", "keywords", "timeLog", "poc", "driveLink", "estimateHours"];
const POST_ORDER = [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]];
const POST_SEARCH = ["client", "theme", "topic", "caption", "festive"];
const POST_BOOLS = ["keywordHashtags"];
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
/* Raw rows carry TINYINT booleans as 0/1 — match what model instances return. */
const fixBools = (rows) => { for (const r of rows) for (const k of POST_BOOLS) if (k in r && r[k] != null) r[k] = !!r[k]; return rows; };
const listPosts = () => asyncHandler(async (req, res) => {
  const card = req.query.fields === "card";
  const from = isDay(req.query.from) ? req.query.from : null;
  const to = isDay(req.query.to) ? req.query.to : null;
  const mine = req.query.mine === "1" || req.query.mine === "true";
  if (req.socialScope && !req.socialScope.size) return res.json([]);
  const and = [];
  if (req.socialScope) and.push({ client: [...req.socialScope] });
  if (mine) and.push({ assigneeId: req.user.id });
  if (from || to) {
    const range = {};
    if (from) range[Op.gte] = from;
    if (to) range[Op.lte] = to;
    and.push({ [Op.or]: [{ postDate: range }, { postDate: null }, { status: { [Op.ne]: "posted" } }] });
  }
  // Same ?q= search the default (admin) list supports.
  if (!req.socialScope && req.query.q) and.push({ [Op.or]: POST_SEARCH.map((f) => ({ [f]: { [Op.like]: `%${req.query.q}%` } })) });
  const items = await SocialPost.findAll({
    where: and.length ? { [Op.and]: and } : {},
    ...(card ? { attributes: { exclude: CARD_OMIT } } : {}),
    order: POST_ORDER,
    raw: true,
  });
  res.json(fixBools(items));
});

/* ── Stage-based assignment ─────────────────────────────
   Every post (post, carousel, reel) passes through the same four people:
     Planned                     → Marketer (plans it)
     In production, step graphic → Graphic designer (designs)
     In production, step video   → Video editor (edits)
     Pending approval            → an admin approves it (or sends it back)
     Ready to post, Posted       → Social media (it's scheduled and posted)
   Each person clicks Done and it goes to the next one automatically. */
const STEPS = ["marketer", "graphic", "video", "social"];
function stageRole(status, format, step) {
  if (status === "ready" || status === "posted") return "social";
  if (status === "approval") return "admin";
  if (status === "production") return step === "video" ? "video" : "graphic";
  return "marketer";
}
/* The step a post is on inside In production. */
const stepFor = (status, step) => (status === "production" ? (step === "video" ? "video" : "graphic") : null);

/* Least-loaded active user holding `role` who can see `client`, or null.
   `ctx` caches users / brand ids / open-post counts across a bulk import. */
async function pickAssignee(role, client, ctx, exceptId = null) {
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
    if (!rolesOf(u).includes(role) || u.id === exceptId) return false;
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
  const post = await postOf(req);
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
  b.step = stepFor(b.status || "planned", b.step);
  // No automatic pick: the person chosen, or whoever the post's team has for this step.
  if (!b.assigneeId && b.client) b.assigneeId = pickedFor(b, stageRole(b.status || "planned", b.format, b.step));
  next();
});

/* Stage changed → hand the post to the role for the new stage. Skipped when
   the same save picks an assignee by hand, or the current assignee already
   holds the new stage's role (e.g. Planned → In production stays put).
   Ready to post is the exception: it always goes to a DIFFERENT person than
   the one who made it (a second pair of eyes before posting) — the maker
   keeps it only when no other Social media person has the brand. */
const assignOnStageChange = asyncHandler(async (req, _res, next) => {
  const b = req.body || {};
  if (b.status === undefined && b.step === undefined) return next();
  const post = await postOf(req);
  if (!post) return next();
  const status = b.status !== undefined ? b.status : post.status;
  // Entering In production starts at the design step; any other stage has no step.
  b.step = stepFor(status, b.step !== undefined ? b.step : (status === post.status ? post.step : null));
  if (status === post.status && (b.step || null) === (post.step || null)) return next();
  if (b.assigneeId !== undefined && Number(b.assigneeId || 0) !== Number(post.assigneeId || 0)) return next();
  if (status === "posted") return next(); // whoever posted it keeps it
  // No automatic pick: the person the post's team has for the new step, else unassigned until someone is chosen.
  const role = stageRole(status, b.format !== undefined ? b.format : post.format, b.step);
  const team = b.team !== undefined ? b.team : post.team;
  b.assigneeId = pickedFor({ team }, role);
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
  // Only fills a post from the people picked for it (its team); never picks anyone by itself.
  const posts = await SocialPost.findAll({ where: { assigneeId: null, team: { [Op.ne]: null } }, order: [["postDate", "ASC"]] });
  if (!posts.length) return;
  const gained = {};
  for (const p of posts) {
    const who = pickedFor(p, stageRole(p.status, p.format, p.step));
    if (!who) continue;
    await p.update({ assigneeId: who });
    if (p.status !== "posted") (gained[who] = gained[who] || []).push(p);
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
  const before = { status: p.status, assigneeId: p.assigneeId };
  await p.update({ status: "planned", assigneeId: who, dueDate: p.dueDate || weekBefore(p.postDate) });
  if (before.status !== "planned") await recordEvents([eventOf(p, { from: before.status, fromAssigneeId: before.assigneeId })]);
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

/* Background upkeep that used to run on every post-list read: the one-time
   uploaded→Planned fix and the unassigned-post sweep (+ default deadlines).
   Runs once at boot, every 5 minutes, and from /api/cron/tick. Never throws. */
async function maintenance({ force = false } = {}) {
  try { await moveUploadedToPlannedOnce(); } catch (e) { console.warn("uploaded→Planned fix:", e.message); }
  try { await assignUnassigned({ force }); } catch (e) { console.warn("assignUnassigned:", e.message); }
}

/* ── Sheet uploads ──────────────────────────────────────
   Re-uploading a sheet updates matching posts instead of duplicating them.
   A row matches an existing post of the same brand by go-live date + post
   theme (case and spacing ignored). Matches get the sheet's content fields
   refreshed and keep their stage, assignee and time log; other rows are
   added (Planned, assigned to their maker). Every upload is a batch, so an
   admin can review or delete it later. */
const SHEET_FIELDS = ["festive", "topic", "format", "requirements", "reference", "dataStatus", "poc", "caption",
  "driveLink", "tags", "keywords", "channels", "remarks", "team"];
const matchKey = (r) => `${String(r.postDate || "").slice(0, 10)}|${String(r.theme || "").trim().toLowerCase().replace(/\s+/g, " ")}`;

async function importRows(rows) {
  const batch = `up-${Date.now()}`;
  const toCreate = [];
  const fixCtx = {};
  let updated = 0;
  const updatedBy = {};
  for (const client of [...new Set(rows.map((r) => r.client))]) {
    const existing = await SocialPost.findAll({ where: { client } });
    const byKey = new Map();
    for (const p of existing) { const k = matchKey(p); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); }
    for (const row of rows.filter((x) => x.client === client)) {
      const { altTheme, ...r } = row;
      let hit = (byKey.get(matchKey(r)) || []).shift(); // each existing post matches at most one row
      // The same sheet uploaded before under another title (e.g. its "Content
      // Theme" column, before Post Topic became the title): update that post
      // and give it the new title instead of adding a duplicate.
      if (!hit && altTheme) {
        const list = byKey.get(matchKey({ postDate: r.postDate, theme: altTheme })) || [];
        const i = list.findIndex((p) => p.importBatch);
        if (i >= 0) { hit = list.splice(i, 1)[0]; await hit.update({ theme: r.theme }); }
      }
      // An uploaded sheet is a plan: new rows always start in Planned.
      if (!hit) { toCreate.push({ ...r, status: "planned", assigneeId: null, dueDate: r.dueDate || weekBefore(r.postDate), importBatch: batch }); continue; }
      const patch = { importBatch: batch };
      for (const f of SHEET_FIELDS) if (r[f] !== undefined && r[f] !== null && r[f] !== "") patch[f] = r[f];
      await hit.update(patch);
      if (hit.status === "posted" && !isLive(hit)) await backToPlanned(hit, fixCtx);
      updated++;
      updatedBy[client] = (updatedBy[client] || 0) + 1;
    }
  }
  await assignRows(toCreate);
  const made = await SocialPost.bulkCreate(toCreate);
  await recordEvents(made.filter((p) => p.id).map((p) => eventOf(p)));
  const createdBy = {};
  for (const r of toCreate) createdBy[r.client] = (createdBy[r.client] || 0) + 1;
  return { created: toCreate.length, updated, batch, createdBy, updatedBy };
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
  // The person picked for the first step at upload (no automatic pick).
  for (const r of rows) if (!r.assigneeId) r.assigneeId = pickedFor(r, stageRole(r.status || "planned", r.format, r.step));
  for (const client of [...new Set(rows.map((r) => r.client))]) {
    const ids = rows.filter((r) => r.client === client).flatMap((r) => Object.values(teamOf(r)));
    await grantBrand(ids, client);
  }
}

module.exports = { postOf, forgetScopes, brandNames, maintenance, recordEvents, eventOf, brandIdsOf, withScope, requireAllBrands, guardBody, guardPost, listClients, listPosts,
  stageRole, STEPS, grantBrand, teamOf, assignOnCreate, assignOnStageChange, assignRows, assignUnassigned, importRows, listUploads, deleteUpload, deleteBrandPosts, deadlineDefaults };
