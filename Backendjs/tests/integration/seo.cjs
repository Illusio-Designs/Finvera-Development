// FINVERA_INTEGRATION_TESTS=1 node tests/integration/pages.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `SEO test ${Date.now()}`; const key = `seo-test-${Date.now()}`; let server, user, row;
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `testimonial-${Date.now()}@example.test`, password: 'not-a-login', role: 'admin', roles: ['admin'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }); server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) { const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  const path = `/seo/${key}`;
  assert.equal((await request(path, { title: prefix }, 'PUT', false)).status, 401);
  for (const body of [{ noindex: 'false' }, { canonical: '/relative' }, { ogImage: 'javascript:alert(1)' }, { title: {} }]) assert.equal((await request(path, body, 'PUT')).status, 400);
  let response = await request(path, { expected: null, title: prefix, description: 'Clear description.', noindex: false }, 'PUT'); assert.equal(response.status, 200); row = response.data; assert.equal(row.page, key);
  assert.equal((await request(path, { expected: null, title: 'Outdated first editor' }, 'PUT')).status, 409);
  const attempts = await Promise.all([request(path, { expected: row, description: 'First edit.' }, 'PUT'), request(path, { expected: row, description: 'Second edit.' }, 'PUT')]);
  assert.equal(attempts.filter(response => response.status === 200).length, 1); assert.equal(attempts.filter(response => response.status === 409).length, 1);
  let saved = attempts.find(response => response.status === 200).data;
  response = await request(path, null, 'GET', false); assert.equal(response.status, 200); assert.equal(response.data.title, prefix);
  response = await request(path, { expected: saved, noindex: true, canonical: 'https://www.finvera.solutions/about', ogImage: '/uploads/share.jpg', keywords: 'design, crm', page: 'hijacked', id: 99999 }, 'PUT'); assert.equal(response.status, 200); saved = response.data; assert.equal(saved.page, key); assert.equal(saved.id, row.id);
  response = await request(path, null, 'GET', false); assert.equal(response.data.noindex, true); assert.equal(response.data.ogImage, '/uploads/share.jpg');
  response = await request(path, { expected: saved, noindex: false, canonical: null, ogImage: null }, 'PUT'); assert.equal(response.status, 200); assert.equal(response.data.title, prefix); assert.equal(response.data.keywords, 'design, crm');
  response = await request(path, null, 'GET', false); assert.equal(response.data.noindex, false); assert.equal(response.data.canonical, null);
  const initial = await Promise.all([request(path + '-race', { expected: null, title: 'First creator' }, 'PUT'), request(path + '-race', { expected: null, title: 'Second creator' }, 'PUT')]);
  assert.equal(initial.filter(response => response.status === 200).length, 1); assert.equal(initial.filter(response => response.status === 409).length, 1);
  console.log('PASS: SEO auth, URL/type validation, first-create conflicts, concurrent updates, immutable identity, public cache invalidation, clearing overrides and untouched-field preservation. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  await m.Seo.destroy({ where: { page: key + '-race' } });
  if (row) await m.Seo.destroy({ where: { id: row.id } });
  if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
