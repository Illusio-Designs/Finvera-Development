// FINVERA_INTEGRATION_TESTS=1 node tests/integration/website-overview.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const models = require('../../src/models');
const { COLLECTIONS } = require('../../src/controllers/website.controller');
const prefix = `Website test ${Date.now()}`;
let server, editor, restricted; const fixtures = [];
(async () => {
 try {
  await models.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(models.sequelize);
  for (const role of ['content', 'graphic']) {
   const user = await models.User.create({ name: prefix + role, email: `${role}-${Date.now()}@example.test`, password: 'not-a-login', role, roles: [role], active: true });
   if (role === 'content') editor = user; else restricted = user;
  }
  server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, actor = null, body, method = 'GET') {
   const token = actor ? jwt.sign({ id: actor.id }, process.env.JWT_SECRET, { expiresIn: '5m' }) : null;
   const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: response.status, data: await response.json() };
  }
  assert.equal((await request('/website/overview')).status, 401);
  assert.equal((await request('/website/overview', restricted)).status, 403);
  const baseline = (await request('/website/overview', editor)).data.collections;
  assert.equal(baseline.length, 14);
  for (const [resource, name] of Object.entries(COLLECTIONS)) {
   const Model = models[name], pair = { resource };
   for (const status of ['published', 'draft']) {
    const body = { status };
    for (const field of ['title', 'name', 'question', 'value', 'label', 'quote']) if (Model.rawAttributes[field]) body[field] = prefix + ' ' + status;
    if (Model.rawAttributes.slug) body.slug = `${prefix}-${resource}-${status}`.toLowerCase().replaceAll(' ', '-');
    pair[status] = await Model.create(body); fixtures.push(pair[status]);
   }
   const query = `q=${encodeURIComponent(prefix)}&status=draft`;
   for (const actor of [null, restricted]) {
    for (const extra of ['', '&page=1&limit=50&sort=-id&fields=full', '&fields=list']) {
     const response = await request(`/${resource}?${query}${extra}`, actor);
     assert.equal(response.status, 200); const rows = Array.isArray(response.data) ? response.data : response.data.items;
     assert.equal(rows.length, 1, `${resource}: public status filter must not expose drafts`); assert.equal(rows[0].status, 'published');
    }
    assert.equal((await request(`/${resource}/${pair.draft.id}`, actor)).status, 404);
    if (Model.rawAttributes.slug) assert.equal((await request(`/${resource}/${pair.draft.slug}`, actor)).status, 404);
   }
   let response = await request(`/${resource}?${query}`, editor); assert.equal(response.data.length, 1); assert.equal(response.data[0].id, pair.draft.id);
   assert.equal((await request(`/${resource}/${pair.draft.id}`, editor)).status, 200);
   assert.equal((await request(`/${resource}/${pair.draft.id}`, restricted, { status: 'published' }, 'PATCH')).status, 403);
  }
  let response = await request('/website/overview', editor); assert.equal(response.status, 200);
  for (const section of response.data.collections) {
   const before = baseline.find(row => row.resource === section.resource);
   assert.equal(section.total, before.total + 2); assert.equal(section.published, before.published + 1); assert.equal(section.draft, before.draft + 1); assert.ok(section.updatedAt);
   assert.deepEqual(Object.keys(section).sort(), ['draft', 'published', 'resource', 'total', 'updatedAt']);
  }
  response = await request('/public/bootstrap'); assert.equal(response.status, 200);
  for (const value of Object.values(response.data)) if (Array.isArray(value)) for (const row of value) if (row.status) assert.equal(row.status, 'published');
  const faq = fixtures.find(row => row.constructor.name === 'Faq' && row.status === 'draft');
  assert.equal((await request(`/faqs/${faq.id}`, editor, { status: 'published' }, 'PATCH')).status, 200);
  response = await request(`/faqs/${faq.id}`); assert.equal(response.status, 200, 'publishing must invalidate the previous public 404 cache');
  response = await request('/website/overview', editor); const faqCounts = response.data.collections.find(row => row.resource === 'faqs');
  assert.equal(faqCounts.draft, baseline.find(row => row.resource === 'faqs').draft);
  console.log('PASS: all 14 live collection counts, content permissions, anonymous/non-content draft isolation across list/paging/sort/detail/slug, bootstrap and publish cache invalidation. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  for (const row of fixtures) await row.destroy();
  for (const user of [editor, restricted]) if (user) { await models.Notification.destroy({ where: { userId: user.id } }); await models.ActivityLog.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await models.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
