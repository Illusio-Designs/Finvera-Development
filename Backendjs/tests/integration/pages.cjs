// FINVERA_INTEGRATION_TESTS=1 node tests/integration/pages.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `Website pages test ${Date.now()}`; let server, user, row;
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `testimonial-${Date.now()}@example.test`, password: 'not-a-login', role: 'content', roles: ['content'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }); server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) { const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  assert.equal((await request('/pages', { title: prefix }, 'POST', false)).status, 401);
  for (const slug of ['about','blog','dashboard','reset-password','123','UPPER','a--b']) assert.equal((await request('/pages', { title: prefix, slug }, 'POST')).status, 400);
  let response = await request('/pages', { title: prefix, content: '<h2>Our promise</h2>' }, 'POST'); assert.equal(response.status, 201); row = response.data; assert.equal(row.status, 'draft');
  const path = `/pages/${row.id}`;
  assert.equal((await request(`/pages/${row.slug}`, null, 'GET', false)).status, 404);
  assert.equal((await request('/pages', { title: prefix, slug: row.slug }, 'POST')).status, 409);
  const attempts = await Promise.all([request(path, { expected: row, content: '<p>Clear information.</p>' }, 'PATCH'), request(path, { expected: row, content: '<p>Considered guidance.</p>' }, 'PATCH')]);
  assert.equal(attempts.filter(response => response.status === 200).length, 1); assert.equal(attempts.filter(response => response.status === 409).length, 1);
  let saved = attempts.find(response => response.status === 200).data;
  response = await request(path, { expected: saved, status: 'published' }, 'PUT'); assert.equal(response.status, 200); saved = response.data;
  response = await request(`/pages/${row.slug}`, null, 'GET', false); assert.equal(response.status, 200); assert.ok(response.data.content.includes('<p>'));
  response = await request(`/pages?q=${encodeURIComponent(prefix)}`, null, 'GET', false); assert.equal(response.data.length, 1); assert.equal(response.data[0].content, undefined);
  const movedSlug = row.slug + '-moved';
  response = await request(path, { expected: saved, slug: movedSlug }, 'PATCH'); assert.equal(response.status, 200); saved = response.data; assert.equal(saved.slug, movedSlug);
  assert.equal((await request(`/pages/${row.slug}`, null, 'GET', false)).status, 404); assert.equal((await request(`/pages/${movedSlug}`, null, 'GET', false)).status, 200);
  assert.equal((await request(path, { slug: 'about' }, 'PATCH')).status, 400);
  response = await request(path, { expected: saved, status: 'draft' }, 'PATCH'); assert.equal(response.status, 200); assert.equal((await request(`/pages/${movedSlug}`, null, 'GET', false)).status, 404);
  response = await request('/website/overview'); assert.equal(response.status, 200); assert.ok(response.data.collections.find(collection => collection.resource === 'pages').draft > 0);
  assert.equal((await request(path, null, 'DELETE')).status, 200);
  console.log('PASS: Website pages private drafts, reserved URLs, duplicate URL conflicts, concurrent edits, publish, rename, old URL invalidation, unpublish and overview counts. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  if (row) await m.Page.destroy({ where: { id: row.id } });
  if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
