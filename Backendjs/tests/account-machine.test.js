const { test } = require("node:test");
const assert = require("node:assert/strict");
const machine = require("../src/utils/accountMachine");
test("five failures in the window lock the account and successful login clears lock data", () => {
  const now = Date.parse("2026-11-13T10:00:00Z");
  const user = { active: true, ...machine.resetFailures() };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = machine.failureAfter(user, now + attempt);
    assert.equal(result.locked, attempt === 5); Object.assign(user, result.patch);
  }
  assert.equal(machine.statusOf(user, now + 6), "locked");
  assert.equal(machine.statusOf(user, now + 5 + machine.LOCK_MS), "active");
  Object.assign(user, machine.resetFailures()); assert.equal(machine.statusOf(user, now), "active");
});
test("the failed-login window resets only after its existing strict boundary", () => {
  const now = Date.parse("2026-11-13T10:00:00Z");
  const user = { failedLogins: 3, firstFailedAt: new Date(now), lockedUntil: null };
  assert.equal(machine.failureAfter(user, now + machine.FAIL_WINDOW_MS).patch.failedLogins, 4);
  assert.equal(machine.failureAfter(user, now + machine.FAIL_WINDOW_MS + 1).patch.failedLogins, 1);
});
test("display precedence does not conflate invitation, deactivation and lockout", () => {
  const user = { active: false, invitePending: true, lockedUntil: new Date(Date.now() + 60000) };
  assert.equal(machine.statusOf(user), "deactivated"); user.active = true;
  assert.equal(machine.statusOf(user), "invited"); assert.equal(machine.isLocked(user), true);
  assert.equal(machine.afterPassword({ twoFactorEnabled: true }), "second-factor");
  assert.equal(machine.afterPassword({ twoFactorEnabled: false }), "session");
});
