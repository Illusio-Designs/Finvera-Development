const { isPublicationState } = require("../utils/contentMachine");
const { Logo, sequelize } = require('../models');
const { asyncHandler } = require('../utils/crud');
const audit = require('../utils/audit');
const FIELDS = ['name', 'image', 'position', 'status'];
const fail = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
const value = (field, data) => field === 'position' ? Number(data) || 0 : String(data ?? '');
function changed(row, expected) { return FIELDS.some(field => Object.hasOwn(expected, field) && value(field, row[field]) !== value(field, expected[field])); }
function validImage(input) {
  if (input == null || input === '') return true;
  if (typeof input !== 'string' || input.length > 255 || /\s/.test(input)) return false;
  if (/^\/uploads\/[^?#]+(?:[?#].*)?$/.test(input)) return true;
  try { const url = new URL(input); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'name' in body) && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255)) return invalid('name', 'Add a company name of 255 characters or fewer.');
  if (req.method === 'POST' && !body.status) body.status = 'draft';
  if ('status' in body && !isPublicationState(body.status)) return invalid('status', 'Choose Draft or Published.');
  if ('position' in body && (!Number.isSafeInteger(Number(body.position)) || Number(body.position) < 0 || Number(body.position) > 2147483647)) return invalid('position', 'Use a non-negative whole display order.');
  if ('image' in body && !validImage(body.image)) return invalid('image', 'Use an uploaded logo or a valid HTTP image URL of 255 characters or fewer.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await Logo.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw fail(404, 'Logo not found.');
    if (req.body.expected && changed(item, req.body.expected)) throw fail(409, 'This logo changed while you were editing. Reload the saved version before saving.');
    const before = item.toJSON(), patch = Object.fromEntries(FIELDS.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    await item.update(patch, { transaction }); await item.reload({ transaction }); return { item, before };
  });
}
const reorder = asyncHandler(async (req, res) => {
  const ids = req.body?.ids, expected = req.body?.expected;
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length || !Array.isArray(expected) || expected.length !== ids.length || expected.some(row => !row || typeof row !== "object" || !Number.isSafeInteger(row.id) || !FIELDS.every(field => Object.hasOwn(row, field)))) return res.status(400).json({ message: 'Send the complete logo order and its saved records.' });
  const result = await sequelize.transaction(async transaction => {
    const rows = await Logo.findAll({ order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    const byId = new Map(rows.map(row => [row.id, row])), snapshots = new Map(expected.map(row => [row.id, row]));
    if (rows.length !== ids.length || snapshots.size !== rows.length || ids.some(id => !byId.has(id)) || rows.some(row => !snapshots.has(row.id) || changed(row, snapshots.get(row.id)))) throw fail(409, 'Logos changed while you were arranging them. Refresh the list before reordering.');
    const changes = [];
    for (const [position, id] of ids.entries()) {
      const row = byId.get(id);
      if (row.position !== position) { const before = row.toJSON(); await row.update({ position }, { transaction }); changes.push({ before, after: row.toJSON() }); }
    }
    return { items: ids.map(id => byId.get(id)), changes };
  });
  require('../utils/publicCache').clear();
  for (const change of result.changes) audit.record(req, { action: 'other', entity: 'logo', before: change.before, after: change.after, summary: `Changed website order to ${change.after.position + 1}` });
  res.json({ items: result.items });
});
module.exports = { validate, updateRecord, reorder, changed, validImage };
