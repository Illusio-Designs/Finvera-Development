const { isPublicationState } = require("../utils/contentMachine");
const { TeamMember, sequelize } = require('../models');
const FIELDS = ['name', 'role', 'bio', 'initials', 'photo', 'socials', 'position', 'status'];
const error = (status, message, field) => Object.assign(new Error(message), { status, statusCode: status, field });
const canonical = (field, value) => field === 'position' ? Number(value ?? 0) : field === 'socials' ? JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b))) : String(value ?? '');
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'name' in body) && (typeof body.name !== 'string' || !body.name.trim())) return invalid('name', 'Add the member name.');
  if (req.method === 'POST') { if (!body.status) body.status = 'draft'; }
  if ('status' in body && !isPublicationState(body.status)) return invalid('status', 'Choose Draft or Published.');
  if ('position' in body && (!Number.isSafeInteger(Number(body.position)) || Number(body.position) < 0 || Number(body.position) > 2147483647)) return invalid('position', 'Use a non-negative whole display order.');
  for (const field of ['role', 'bio', 'initials', 'photo']) {
    if (field in body && body[field] != null && typeof body[field] !== 'string') return invalid(field, 'Use text for this profile field.');
  }
  for (const field of ['name', 'role', 'initials', 'photo']) if (typeof body[field] === 'string' && body[field].length > 255) return invalid(field, 'Use 255 characters or fewer.');
  if (body.photo && !/^https?:\/\/[^\s]+$/i.test(body.photo) && !/^\/uploads\/[^\s]+$/.test(body.photo)) return invalid('photo', 'Use an uploaded photo or an HTTP image URL.');
  if ('socials' in body && (body.socials == null || typeof body.socials !== 'object' || Array.isArray(body.socials) || Object.values(body.socials).some(value => typeof value !== 'string'))) return invalid('socials', 'Use a profile link object.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await TeamMember.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw error(404, 'Team profile not found.');
    const expected = req.body?.expected;
    if (expected && FIELDS.some(field => Object.hasOwn(expected, field) && canonical(field, item[field]) !== canonical(field, expected[field]))) throw error(409, 'This profile changed while you were editing. Reload the saved version before saving.');
    const patch = Object.fromEntries(FIELDS.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    const before = item.toJSON(); await item.update(patch, { transaction }); await item.reload({ transaction }); return { item, before };
  });
}
module.exports = { validate, updateRecord, canonical };
