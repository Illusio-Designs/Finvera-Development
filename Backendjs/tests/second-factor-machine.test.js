const { test } = require("node:test");
const assert = require("node:assert/strict");
const machine = require("../src/utils/secondFactorMachine");
test("enrollment, code replacement and disable preserve orthogonal configuration fields", () => {
  const user = {};
  assert.equal(machine.stateOf(user), "disabled");
  Object.assign(user, machine.configurationEvent("SETUP", { secret: "encrypted" }));
  assert.equal(machine.stateOf(user), "setup");
  Object.assign(user, machine.configurationEvent("ENABLE", { hashes: ["old"] }));
  assert.equal(machine.stateOf(user), "enabled");
  Object.assign(user, machine.configurationEvent("RENEW_CODES", { hashes: ["new"] }));
  assert.deepEqual(user.twoFactorBackup, ["new"]); assert.equal(user.twoFactorSecret, "encrypted");
  Object.assign(user, machine.configurationEvent("DISABLE"));
  assert.equal(machine.stateOf(user), "disabled"); assert.equal(user.twoFactorBackup, null);
});
test("backup hashes and successful second-factor tickets are consumed once", () => {
  assert.deepEqual(machine.consumeBackup(["a", "b"], "a"), ["b"]);
  assert.equal(machine.consumeBackup(["b"], "a"), null);
  const guard = machine.createReplayGuard();
  assert.equal(guard.spendTicket("ticket", 100), true); assert.equal(guard.spendTicket("ticket", 100), false);
  assert.equal(guard.acceptStep(1, 200), true); assert.equal(guard.acceptStep(1, 200), false);
  assert.equal(guard.acceptStep(1, 199), false); assert.equal(guard.acceptStep(2, 200), true);
  guard.rememberStep(1, 201); assert.equal(guard.acceptStep(1, 201), false);
});
