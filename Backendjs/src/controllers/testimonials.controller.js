const { isPublicationState } = require("../utils/contentMachine");
const { Testimonial, sequelize } = require('../models');
const FIELDS = ['name', 'role', 'company', 'avatar', 'quote', 'rating', 'position', 'status'];
const error = (status, message, field) => Object.assign(new Error(message), { status, statusCode: status, field });
const canonical = (field, value) => ['rating', 'position'].includes(field) ? Number(value ?? (field === 'rating' ? 5 : 0)) : String(value ?? '');
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'name' in body) && (typeof body.name !== 'string' || !body.name.trim())) return invalid('name', 'Add the client name.');
  if (req.method === 'POST') { if (!body.status) body.status = 'draft'; if (body.quote === undefined) body.quote = ''; }
  if ('status' in body && !isPublicationState(body.status)) return invalid('status', 'Choose Draft or Published.');
  if ('quote' in body && typeof body.quote !== 'string') return invalid('quote', 'Use text for the client quote.');
  if ('rating' in body && (body.rating == null || !Number.isInteger(Number(body.rating)) || Number(body.rating) < 1 || Number(body.rating) > 5)) return invalid('rating', 'Choose a rating from 1 to 5.');
  if ('position' in body && (!Number.isSafeInteger(Number(body.position)) || Number(body.position) < 0 || Number(body.position) > 2147483647)) return invalid('position', 'Use a non-negative whole display order.');
  if (req.method === 'POST' && body.status === 'published' && !String(body.quote || '').trim()) return invalid('quote', 'Add the client quote before publishing.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await Testimonial.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw error(404, 'Testimonial not found.');
    const expected = req.body?.expected;
    if (expected && FIELDS.some(field => Object.hasOwn(expected, field) && canonical(field, item[field]) !== canonical(field, expected[field]))) throw error(409, 'This testimonial changed while you were editing. Reload the saved version before saving.');
    const patch = Object.fromEntries(FIELDS.filter(field => Object.hasOwn(req.body, field)).map(field => [field, req.body[field]]));
    const merged = { ...item.toJSON(), ...patch };
    if (merged.status === 'published' && !String(merged.quote || '').trim()) throw error(400, 'Add the client quote before publishing.', 'quote');
    const before = item.toJSON(); await item.update(patch, { transaction }); await item.reload({ transaction }); return { item, before };
  });
}
module.exports = { validate, updateRecord, canonical };
