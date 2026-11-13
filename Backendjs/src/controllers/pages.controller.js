const { isPublicationState } = require("../utils/contentMachine");
const slugify = require('slugify');
const { Page, sequelize } = require('../models');
const FIELDS = ['title', 'slug', 'content', 'status'];
const RESERVED = new Set(['about', 'services', 'solutions', 'work', 'blog', 'contact', 'data-deletion', 'widgets', 'dashboard', 'login', 'reset-password', 'api', 'auth', 'uploads', '_next', 'sitemap', 'robots', 'favicon']);
const fixedPageSlug = slug => ['privacy', 'terms'].includes(slug);
const validPageSlug = slug => typeof slug === 'string' && slug.length <= 200 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED.has(slug);
const error = (status, message) => Object.assign(new Error(message), { status, statusCode: status });
const canonical = value => String(value ?? '');
function validate(req, res, next) {
  const body = req.body || {}, invalid = (field, message) => res.status(400).json({ field, message });
  if ((req.method === 'POST' || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 255)) return invalid('title', 'Add a page title of 255 characters or fewer.');
  if (req.method === 'POST') {
    if (!body.status) body.status = 'draft';
    if (!body.slug) body.slug = slugify(body.title, { lower: true, strict: true });
  }
  if ('slug' in body && !validPageSlug(body.slug)) return invalid('slug', 'Use a short URL starting with a letter, with lowercase letters, numbers and single hyphens. Built-in website routes are reserved.');
  if ('status' in body && !isPublicationState(body.status)) return invalid('status', 'Choose Draft or Published.');
  if (body.content != null && typeof body.content !== 'string') return invalid('content', 'Use text for the page content.');
  next();
}
async function updateRecord(req) {
  return sequelize.transaction(async transaction => {
    const item = await Page.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw error(404, 'Page not found.');
    const expected = req.body?.expected;
    if (expected && FIELDS.some(key => Object.hasOwn(expected, key) && canonical(item[key]) !== canonical(expected[key]))) throw error(409, 'This page changed while you were editing. Reload the saved version before saving.');
    const data = Object.fromEntries(FIELDS.filter(key => Object.hasOwn(req.body, key)).map(key => [key, req.body[key]]));
    if (fixedPageSlug(item.slug) && data.slug && data.slug !== item.slug) throw error(400, 'Privacy and Terms addresses are fixed because the website links to them.');
    const before = item.toJSON(); await item.update(data, { transaction }); await item.reload({ transaction }); return { item, before };
  });
}
module.exports = { validate, updateRecord, validPageSlug, fixedPageSlug };
