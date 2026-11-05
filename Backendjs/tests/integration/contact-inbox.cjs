// FINVERA_INTEGRATION_TESTS=1 node tests/integration/contact-inbox.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const m = require('../../src/models');
const mailer = require('../../src/utils/mailer');
const original = { configured: mailer.configured, sendMail: mailer.sendMail };
const prefix = `Inbox test ${Date.now()}`;
let server, user, forbidden, message, spam, leadId;
(async () => {
 try {
  await m.sequelize.authenticate();
  await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `inbox-${Date.now()}@example.test`, password: 'not-a-login', role: 'leads', roles: ['leads'], active: true });
  forbidden = await m.User.create({ name: prefix + ' restricted', email: `inbox-restricted-${Date.now()}@example.test`, password: 'not-a-login', role: 'graphic', roles: ['graphic'], active: true });
  message = await m.ContactSubmission.create({ name: prefix, email: 'sender@example.test', company: prefix, phone: '9876543210', projectType: 'Brand identity', message: 'Please discuss <script>example</script>.', isRead: false });
  spam = await m.ContactSubmission.create({ name: prefix + ' spam', email: 'spam@example.test', message: 'Quarantined message', isSpam: true, isRead: true });
  let sent = 0, mailMode = 'failure', lastMail;
  mailer.configured = () => mailMode !== 'unconfigured';
  mailer.sendMail = async payload => { sent++; lastMail = payload; return mailMode === 'success' ? { sent: true } : { sent: false, reason: 'Simulated local transport failure' }; };
  server = require('../../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', actor = user) {
   const token = actor ? jwt.sign({ id: actor.id }, process.env.JWT_SECRET, { expiresIn: '5m' }) : null;
   const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: r.status, data: await r.json() };
  }
  assert.equal((await request('/contact', null, 'GET', null)).status, 401);
  assert.equal((await request('/contact', null, 'GET', forbidden)).status, 403);
  const path = `/contact/${message.id}`, spamPath = `/contact/${spam.id}`;
  let r = await request(`/contact?q=${encodeURIComponent(prefix)}&page=1&limit=1`); assert.equal(r.data.total, 1); assert.equal(r.data.items[0].id, message.id);
  r = await request(`/export/contact?q=${encodeURIComponent(prefix)}&spam=1`); assert.equal(r.data.total, 1); assert.equal(r.data.rows[0].ID, spam.id);
  assert.equal((await request(path + '/read', { isRead: 'false' }, 'PATCH')).status, 400);
  assert.equal((await request(path + '/spam', { isSpam: 'false' }, 'PATCH')).status, 400);
  r = await request(path + '/read', { isRead: true }, 'PATCH'); assert.equal(r.data.isRead, true);
  await request(path + '/read', { isRead: false }, 'PATCH');
  r = await request(`/export/contact?q=${encodeURIComponent(prefix)}&unread=1`); assert.equal(r.data.total, 1);
  assert.equal((await request(spamPath + '/reply', { message: 'Do not send' }, 'POST')).status, 409);
  assert.equal((await request(spamPath + '/to-lead', {}, 'POST')).status, 409); assert.equal(sent, 0);
  mailMode = 'unconfigured'; assert.equal((await request(path + '/reply', { message: 'Draft' }, 'POST')).status, 400); assert.equal(sent, 0);
  assert.equal(await m.ContactReply.count({ where: { contactId: message.id } }), 0);
  mailMode = 'failure'; r = await request(path + '/reply', { message: 'Kept draft' }, 'POST'); assert.equal(r.status, 502); assert.equal(r.data.emailed, false); assert.equal(r.data.reply.sent, false);
  mailMode = 'success'; r = await request(path + '/reply', { subject: 'Hello\r\nWorld', message: '<script>reply</script>' }, 'POST'); assert.equal(r.status, 201); assert.equal(r.data.emailed, true); assert.equal(lastMail.subject, 'Hello World'); assert.ok(lastMail.html.includes('&lt;script&gt;reply&lt;/script&gt;'));
  r = await request(path + '/replies'); assert.equal(r.data.length, 2); assert.equal(r.data[0].sent, true);
  const conversions = await Promise.all([request(path + '/to-lead', {}, 'POST'), request(path + '/to-lead', {}, 'POST')]);
  assert.equal(conversions.filter(r => r.data.created).length, 1); assert.equal(conversions[0].data.lead.id, conversions[1].data.lead.id);
  leadId = conversions[0].data.lead.id; assert.equal(conversions[0].data.lead.ownerId, user.id); assert.equal(conversions[0].data.lead.purpose, 'Brand identity');
  await request(path + '/read', { isRead: false }, 'PATCH'); r = await request(path + '/to-lead', {}, 'POST'); assert.equal(r.data.created, false); assert.equal(r.data.contact.isRead, true);
  await request(spamPath + '/spam', { isSpam: false }, 'PATCH'); await spam.reload(); assert.equal(spam.isRead, false); assert.equal(spam.spamReason, null);
  // Reply cleanup failing must preserve the message as well.
  const destroy = m.ContactReply.destroy;
  try { m.ContactReply.destroy = async () => { throw new Error('Simulated local cleanup failure'); }; assert.equal((await request(path, null, 'DELETE')).status, 500); }
  finally { m.ContactReply.destroy = destroy; }
  assert.ok(await m.ContactSubmission.findByPk(message.id)); assert.equal(await m.ContactReply.count({ where: { contactId: message.id } }), 2);
  assert.equal((await request(path, null, 'DELETE')).status, 200); assert.equal(await m.ContactReply.count({ where: { contactId: message.id } }), 0); assert.ok(await m.Lead.findByPk(leadId));
  console.log('PASS: inbox access, read/spam validation, search/paging/exports, reply failures and success, HTML escaping, concurrent lead conversion, spam restoration and atomic deletion. SMTP mocked; no email sent.');
 } finally {
  mailer.configured = original.configured; mailer.sendMail = original.sendMail;
  if (server) await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => setTimeout(resolve, 100));
  for (const row of [message, spam]) if (row) { await m.ContactReply.destroy({ where: { contactId: row.id } }); await m.ContactSubmission.destroy({ where: { id: row.id } }); }
  if (leadId) await m.Lead.destroy({ where: { id: leadId } });
  for (const actor of [user, forbidden]) if (actor) { await m.Notification.destroy({ where: { userId: actor.id } }); await m.ActivityLog.destroy({ where: { userId: actor.id } }); await actor.destroy(); }
  await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
