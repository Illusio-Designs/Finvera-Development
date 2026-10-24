const { Op, fn, col } = require("sequelize");
const { SocialClient, SocialPost, User } = require("../models");
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
  try { await assignUnassigned(); } catch (e) { console.warn("assignUnassigned:", e.message); }
  if (!req.socialScope) return crudList(req, res, next);
  if (!req.socialScope.size) return res.json([]);
  const items = await SocialPost.findAll({ where: { client: [...req.socialScope], assigneeId: req.user.id }, order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]] });
  res.json(items);
});

/* ── Stage-based assignment ─────────────────────────────
   Who works on a post at each stage: reels / videos → Marketer, posts /
   carousels / stories → Graphic designer; from Ready to post on, the
   Social media role posts it. */
function stageRole(status, format) {
  if (status === "ready" || status === "posted") return "social";
  return /reel|video|influencer/i.test(format || "") ? "marketer" : "graphic";
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

/* Admin catch-up: every open post whose go-live date has passed (optionally
   for one brand) → Posted, handed to that brand's Social media person. */
const markPastPosted = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const where = { status: { [Op.ne]: "posted" }, postDate: { [Op.lt]: today } };
  if (req.body?.client) where.client = req.body.client;
  const posts = await SocialPost.findAll({ where });
  const ctx = {};
  for (const p of posts) {
    const who = await pickAssignee("social", p.client, ctx);
    await p.update({ status: "posted", ...(who ? { assigneeId: who } : {}) });
  }
  res.json({ updated: posts.length });
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
  stageRole, assignOnCreate, assignOnStageChange, assignRows, assignUnassigned, markPastPosted };
