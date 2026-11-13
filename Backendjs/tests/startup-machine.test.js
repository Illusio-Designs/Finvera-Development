const { test } = require("node:test"), assert = require("node:assert/strict");
const { createStartupMachine } = require("../src/utils/startupMachine");
test("startup moves forward through optional provisioning stages and cannot resume after failure", () => {
  const machine = createStartupMachine(); machine.enter("connect"); machine.enter("columns");
  assert.equal(machine.phase, "columns");
  assert.throws(() => machine.enter("connect"), /Invalid startup/);
  machine.enter("reconcile"); machine.fail();
  assert.throws(() => machine.enter("listen"), /Invalid startup/);
});
