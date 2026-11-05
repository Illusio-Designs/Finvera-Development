// FINVERA_INTEGRATION_TESTS=1 node tests/integration/blog.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `Website blog test ${Date.now()}`; let server, user, row;
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `testimonial-${Date.now()}@example.test`, password: 'not-a-login', role: 'content', roles: ['content'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }); server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) { const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  assert.equal((await request('/blog', { title: prefix }, 'POST', false)).status, 401);
  assert.equal((await request('/blog', { title: ' ' }, 'POST')).status, 400);
  let response = await request('/blog', { title: prefix, author: 'Finvera', content: '<h2>Original story</h2>', tags: ['Design'], seoKeywords: 'design, strategy' }, 'POST'); assert.equal(response.status, 201); row = response.data; assert.equal(row.status, 'draft');
  const path = `/blog/${row.id}`;
  assert.equal((await request(path, null, 'GET', false)).status, 404);
  for (const patch of [{ tags: [1] }, { publishedAt: 'invalid' }, { coverImage: 'javascript:alert(1)' }, { content: {} }, { status: 'invalid' }]) assert.equal((await request(path, patch, 'PATCH')).status, 400);
  const attempts = await Promise.all([request(path, { expected: row, excerpt: 'Designing with purpose.' }, 'PATCH'), request(path, { expected: row, excerpt: 'Building considered products.' }, 'PATCH')]);
  assert.equal(attempts.filter(response => response.status === 200).length, 1); assert.equal(attempts.filter(response => response.status === 409).length, 1);
  let saved = attempts.find(response => response.status === 200).data;
  response = await request(path, { expected: saved, status: 'published', coverImage: '/uploads/blog-test.jpg' }, 'PUT'); assert.equal(response.status, 200); saved = response.data; assert.ok(saved.publishedAt); assert.equal(saved.slug, row.slug);
  response = await request(path, null, 'GET', false); assert.equal(response.status, 200); assert.equal(response.data.seoKeywords, 'design, strategy'); assert.equal(response.data.content, '<h2>Original story</h2>');
  response = await request(`/blog?q=${encodeURIComponent(prefix)}`, null, 'GET', false); assert.equal(response.data.length, 1); assert.equal(response.data[0].content, undefined);
  response = await request(path, { expected: saved, publishedAt: '2026-01-05T10:30:00.000Z', excerpt: 'Updated introduction.' }, 'PATCH'); assert.equal(response.status, 200); saved = response.data; assert.equal(saved.publishedAt, '2026-01-05T10:30:00.000Z'); assert.equal(saved.tags[0], 'Design');
  response = await request(path, { expected: saved, status: 'draft', coverImage: null }, 'PATCH'); assert.equal(response.status, 200); assert.equal((await request(path, null, 'GET', false)).status, 404);
  response = await request('/website/overview'); assert.equal(response.status, 200); assert.ok(response.data.collections.find(collection => collection.resource === 'blog').draft > 0);
  assert.equal((await request(path, null, 'DELETE')).status, 200);
  console.log('PASS: Blog drafts, rich content, validation, concurrent edits, publication dates, stable URLs, SEO/tags preservation, public cache and counts. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  if (row) await m.BlogPost.destroy({ where: { id: row.id } });
  if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
