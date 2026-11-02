/* Opt-in pagination / sorting shared by the list endpoints.

   pageOf(req)  → null when neither ?page nor ?limit is given (the endpoint
                  answers exactly as before: a plain array), else
                  { page, limit, offset } — page from 1, limit 1…200 (default 50).
   sortOf(req, allowed, fallback) → a Sequelize order from ?sort=
                  "field" | "-field" | "field:desc" | "field:asc"; unknown
                  fields fall back to `fallback`.
   paged(res, { rows, count }, p) → { items, total, page, limit } */

const MAX_LIMIT = 200;

function pageOf(req, { defaultLimit = 50, maxLimit = MAX_LIMIT } = {}) {
  const q = req.query || {};
  if (q.page === undefined && q.limit === undefined) return null;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function sortOf(req, allowed, fallback) {
  const raw = String((req.query && req.query.sort) || "").trim();
  if (!raw) return fallback;
  let field = raw, dir = "ASC";
  if (raw.startsWith("-")) { field = raw.slice(1); dir = "DESC"; }
  const m = field.match(/^([A-Za-z0-9_]+)(?:[:.](asc|desc))?$/i);
  if (!m) return fallback;
  field = m[1];
  if (m[2]) dir = m[2].toUpperCase();
  if (!allowed.includes(field)) return fallback;
  return [[field, dir], ...fallback.filter(([f]) => f !== field)];
}

const paged = (res, { rows, count }, p) => res.json({ items: rows, total: Number(count) || 0, page: p.page, limit: p.limit });

module.exports = { pageOf, sortOf, paged, MAX_LIMIT };
