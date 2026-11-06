// FINVERA_INTEGRATION_TESTS=1 node tests/integration/milestones.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `Milestones test ${Date.now()}`; let server, editor, restricted; const ids = []; let originalOrder = [];
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  originalOrder = await m.Milestone.findAll({ attributes: ['id', 'position'], raw: true });
  for (const role of ['content', 'graphic']) { const user = await m.User.create({ name: prefix + role, email: `${role}-milestones-${Date.now()}@example.test`, password: 'not-a-login', role, roles: [role], active: true }); if (role === 'content') editor = user; else restricted = user; }
  server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', actor = editor) {
   const token = actor ? jwt.sign({ id: actor.id }, process.env.JWT_SECRET, { expiresIn: '5m' }) : null;
   const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: response.status, data: await response.json() };
  }
  assert.equal((await request('/milestones', { title: prefix }, 'POST', null)).status, 401);
  assert.equal((await request('/milestones', { title: prefix }, 'POST', restricted)).status, 403);
  assert.equal((await request('/milestones', { title: ' ' }, 'POST')).status, 400);
  assert.equal((await request('/milestones', { title: prefix, status: 'published', description: ' ' }, 'POST')).status, 400);
  let response = await request('/milestones', { title: prefix, year: '2024', description: 'A clearer offering' }, 'POST'); assert.equal(response.status, 201); const first = response.data; ids.push(first.id); assert.equal(first.status, 'draft');
  response = await request('/milestones', { title: prefix }, 'POST'); assert.equal(response.status, 201); ids.push(response.data.id);
  assert.equal((await request(`/milestones/${first.id}`, null, 'GET', null)).status, 404);
  const attempts = await Promise.all([request(`/milestones/${first.id}`, { expected: first, description: 'First editor' }, 'PATCH'), request(`/milestones/${first.id}`, { expected: first, description: 'Second editor' }, 'PATCH')]);
  assert.equal(attempts.filter(r => r.status === 200).length, 1); assert.equal(attempts.filter(r => r.status === 409).length, 1);
  let saved = attempts.find(r => r.status === 200).data;
  assert.equal((await request(`/milestones/${first.id}`, { year: {} }, 'PATCH')).status, 400);
  response = await request(`/milestones/${first.id}`, { expected: saved, status: 'published', title: prefix + ' revised' }, 'PATCH'); assert.equal(response.status, 200); saved = response.data; assert.equal(saved.id, first.id);
  assert.equal((await request(`/milestones/${first.id}`, null, 'GET', null)).status, 200);
  assert.equal((await request(`/milestones/${first.id}`, { description: '' }, 'PATCH')).status, 400);
  assert.equal((await request(`/milestones/${ids[1]}`, { status: 'published' }, 'PATCH')).status, 400);
  const snapshot = (await request('/milestones')).data, order = snapshot.map(row => row.id).reverse();
  assert.equal((await request('/milestones/reorder', { ids: order, expected: snapshot }, 'POST', restricted)).status, 403);
  assert.equal((await request('/milestones/reorder', { ids: [order[0], order[0]], expected: snapshot }, 'POST')).status, 400);
  assert.equal((await request('/milestones/reorder', { ids: order.slice(1), expected: snapshot }, 'POST')).status, 400);
  assert.equal((await request('/milestones/reorder', { ids: order.slice(1), expected: snapshot.filter(row => row.id !== order[0]) }, 'POST')).status, 409);
  assert.equal((await request('/milestones/reorder', { ids: order, expected: order.map(id => ({ id })) }, 'POST')).status, 400);
  const orders = await Promise.all([request('/milestones/reorder', { ids: order, expected: snapshot }, 'POST'), request('/milestones/reorder', { ids: [...order.slice(1), order[0]], expected: snapshot }, 'POST')]);
  assert.equal(orders.filter(r => r.status === 200).length, 1); assert.equal(orders.filter(r => r.status === 409).length, 1);
  const arranged = orders.find(r => r.status === 200).data.items; arranged.forEach((row, index) => assert.equal(row.position, index));
  const publicRows = (await request('/milestones', null, 'GET', null)).data; assert.ok(publicRows.every(row => row.status === 'published')); assert.deepEqual(publicRows.map(row => row.position), [...publicRows.map(row => row.position)].sort((a, b) => a - b));
  saved = arranged.find(row => row.id === first.id);
  response = await request(`/milestones/${first.id}`, { expected: saved, status: 'draft' }, 'PUT'); assert.equal(response.status, 200); assert.equal((await request(`/milestones/${first.id}`, null, 'GET', null)).status, 404);
  assert.equal((await request(`/milestones/${first.id}`, null, 'DELETE')).status, 200);
  console.log('PASS: Milestones permissions, draft defaults, validation, description validation, concurrent edit and full-order conflicts, atomic reorder, public ordering and publish/unpublish cache invalidation. Local DB only; previous order restored.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  for (const id of ids) await m.Milestone.destroy({ where: { id } });
  for (const row of originalOrder) await m.Milestone.update({ position: row.position }, { where: { id: row.id }, silent: true });
  for (const user of [editor, restricted]) if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
