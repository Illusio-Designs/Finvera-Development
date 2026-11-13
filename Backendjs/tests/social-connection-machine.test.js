const { test } = require("node:test");
const assert = require("node:assert/strict");
const { targetsFor, pausedAfter, selectionState, connectionEvent } = require("../src/utils/socialConnectionMachine");
test("pause, resume and post target choices independently constrain connected channels", () => {
  const account = { status: "connected", igUserId: "ig", paused: [] };
  assert.deepEqual(targetsFor({}, account), ["instagram", "facebook"]);
  account.paused = pausedAfter(account.paused, "instagram", true);
  assert.deepEqual(targetsFor({}, account), ["facebook"]);
  assert.deepEqual(targetsFor({ publishTo: ["instagram"] }, account), []);
  account.paused = pausedAfter(JSON.stringify(account.paused), "instagram", false);
  assert.deepEqual(targetsFor({ publishTo: [] }, account), []);
  assert.deepEqual(targetsFor({ publishTo: '["instagram"]' }, account), ["instagram"]);
  assert.deepEqual(targetsFor({}, { ...account, status: "reconnect" }), []);
  assert.deepEqual(targetsFor({}, null), []);
});
test("OAuth selection preserves user ownership and its original expiry boundary", () => {
  const selection = { userId: 1, exp: 100 };
  assert.equal(selectionState(selection, 1, 100), "selectable");
  assert.equal(selectionState(selection, 1, 101), "expired");
  assert.equal(selectionState(selection, 2, 99), "other-user");
  assert.equal(selectionState(null, 1), "missing");
  assert.deepEqual(connectionEvent("CONNECT"), { status: "connected", lastError: null });
  assert.deepEqual(connectionEvent("AUTH_FAILURE"), { status: "reconnect" });
});
