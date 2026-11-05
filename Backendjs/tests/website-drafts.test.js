const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crudController } = require('../src/utils/crud');
const cache = require('../src/utils/publicCache');
const rows = [{ id: 1, slug: 'public-item', status: 'published' }, { id: 2, slug: 'private-item', status: 'draft' }];
const matching = where => rows.filter(row => Object.entries(where).every(([key, value]) => String(row[key]) === String(value)));
const Model = { name: 'WebsiteDraftFixture', rawAttributes: { id: {}, slug: {}, status: {} },
  findAll: async ({ where }) => matching(where),
  findAndCountAll: async ({ where }) => ({ rows: matching(where), count: matching(where).length }),
  findOne: async ({ where }) => matching(where)[0] || null,
};
const controller = crudController(Model, { hasStatus: true, publicCache: true, canReadDrafts: req => req.user?.role === 'content' });
async function call(handler, { query = {}, user, id } = {}) {
  let status = 200, body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; }, set() { return this; }, vary() { return this; }, type() { return this; }, send(value) { body = JSON.parse(value); return this; } };
  await handler({ query, user, params: { id }, originalUrl: '/fixture?' + new URLSearchParams(query) }, res, error => { throw error; });
  return { status, body };
}
test('public and non-content callers cannot override publication status, including pagination', async () => {
  cache.clear();
  for (const user of [undefined, { role: 'graphic' }]) for (const query of [{ status: 'draft' }, { status: 'draft', page: '1', limit: '10' }, { status: 'draft', fields: 'list', sort: '-id' }]) {
    const result = await call(controller.list, { user, query });
    assert.deepEqual(Array.isArray(result.body) ? result.body : result.body.items, [rows[0]]);
  }
  const editor = await call(controller.list, { user: { role: 'content' }, query: { status: 'draft' } });
  assert.deepEqual(editor.body, [rows[1]]);
  cache.clear();
});
test('private items stay hidden by both id and slug while editors retain access', async () => {
  cache.clear();
  for (const user of [undefined, { role: 'graphic' }]) for (const id of ['2', 'private-item']) assert.equal((await call(controller.getOne, { user, id })).status, 404);
  assert.equal((await call(controller.getOne, { user: { role: 'content' }, id: '2' })).status, 200);
  assert.equal((await call(controller.getOne, { id: 'public-item' })).status, 200);
  cache.clear();
});
