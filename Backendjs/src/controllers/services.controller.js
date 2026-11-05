const { Service, sequelize } = require('../models');
const { Op } = require('sequelize');
const slugify = require('slugify');
const { asyncHandler } = require('../utils/crud');
const audit = require('../utils/audit');
const FIELDS = ['title', 'slug', 'icon', 'description', 'position', 'status'];
const ICONS = ['saas', 'crm', 'cloud', 'api', 'design', 'ai'];
const fail = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
const value = (field, data) => field === 'position' ? Number(data) || 0 : String(data ?? '');
function changed(row, expected) { return FIELDS.some(field => Object.hasOwn(expected, field) && value(field, row[field]) !== value(field, expected[field])); }
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim())) return invalid('title', 'Add the service title.');
  if (req.method === 'POST' && !body.status) body.status = 'draft';
  if ('status' in body && !['draft', 'published'].includes(body.status)) return invalid('status', 'Choose Draft or Published.');
  if ('icon' in body && !ICONS.includes(body.icon)) return invalid('icon', 'Choose one of the available service icons.');
  if ('position' in body && (!Number.isSafeInteger(Number(body.position)) || Number(body.position) < 0 || Number(body.position) > 2147483647)) return invalid('position', 'Use a non-negative whole display order.');
  if (body.description != null && typeof body.description !== 'string') return invalid('description', 'Use text for the service description.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await Service.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw fail(404, 'Service not found.');
    if (req.body.expected && changed(item, req.body.expected)) throw fail(409, 'This service changed while you were editing. Reload the saved version before saving.');
    const before = item.toJSON(), patch = Object.fromEntries(FIELDS.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    if (patch.slug && patch.slug !== item.slug) {
      const base = slugify(String(patch.slug), { lower: true, strict: true }) || 'item'; let slug = base, count = 1;
      while (await Service.findOne({ where: { slug, id: { [Op.ne]: item.id } }, transaction })) slug = `${base}-${count++}`;
      patch.slug = slug;
    }
    await item.update(patch, { transaction }); await item.reload({ transaction }); return { item, before };
  });
}
const reorder = asyncHandler(async (req, res) => {
  const ids = req.body?.ids, expected = req.body?.expected;
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length || !Array.isArray(expected) || expected.length !== ids.length || expected.some(row => !row || typeof row !== "object" || !Number.isSafeInteger(row.id) || !FIELDS.every(field => Object.hasOwn(row, field)))) return res.status(400).json({ message: 'Send the complete service order and its saved records.' });
  const result = await sequelize.transaction(async transaction => {
    const rows = await Service.findAll({ order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    const byId = new Map(rows.map(row => [row.id, row])), snapshots = new Map(expected.map(row => [row.id, row]));
    if (rows.length !== ids.length || snapshots.size !== rows.length || ids.some(id => !byId.has(id)) || rows.some(row => !snapshots.has(row.id) || changed(row, snapshots.get(row.id)))) throw fail(409, 'Services changed while you were arranging them. Refresh the list before reordering.');
    const changes = [];
    for (const [position, id] of ids.entries()) {
      const row = byId.get(id);
      if (row.position !== position) { const before = row.toJSON(); await row.update({ position }, { transaction }); changes.push({ before, after: row.toJSON() }); }
    }
    return { items: ids.map(id => byId.get(id)), changes };
  });
  require('../utils/publicCache').clear();
  for (const change of result.changes) audit.record(req, { action: 'other', entity: 'service', before: change.before, after: change.after, summary: `Changed website order to ${change.after.position + 1}` });
  res.json({ items: result.items });
});
module.exports = { validate, updateRecord, reorder, changed };
