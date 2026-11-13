const { isPublicationState } = require("../utils/contentMachine");
const { Op } = require('sequelize');
const slugify = require('slugify');
const { Project, sequelize } = require('../models');
const FIELDS = Object.keys(Project.rawAttributes).filter(key => !['id', 'createdAt', 'updatedAt'].includes(key));
const ARRAYS = ['tags', 'results', 'tech', 'gallery'];
function canonical(key, value) {
  if (ARRAYS.includes(key)) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = value.split(',').map(part => part.trim()).filter(Boolean); } }
    return JSON.stringify(value || []);
  }
  if (key === 'featured') return !!value;
  if (key === 'position') return Number(value) || 0;
  return value == null ? '' : String(value);
}
const error = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
const validUrl = (value, local = false) => {
  if (!value) return true;
  if (local && /^\/(?!\/)/.test(value)) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
function validate(req, res, next) {
  const body = req.body || {};
  const invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim())) return invalid('title', 'Add the case study title.');
  if (req.method === 'POST' && !body.status) body.status = 'draft';
  if ('status' in body && !isPublicationState(body.status)) return invalid('status', 'Choose Draft or Published.');
  for (const field of ['url', 'desktopImage', 'mobileImage', 'coverImage']) if (body[field] && !validUrl(body[field], field !== 'url')) return invalid(field, 'Use a valid HTTP or HTTPS URL.');
  for (const field of ARRAYS) if (field in body && body[field] != null && (!Array.isArray(body[field]) || body[field].some(value => typeof value !== 'string'))) return invalid(field, 'Use a list of text values.');
  if (body.gallery?.some(value => !validUrl(value, true))) return invalid('gallery', 'Use valid image URLs in the gallery.');
  if ('featured' in body && typeof body.featured !== 'boolean') return invalid('featured', 'Choose whether to feature this case study.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await Project.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw error(404, 'Case study not found.');
    const expected = req.body?.expected;
    if (expected && FIELDS.some(key => Object.hasOwn(expected, key) && canonical(key, item[key]) !== canonical(key, expected[key]))) throw error(409, 'This case study changed while you were editing. Reload the saved version before saving.');
    const before = item.toJSON();
    const data = Object.fromEntries(FIELDS.filter(key => Object.hasOwn(req.body, key)).map(key => [key, req.body[key]]));
    if (data.slug && data.slug !== item.slug) {
      const base = slugify(String(data.slug), { lower: true, strict: true }) || 'item'; let slug = base, count = 1;
      while (await Project.findOne({ where: { slug, id: { [Op.ne]: item.id } }, transaction })) slug = `${base}-${count++}`;
      data.slug = slug;
    }
    await item.update(data, { transaction }); await item.reload({ transaction });
    return { item, before };
  });
}
module.exports = { validate, updateRecord, canonical, validUrl };
