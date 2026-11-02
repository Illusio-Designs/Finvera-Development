/* Activity history (audit log) — read side.

   GET /api/activity            admin only
     ?entity=lead | lead,renewal | content-section (every site-content type)
     &entityId= &userId= &action=create|update|delete|other
     &from=YYYY-MM-DD &to=YYYY-MM-DD (India time, inclusive) &q= (item name, user, summary)
     &page=1 &limit=50 (max 200)
     → { items: [row], total, page, limit }   newest first
   GET /api/activity/:entity/:id   anyone who can open that kind of item
     → [row] newest first (max 200); with ?page/&limit → { items, total, page, limit }
   row = { id, userId, userName, action, entity, entityId, entityLabel, summary,
           changes: { field: [old, new] } | null, ip, createdAt } */

const { Op } = require("sequelize");
const { ActivityLog, SocialPost, SocialClient } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesCan } = require("../utils/permissions");
const { pageOf } = require("../utils/paginate");

const CONTENT = ["project", "service", "testimonial", "team-member", "blog", "page", "faq", "value", "brand", "milestone", "process-step", "stat", "logo", "feature"];
/* Which permission area may read an entity's history ("admin" = admins only). */
const AREA = {
  lead: "leads", renewal: "renewals", task: "board", board: "board",
  "social-post": "social", "social-client": "social", contact: "contact",
  seo: "seo", setting: "settings", user: "admin",
  ...Object.fromEntries(CONTENT.map((e) => [e, "content"])),
};
const ENTITIES = Object.keys(AREA);
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const istStart = (iso) => new Date(`${iso}T00:00:00+05:30`);

function entityList(v) {
  const out = new Set();
  for (const e of String(v || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (e === "content-section" || e === "content") CONTENT.forEach((c) => out.add(c));
    else out.add(e);
  }
  return [...out];
}

function whereOf(q) {
  const where = {};
  const ents = entityList(q.entity);
  if (ents.length) where.entity = ents.length === 1 ? ents[0] : { [Op.in]: ents };
  if (q.entityId) where.entityId = String(q.entityId);
  if (q.userId && /^\d+$/.test(String(q.userId))) where.userId = Number(q.userId);
  if (q.action && ["create", "update", "delete", "other"].includes(q.action)) where.action = q.action;
  const range = {};
  if (isDay(q.from)) range[Op.gte] = istStart(q.from);
  if (isDay(q.to)) range[Op.lt] = new Date(istStart(q.to).getTime() + 86400000);
  if (Object.getOwnPropertySymbols(range).length) where.createdAt = range;
  if (q.q) {
    const like = { [Op.like]: `%${String(q.q).slice(0, 100)}%` };
    where[Op.or] = [{ entityLabel: like }, { userName: like }, { summary: like }];
  }
  return where;
}
const ORDER = [["createdAt", "DESC"], ["id", "DESC"]];

const list = asyncHandler(async (req, res) => {
  const p = pageOf(req) || { page: 1, limit: 50, offset: 0 };
  const { rows, count } = await ActivityLog.findAndCountAll({ where: whereOf(req.query), order: ORDER, limit: p.limit, offset: p.offset, raw: true });
  res.json({ items: rows.map(fix), total: count, page: p.page, limit: p.limit });
});

/* Raw rows can carry JSON as text on some MySQL setups. */
function fix(r) {
  if (typeof r.changes === "string") { try { r.changes = JSON.parse(r.changes); } catch { /* keep */ } }
  return r;
}

/* May this user read the history of this item? Social items also respect
   the caller's brands. */
async function canRead(req, entity, id) {
  const roles = (req.user && req.user.roles) || [];
  const area = AREA[entity];
  if (!area) return false;
  if (roles.includes("admin")) return true;
  if (area === "admin" || !rolesCan(roles, area)) return false;
  if (area !== "social") return true;
  const social = require("./social.controller");
  const ids = social.brandIdsOf(req.userRow || req.user);
  if (!ids) return true;
  const names = new Set(ids.length ? await social.brandNames(ids) : []);
  if (entity === "social-post") {
    const p = await SocialPost.findByPk(id, { attributes: ["client"], raw: true });
    return !!p && names.has(p.client);
  }
  const c = await SocialClient.findByPk(id, { attributes: ["name"], raw: true });
  return !!c && names.has(c.name);
}

const forItem = asyncHandler(async (req, res) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  if (!AREA[entity]) return res.status(404).json({ message: `Unknown entity. Use one of: ${ENTITIES.join(", ")}.` });
  if (!(await canRead(req, entity, id))) return res.status(403).json({ message: "You do not have permission to do that." });
  const where = { entity, entityId: id };
  const p = pageOf(req);
  if (p) {
    const { rows, count } = await ActivityLog.findAndCountAll({ where, order: ORDER, limit: p.limit, offset: p.offset, raw: true });
    return res.json({ items: rows.map(fix), total: count, page: p.page, limit: p.limit });
  }
  res.json((await ActivityLog.findAll({ where, order: ORDER, limit: 200, raw: true })).map(fix));
});

module.exports = { list, forItem, whereOf, fix, ENTITIES, CONTENT, AREA };
