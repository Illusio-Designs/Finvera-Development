const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { Notification, PushSubscription, User, sequelize, SocialPost, SocialPublishJob } = require("../src/models");
const webpush = require("../src/utils/webpush");
const { notifyByName, notifyRoles, notifyAdmins, notifyUsers, pushEnabled } = require("../src/utils/notify");
const pushController = require("../src/controllers/push.controller");
const { afterPublished } = require("../src/utils/autoPublish");
const social = require("../src/controllers/social.controller");

const drain = () => new Promise((resolve) => setImmediate(resolve));
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } });
const fail = (error) => { throw error; };

test("a test push is scoped to the authenticated user's selected device", async (t) => {
  const endpoint = "https://push.example.test/current";
  const endpointHash = createHash("sha256").update(endpoint).digest("hex");
  t.mock.method(User, "findByPk", async () => ({ active: true, emailPrefs: { notificationPush: { general: false } } }));
  t.mock.method(Notification, "count", async () => 3);
  const subscription = { update: async () => {} };
  const find = t.mock.method(PushSubscription, "findAll", async ({ where }) => {
    return where.userId === 7 && where.endpointHash === endpointHash ? [subscription] : [];
  });
  const send = t.mock.method(webpush, "send", async () => 201);

  const missing = response();
  await pushController.test({ user: { id: 7 } }, missing, fail);
  assert.equal(missing.code, 400);
  assert.equal(find.mock.callCount(), 0);
  const other = response();
  await pushController.test({ user: { id: 8 }, body: { endpoint } }, other, fail);
  assert.equal(other.value.sent, 0);
  const selected = response();
  await pushController.test({ user: { id: 7 }, body: { endpoint } }, selected, fail);
  assert.deepEqual(selected.value, { sent: 1, devices: 1 });
  assert.equal(send.mock.callCount(), 1);
  const [, message, options] = send.mock.calls[0].arguments;
  assert.equal(message.tag, "push-test");
  assert.equal(message.badge, 3);
  assert.equal(options.topic, "push-test");
});

test("an assigned owner is excluded from the general lead alert and overlapping post recipients are deduplicated", async (t) => {
  const owner = { id: 2, active: true, roles: ["admin", "leads"] };
  t.mock.method(User, "findOne", async () => owner);
  t.mock.method(User, "findAll", async () => [owner, { id: 3, roles: ["leads"] }, { id: 1, roles: ["admin"] }]);
  t.mock.method(User, "findByPk", async () => null);
  const writes = t.mock.method(Notification, "bulkCreate", async (rows) => rows.map((row) => ({ toJSON: () => row })));
  const assignedTo = await notifyByName("Owner", { title: "Assigned", type: "assigned" }, 1);
  await notifyRoles(["leads"], { title: "New lead", type: "lead" }, [1, assignedTo]);
  await notifyAdmins({ title: "Posted", type: "done" }, 1, { alsoUserIds: [owner.id, 4] });
  assert.deepEqual(writes.mock.calls.map(({ arguments: [rows] }) => rows.map((row) => row.userId)), [[2], [3], [2, 4]]);
  await drain();
});

test("concurrent edits merge into one unread notification and one push", async (t) => {
  const rows = [];
  let previous = Promise.resolve();
  t.mock.method(sequelize, "transaction", async (fn) => {
    const next = previous.then(() => fn({ LOCK: { UPDATE: "update" } }));
    previous = next;
    return next;
  });
  t.mock.method(User, "findByPk", async () => ({ active: true }));
  t.mock.method(Notification, "findAll", async () => rows);
  t.mock.method(Notification, "create", async (fields) => {
    const row = { id: 51, ...fields, toJSON: () => row, update: async (patch) => Object.assign(row, patch) };
    rows.push(row);
    return row;
  });
  t.mock.method(Notification, "count", async () => rows.length);
  t.mock.method(PushSubscription, "findAll", async () => [{ update: async () => {} }]);
  const send = t.mock.method(webpush, "send", async () => 201);
  const payload = { type: "update", title: "Post edited", link: "/dashboard/social?post=15" };
  const edit = (note) => notifyUsers([7], payload, 8, { merge: { key: "post-15", notes: [note], render: (notes) => notes.join(", ") } });
  await Promise.all([edit("Caption"), edit("Artwork")]);
  await drain();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].body, "Caption, Artwork");
  assert.equal(send.mock.callCount(), 1);
  assert.equal(send.mock.calls[0].arguments[1].tag, "n51");
  assert.equal(send.mock.calls[0].arguments[2].topic, "n51");
  assert.equal(pushEnabled({ emailPrefs: '{"notificationPush":{"calendar":false}}' }, { ...payload, url: payload.link }), false);
});

test("settling Facebook and Instagram twice records one completion while retaining live links", async (t) => {
  const post = { id: 15, status: "ready", client: "Demo", theme: "Launch", assigneeId: 4, update: async (patch) => Object.assign(post, patch) };
  let previous = Promise.resolve();
  t.mock.method(sequelize, "transaction", async (fn) => {
    const next = previous.then(() => fn({ LOCK: { UPDATE: "update" } }));
    previous = next;
    return next;
  });
  t.mock.method(SocialPost, "findByPk", async (id, { lock }) => { assert.equal(id, post.id); assert.equal(lock, "update"); return post; });
  t.mock.method(SocialPublishJob, "findAll", async () => [
    { status: "published", platform: "facebook", url: "https://www.facebook.com/post" },
    { status: "published", platform: "instagram", url: "https://www.instagram.com/p/post" },
  ]);
  t.mock.method(User, "findAll", async () => [{ id: 4, roles: ["admin"] }]);
  t.mock.method(User, "findByPk", async () => null);
  const history = t.mock.method(social, "recordEvents", async () => {});
  const notices = t.mock.method(Notification, "bulkCreate", async (rows) => rows.map((row) => ({ toJSON: () => row })));

  await Promise.all([afterPublished(post.id), afterPublished(post.id)]);
  await drain();
  assert.equal(post.status, "posted");
  assert.equal(post.channels, "https://www.facebook.com/post\nhttps://www.instagram.com/p/post");
  assert.equal(history.mock.callCount(), 1);
  assert.equal(notices.mock.callCount(), 1);
  assert.equal(notices.mock.calls[0].arguments[0].length, 1);
});
