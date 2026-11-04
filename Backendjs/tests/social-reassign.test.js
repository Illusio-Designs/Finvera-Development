const { test } = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const notify = require("../src/utils/notify");
const originalNotify = notify.notifyUsers;
notify.notifyUsers = async () => {};
const { reassignPending } = require("../src/controllers/socialReassign.controller");
notify.notifyUsers = originalNotify;

async function run(body, { changed = false } = {}) {
  let writes = 0, history = [];
  const target = { id: 22, active: true, roles: ["graphic"], socialClients: [], update: async () => { writes++; } };
  const rows = [
    { id: 1, theme: "Static", client: "Demo", status: "planned", format: "Post", assigneeId: 11, team: { graphic: 11, social: 33 }, media: [{ url: "retained.jpg" }], postDate: "2026-11-10" },
    { id: 2, theme: "Reel", client: "Demo", status: "production", format: "Reel", assigneeId: 11, team: { video: 11, social: 33 } },
    { id: 3, theme: "Publishing", client: "Demo", status: "ready", format: "Post", assigneeId: 11, team: { social: 11 } },
  ];
  rows.forEach((p) => { p.update = async (fields) => { writes++; Object.assign(p, fields); }; });
  const patch = (obj, key, value, originals) => { originals.push([obj, key, obj[key]]); obj[key] = value; };
  const originals = [];
  patch(require("../src/utils/audit"), "record", () => {}, originals);
  patch(models.User, "findByPk", async () => target, originals);
  patch(models.SocialPost, "findAll", async ({ where }) => {
    assert.equal(where.assigneeId, 11);
    assert.equal(where.status[require("sequelize").Op.ne], "posted");
    return where.id ? rows.filter((p) => where.id.includes(p.id) && !changed) : rows;
  }, originals);
  patch(models.SocialPublishJob, "findAll", async ({ where }) => where.postId.includes(3) ? [{ postId: 3, status: "publishing" }] : [], originals);
  patch(models.SocialClient, "findAll", async () => [{ id: 7, name: "Demo" }], originals);
  patch(models.SocialPostEvent, "bulkCreate", async (events) => { history = events; }, originals);
  patch(models.sequelize, "transaction", async (fn) => fn({ LOCK: { UPDATE: "UPDATE" } }), originals);
  const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
  try {
    await reassignPending({ body, user: { id: 99 } }, response, (err) => { if (err) throw err; });
    return { response, writes, rows, history };
  } finally { for (const [obj, key, value] of originals.reverse()) obj[key] = value; }
}

test("preview shows eligible pending work and makes no changes", async () => {
  const { response, writes } = await run({ fromId: 11, toId: 22, preview: true });
  assert.deepEqual(response.value.posts.map((p) => p.id), [1]);
  assert.equal(response.value.skipped, 2);
  assert.equal(writes, 0);
});
test("transfer preserves content and other teammates and records reassignment", async () => {
  const { response, rows, history } = await run({ fromId: 11, toId: 22, postIds: [1] });
  assert.equal(response.value.transferred, 1);
  assert.equal(rows[0].assigneeId, 22);
  assert.deepEqual(rows[0].team, { graphic: 22, social: 33 });
  assert.equal(rows[0].status, "planned");
  assert.equal(rows[0].postDate, "2026-11-10");
  assert.deepEqual(rows[0].media, [{ url: "retained.jpg" }]);
  assert.equal(history[0].fromAssigneeId, 11);
  assert.equal(history[0].toAssigneeId, 22);
  assert.equal(history[0].fromStatus, history[0].toStatus);
});
test("changed assignments reject the complete transfer without writes", async () => {
  const { response, writes } = await run({ fromId: 11, toId: 22, postIds: [1] }, { changed: true });
  assert.equal(response.code, 409);
  assert.equal(writes, 0);
});
test("incompatible roles reject the complete transfer without writes", async () => {
  const { response, writes } = await run({ fromId: 11, toId: 22, postIds: [1, 2] });
  assert.equal(response.code, 409);
  assert.equal(writes, 0);
});
test("cannot transfer to the same person", async () => {
  const { response, writes } = await run({ fromId: 11, toId: 11, postIds: [1] });
  assert.equal(response.code, 400);
  assert.equal(writes, 0);
});
