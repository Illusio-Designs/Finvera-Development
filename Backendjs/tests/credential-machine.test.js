const { test } = require("node:test");
const assert = require("node:assert/strict");
const { linkState, sessionRejection, credentialEvent } = require("../src/utils/credentialMachine");
test("single-use links distinguish consumption from expiry without changing the boundary", () => {
  const row = { expiresAt: new Date(1000) };
  assert.equal(linkState(row, 1000), "usable"); assert.equal(linkState(row, 1001), "expired");
  assert.equal(linkState({ ...row, usedAt: new Date(900) }, 950), "consumed");
  assert.equal(linkState(null), "missing");
});
test("JWT-authenticated sessions still require an active matching nonrevoked account session", () => {
  const user = { id: 1, active: true }, payload = { jti: "session" };
  assert.equal(sessionRejection(payload, user, { userId: 1 }), null);
  assert.equal(sessionRejection(payload, user, { userId: 2 }), "session");
  assert.equal(sessionRejection(payload, user, { userId: 1, revokedAt: new Date() }), "session");
  assert.equal(sessionRejection(payload, { ...user, active: false }, null), "account");
  assert.equal(sessionRejection({ iat: 1 }, { ...user, tokensValidAfter: new Date(2000) }, null), "legacy");
});
test("password reset clears onboarding and lockout while admin-set preserves the required-change choice", () => {
  const reset = credentialEvent("RESET_PASSWORD");
  assert.equal(reset.invitePending, false); assert.equal(reset.mustChangePassword, false); assert.equal(reset.lockedUntil, null);
  assert.equal(Object.hasOwn(credentialEvent("ADMIN_SET_PASSWORD"), "mustChangePassword"), false);
  assert.equal(Object.hasOwn(credentialEvent("CHANGE_PASSWORD"), "invitePending"), false);
});
