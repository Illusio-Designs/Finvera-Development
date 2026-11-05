// FINVERA_INTEGRATION_TESTS=1 node tests/integration/renewals.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const m = require('../../src/models');
const prefix = `Renewals test ${Date.now()}`;
let server, user, row;
(async () => {
 try {
  await m.sequelize.authenticate();
  await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `renewals-${Date.now()}@example.test`, password: 'not-a-login', role: 'projects', roles: ['projects'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
  server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) {
   const r = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: r.status, data: await r.json() };
  }
  assert.equal((await request('/renewals', null, 'GET', false)).status, 401);
  assert.equal((await request('/renewals', { client: ' ' }, 'POST')).status, 400);
  let r = await request('/renewals', { client: prefix, project: 'Hosting', owner: user.name, cycle: 'monthly', renewalDate: '2026-01-31', lastInvoiced: '2026-01-01', amount: 12000, notes: 'Existing history' }, 'POST');
  assert.equal(r.status, 201); row = await m.Renewal.findByPk(r.data.id); const path = `/renewals/${row.id}`;
  assert.equal((await request(path, { cycle: 'wrong' }, 'PATCH')).status, 400);
  assert.equal((await request(path + '/renew', { renewalDate: '2026-02-30' }, 'POST')).status, 400);
  assert.equal((await request(path + '/renew', { invoiced: 'false' }, 'POST')).status, 400);
  const snapshot = row.toJSON();
  const responses = await Promise.all([request(path + '/renew', { expected: snapshot, invoiced: false, remark: 'Paid by UPI' }, 'POST'), request(path + '/renew', { expected: snapshot }, 'POST')]);
  assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 1);
  const renewed = responses.find(r => r.status === 200).data; assert.equal(renewed.renewalDate, '2026-02-28'); assert.ok(renewed.notes.includes('Existing history'));
  if (renewed.notes.includes('Paid by UPI')) assert.equal(renewed.lastInvoiced, '2026-01-01');
  const remarks = await Promise.all([request(path + '/remarks', { remark: 'First independent note' }, 'POST'), request(path + '/remarks', { remark: 'Second independent note' }, 'POST')]);
  assert.ok(remarks.every(r => r.status === 200)); await row.reload(); assert.ok(row.notes.includes('First independent note')); assert.ok(row.notes.includes('Second independent note'));
  assert.equal((await request(path, { expected: renewed, notes: 'Old history' }, 'PUT')).status, 409, 'stale Undo/edit must not erase new remarks');
  r = await request(path, { expected: row.toJSON(), owner: null }, 'PUT'); assert.equal(r.status, 200); assert.equal(r.data.owner, null);
  r = await request(`/export/renewals?q=${encodeURIComponent(prefix)}&owner=__none&from=2026-02-01&to=2026-02-28`); assert.equal(r.status, 200); assert.equal(r.data.total, 1);
  await row.reload(); r = await request(path + '/terminate', { expected: row.toJSON(), remark: 'Project closed' }, 'POST'); assert.equal(r.data.status, 'cancelled'); assert.ok(r.data.notes.includes('Terminated'));
  r = await request(path + '/restore', { expected: r.data }, 'POST'); assert.equal(r.data.status, 'active'); assert.equal(r.data.renewalDate, '2026-02-28'); assert.ok(r.data.notes.includes('Restored')); assert.ok(r.data.notes.includes('Project closed'));
  r = await request(path + '/renew', { expected: r.data, renewalDate: '2027-03-15', invoiced: false }, 'POST'); assert.equal(r.data.renewalDate, '2027-03-15');
  assert.equal((await request(path, null, 'DELETE')).status, 200);
  console.log('PASS: renewal CRUD/access, month-end cycles, date validation, concurrent renew conflict, append-only remarks, stale Undo rejection, owner unassignment/export, termination and restore history. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  if (row) await m.Renewal.destroy({ where: { id: row.id } });
  if (user) { await m.Notification.destroy({ where: { userId: user.id } }); await m.ActivityLog.destroy({ where: { userId: user.id } }); await user.destroy(); }
  await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
