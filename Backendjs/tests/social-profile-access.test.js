const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { User, SocialClient, SocialAccount } = require("../src/models");
const meta = require("../src/utils/meta");
const router = require("../src/routes");

test("Facebook Page edits require admin or social manager access to the brand", async (t) => {
  const secret = "fixture-social-profile-access";
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const users = new Map([
    [11, { roles: ["social"], socialClients: [101] }],
    [12, { roles: ["graphic"], socialClients: [101] }],
    [13, { roles: ["admin"], socialClients: [] }],
    [14, { roles: ["social"], socialClients: [] }],
  ]);
  t.mock.method(User, "findByPk", async (id) => ({ id, active: true, ...users.get(id) }));
  t.mock.method(SocialClient, "findAll", async ({ where }) => where.id.includes("101") ? [{ name: "Assigned Brand" }] : []);
  const accounts = ["Assigned Brand", "Other Brand"].map(client => ({ client, update: async () => {} }));
  t.mock.method(SocialAccount, "findOne", async ({ where }) => accounts.find(account => account.client.toLowerCase() === where.client.toLowerCase()));
  const write = t.mock.method(meta, "updatePage", async () => {});
  t.mock.method(meta, "profileDetails", async (account, platform) => ({ name: account.client, platform }));

  const app = express();
  app.use(express.json(), router);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, "listening");
  const send = (id, brand, suffix = "/profile", method = "PUT") => fetch(`http://127.0.0.1:${server.address().port}/social-accounts/${encodeURIComponent(brand)}${suffix}`, {
    method,
    headers: { Authorization: `Bearer ${jwt.sign({ id }, secret)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ about: "Updated about text" }),
  });

  const assigned = await send(11, "assigned brand");
  assert.equal(assigned.status, 200);
  assert.deepEqual(await assigned.json(), { name: "Assigned Brand", platform: "facebook" });
  assert.equal((await send(11, "Other Brand")).status, 404);
  assert.equal((await send(14, "Assigned Brand")).status, 404);
  assert.equal((await send(12, "Assigned Brand")).status, 403);
  assert.equal((await send(11, "Assigned Brand", "/pause", "POST")).status, 403);
  assert.equal((await send(13, "Other Brand")).status, 200);
  assert.deepEqual(write.mock.calls.map(({ arguments: [account, fields] }) => [account.client, fields.about]), [
    ["Assigned Brand", "Updated about text"], ["Other Brand", "Updated about text"],
  ]);
});
