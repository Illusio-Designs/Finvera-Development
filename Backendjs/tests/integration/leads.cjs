// FINVERA_INTEGRATION_TESTS=1 node tests/integration/leads.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const m = require('../../src/models');
const { todayIst, addDays } = require('../../src/utils/leadFollowUp');
const prefix = `Leads test ${Date.now()}`;
let server, user, lead;
(async () => {
 try {
  await m.sequelize.authenticate();
  await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `leads-${Date.now()}@example.test`, password: 'not-a-login', role: 'leads', roles: ['leads'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
  server = require('../../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) {
   const r = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: r.status, data: await r.json() };
  }
  assert.equal((await request('/leads', null, 'GET', false)).status, 401);
  assert.equal((await request('/leads', { name: ' ' }, 'POST')).status, 400);
  let r = await request('/leads', { name: prefix, company: prefix, owner: user.name, nextFollowUpAt: todayIst(), value: 12000 }, 'POST');
  assert.equal(r.status, 201); lead = await m.Lead.findByPk(r.data.id);
  assert.equal(r.data.ownerId, user.id); assert.equal(r.data.nextFollowUp, todayIst()); assert.equal(r.data.progress, 10);
  const path = `/leads/${lead.id}`;
  r = await request(path, { stage: 'won' }, 'PATCH'); assert.equal(r.data.progress, 100); assert.ok(r.data.wonAt);
  r = await request(path, { stage: 'qualified', owner: null }, 'PATCH'); assert.equal(r.data.progress, 60); assert.equal(r.data.wonAt, null); assert.equal(r.data.ownerId, null);
  const tomorrow = addDays(todayIst(), 1);
  r = await request(path + '/touch', { type: 'call', note: 'Discussed scope', nextFollowUpAt: tomorrow }, 'POST');
  assert.equal(r.status, 201); assert.equal(r.data.lead.nextFollowUp, tomorrow); assert.equal(r.data.lead.nextFollowUpAt, tomorrow); assert.ok(r.data.lead.lastContactedAt);
  assert.equal((await request(path + '/touch', { type: 'call', nextFollowUpAt: '2026-02-30' }, 'POST')).status, 400);
  assert.equal(await m.LeadActivity.count({ where: { leadId: lead.id } }), 1);
  // Force a database-update failure after activity insertion: both must roll back.
  const update = m.Lead.prototype.update;
  try {
   m.Lead.prototype.update = async function (...args) { if (this.id === lead.id) throw new Error('Simulated local update failure'); return update.apply(this, args); };
   assert.equal((await request(path + '/touch', { type: 'call', nextFollowUpAt: todayIst() }, 'POST')).status, 500);
  } finally { m.Lead.prototype.update = update; }
  assert.equal(await m.LeadActivity.count({ where: { leadId: lead.id } }), 1);
  await lead.reload(); assert.equal(lead.nextFollowUpAt, tomorrow);
  r = await request(`/export/leads?q=${encodeURIComponent(prefix)}&owner=__none&followUp=week`); assert.equal(r.status, 200); assert.equal(r.data.total, 1);
  r = await request(`/export/leads?q=${encodeURIComponent(prefix)}&followUp=today`); assert.equal(r.data.total, 0);
  await request(path, { notes: 'uniquenotes' + prefix, phone: '987654321012', stage: 'lost', lostReason: 'Timing' }, 'PATCH');
  r = await request(`/export/leads?q=${encodeURIComponent('uniquenotes' + prefix)}`); assert.equal(r.data.total, 1);
  r = await request(`/export/leads?q=987654321012&followUp=week`); assert.equal(r.data.total, 0, 'closed leads are excluded from follow-up exports');
  await request(path + '/touch', { type: 'note', nextFollowUpAt: null }, 'POST'); await lead.reload(); assert.equal(lead.nextFollowUp, null); assert.equal(lead.nextFollowUpAt, null);
  assert.equal((await request(path, null, 'DELETE')).status, 200); assert.equal(await m.LeadActivity.count({ where: { leadId: lead.id } }), 0);
  console.log('PASS: authenticated lead CRUD, owner linkage/unassignment, stage scores/won dates, mirrored follow-ups, invalid dates, atomic activity rollback, exact filtered export and delete cleanup. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => setTimeout(resolve, 100));
  if (lead) { await m.LeadActivity.destroy({ where: { leadId: lead.id } }); await m.Lead.destroy({ where: { id: lead.id } }); }
  if (user) { await m.Notification.destroy({ where: { userId: user.id } }); await m.ActivityLog.destroy({ where: { userId: user.id } }); await user.destroy(); }
  await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
