// FINVERA_INTEGRATION_TESTS=1 node tests/integration/testimonials.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `Testimonials test ${Date.now()}`; let server, user, row;
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `testimonial-${Date.now()}@example.test`, password: 'not-a-login', role: 'content', roles: ['content'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' }); server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) { const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() }; }
  assert.equal((await request('/testimonials', { name: prefix }, 'POST', false)).status, 401);
  assert.equal((await request('/testimonials', { name: ' ' }, 'POST')).status, 400);
  assert.equal((await request('/testimonials', { name: prefix, status: 'published', quote: '' }, 'POST')).status, 400);
  let response = await request('/testimonials', { name: prefix, company: 'Studio North' }, 'POST'); assert.equal(response.status, 201); row = response.data; assert.equal(row.status, 'draft'); assert.equal(row.quote, '');
  const path = `/testimonials/${row.id}`;
  assert.equal((await request(path, null, 'GET', false)).status, 404);
  for (const rating of [0, 6, 2.5]) assert.equal((await request(path, { rating }, 'PATCH')).status, 400);
  assert.equal((await request(path, { expected: row, status: 'published' }, 'PATCH')).status, 400);
  const attempts = await Promise.all([request(path, { expected: row, quote: 'A thoughtful team.' }, 'PATCH'), request(path, { expected: row, quote: 'Clear and considered work.' }, 'PATCH')]);
  assert.equal(attempts.filter(response => response.status === 200).length, 1); assert.equal(attempts.filter(response => response.status === 409).length, 1);
  let saved = attempts.find(response => response.status === 200).data;
  response = await request(path, { expected: saved, status: 'published', rating: 4, position: 10, avatar: 'CL' }, 'PUT'); assert.equal(response.status, 200); saved = response.data;
  response = await request(path, null, 'GET', false); assert.equal(response.status, 200); assert.equal(response.data.rating, 4); assert.equal(response.data.company, 'Studio North');
  assert.equal((await request(path, { expected: saved, quote: ' ' }, 'PATCH')).status, 400);
  response = await request(`/testimonials?q=${encodeURIComponent(prefix)}`, null, 'GET', false); assert.equal(response.data.length, 1);
  response = await request(path, { expected: saved, status: 'draft', quote: '' }, 'PATCH'); assert.equal(response.status, 200); assert.equal((await request(path, null, 'GET', false)).status, 404);
  response = await request('/website/overview'); assert.equal(response.status, 200); assert.ok(response.data.collections.find(collection => collection.resource === 'testimonials').draft > 0);
  assert.equal((await request(path, null, 'DELETE')).status, 200);
  console.log('PASS: Testimonials access, incomplete private drafts, publish validation, real ratings/order/initials, concurrent edit protection, public cache invalidation and overview counts. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  if (row) await m.Testimonial.destroy({ where: { id: row.id } });
  if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
