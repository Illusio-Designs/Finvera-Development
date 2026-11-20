const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAuthUrl, SCOPES } = require("../src/utils/meta");

test("Meta reconnect re-requests configured scopes using the same OAuth state", () => {
  const state = "signed-state";
  const first = new URL(buildAuthUrl(state)).searchParams;
  const reconnect = new URL(buildAuthUrl(state, { reconnect: true })).searchParams;
  assert.equal(first.get("auth_type"), null);
  assert.equal(reconnect.get("auth_type"), "rerequest");
  assert.equal(reconnect.get("state"), state);
  assert.deepEqual(reconnect.get("scope").split(","), SCOPES);
  assert.ok(SCOPES.includes("pages_manage_metadata"));
  assert.equal(reconnect.get("redirect_uri"), first.get("redirect_uri"));
});
