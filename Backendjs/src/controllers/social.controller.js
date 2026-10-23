const { SocialClient, SocialPost, User } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesOf } = require("../utils/permissions");

/* JSON arrays can come back as strings on some MySQL setups — coerce. */
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

/* Brand (SocialClient) ids a user may work on, as strings — or null for
   every brand (admins only). Access is deny-by-default: a non-admin with no
   brands ticked by an admin sees no brands at all. */
function brandIdsOf(user) {
  if (user && rolesOf(user).includes("admin")) return null;
  return user ? asArr(user.socialClients).map(String).filter(Boolean) : [];
}

/* Attach req.socialScope: a Set of allowed client names, or null (all). */
const withScope = asyncHandler(async (req, _res, next) => {
  const ids = brandIdsOf(await User.findByPk(req.user.id));
  req.socialScope = !ids ? null
    : new Set(ids.length ? (await SocialClient.findAll({ where: { id: ids } })).map((c) => c.name) : []);
  next();
});

const allowed = (req, client) => !req.socialScope || req.socialScope.has(client);
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

/* An existing post must be in an allowed brand, and may not move out of it. */
const guardPost = asyncHandler(async (req, res, next) => {
  if (!req.socialScope) return next();
  const post = await SocialPost.findByPk(req.params.id);
  if (!post || !allowed(req, post.client)) return res.status(404).json({ message: "SocialPost not found." });
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
  if (!req.socialScope) return crudList(req, res, next);
  if (!req.socialScope.size) return res.json([]);
  const items = await SocialPost.findAll({ where: { client: [...req.socialScope] }, order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]] });
  res.json(items);
});

module.exports = { brandIdsOf, withScope, requireAllBrands, guardBody, guardPost, listClients, listPosts };
