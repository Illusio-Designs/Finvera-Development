// FINVERA_INTEGRATION_TESTS=1 node tests/integration/portfolio.cjs
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), m = require('../../src/models');
const prefix = `Portfolio test ${Date.now()}`; let server, user; const ids = [];
(async () => {
 try {
  await m.sequelize.authenticate(); await require('../../src/utils/ensureColumns')(m.sequelize);
  user = await m.User.create({ name: prefix, email: `portfolio-${Date.now()}@example.test`, password: 'not-a-login', role: 'content', roles: ['content'], active: true });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
  server = require('../../src/app').listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body, method = 'GET', auth = true) {
   const response = await fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status: response.status, data: await response.json() };
  }
  assert.equal((await request('/projects', { title: prefix }, 'POST', false)).status, 401);
  assert.equal((await request('/projects', { title: ' ' }, 'POST')).status, 400);
  let response = await request('/projects', { title: prefix, client: 'Test client', url: 'https://example.test', desktopImage: '/uploads/art.jpg', results: ['30% — Growth'], tech: ['Next.js'], gallery: ['/uploads/legacy.jpg'], challenge: '<p>A challenge</p>', featured: false }, 'POST');
  assert.equal(response.status, 201); const first = response.data; ids.push(first.id); assert.equal(first.status, 'draft');
  response = await request('/projects', { title: prefix }, 'POST'); assert.equal(response.status, 201); ids.push(response.data.id); assert.notEqual(response.data.slug, first.slug);
  assert.equal((await request(`/projects/${first.slug}`, null, 'GET', false)).status, 404);
  const attempts = await Promise.all([request(`/projects/${first.id}`, { expected: first, blurb: 'First editor' }, 'PATCH'), request(`/projects/${first.id}`, { expected: first, blurb: 'Second editor' }, 'PATCH')]);
  assert.equal(attempts.filter(response => response.status === 200).length, 1); assert.equal(attempts.filter(response => response.status === 409).length, 1);
  let saved = attempts.find(response => response.status === 200).data;
  assert.equal(saved.slug, first.slug); assert.deepEqual(saved.gallery, first.gallery); assert.equal(saved.challenge, first.challenge);
  assert.equal((await request(`/projects/${first.id}`, { expected: saved, url: 'javascript:alert(1)' }, 'PATCH')).status, 400);
  response = await request(`/projects/${first.id}`, { expected: saved, status: 'published', title: prefix + ' revised' }, 'PUT'); assert.equal(response.status, 200); saved = response.data; assert.equal(saved.slug, first.slug);
  response = await request(`/projects/${first.slug}`, null, 'GET', false); assert.equal(response.status, 200); assert.deepEqual(response.data.results, ['30% — Growth']);
  response = await request(`/projects?q=${encodeURIComponent(prefix)}`, null, 'GET', false); assert.equal(response.data.length, 1);
  response = await request(`/projects/${first.id}`, { expected: saved, status: 'draft' }, 'PATCH'); assert.equal(response.status, 200);
  assert.equal((await request(`/projects/${first.slug}`, null, 'GET', false)).status, 404, 'unpublishing must invalidate a cached public item');
  response = await request(`/activity/project/${first.id}`); assert.equal(response.status, 200); assert.ok(response.data.length >= 2);
  assert.equal((await request(`/projects/${first.id}`, null, 'DELETE')).status, 200);
  console.log('PASS: private draft defaults, title/URL validation, unique/stable slugs, concurrent edit conflicts, preservation of hidden fields, publish/unpublish cache invalidation and activity history. Local DB only.');
 } finally {
  if (server) await new Promise(resolve => server.close(resolve)); await new Promise(resolve => setTimeout(resolve, 100));
  for (const id of ids) await m.Project.destroy({ where: { id } });
  if (user) { await m.ActivityLog.destroy({ where: { userId: user.id } }); await m.Notification.destroy({ where: { userId: user.id } }); await user.destroy(); }
  require('../../src/utils/publicCache').clear(); await m.sequelize.close();
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
