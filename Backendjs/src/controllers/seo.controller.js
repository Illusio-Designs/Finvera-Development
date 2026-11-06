const { Seo, sequelize } = require('../models');
const FIELDS = ['title', 'description', 'keywords', 'ogImage', 'canonical', 'noindex'];
const error = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
const validUrl = (value, local = false) => {
  if (!value) return true;
  if (local && /^\/(?!\/)[^\s]*$/.test(value)) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if (!/^[a-z][a-z0-9-]{0,99}$/.test(req.params.page || '')) return invalid('page', 'Use a valid page key.');
  for (const field of FIELDS.filter(key => key !== 'noindex')) if (body[field] != null && (typeof body[field] !== 'string' || body[field].length > (field === 'description' ? 10000 : 255))) return invalid(field, 'Use text within the field limit.');
  if ('noindex' in body && typeof body.noindex !== 'boolean') return invalid('noindex', 'Choose whether to allow indexing.');
  if (!validUrl(body.canonical)) return invalid('canonical', 'Use an absolute HTTP or HTTPS canonical URL.');
  if (!validUrl(body.ogImage, true)) return invalid('ogImage', 'Use an uploaded image or an HTTP image URL.');
  next();
}
const canonical = (key, value) => key === 'noindex' ? !!value : String(value ?? '');
async function save(req) {
  return sequelize.transaction(async transaction => {
    const [row, created] = await Seo.findOrCreate({ where: { page: req.params.page }, defaults: { page: req.params.page }, transaction });
    await row.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (Object.hasOwn(req.body, 'expected')) {
      const expected = req.body.expected;
      if (expected === null ? !created : created || FIELDS.some(key => canonical(key, row[key]) !== canonical(key, expected?.[key]))) throw error(409, 'This SEO configuration changed while you were editing. Reload the saved version before saving.');
    }
    const patch = Object.fromEntries(FIELDS.filter(key => Object.hasOwn(req.body, key)).map(key => [key, req.body[key]]));
    await row.update(patch, { transaction }); await row.reload({ transaction }); return row;
  });
}
module.exports = { validate, save, validUrl };
