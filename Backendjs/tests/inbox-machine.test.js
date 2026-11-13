const { test } = require("node:test"), assert = require("node:assert/strict");
const machine = require("../src/utils/inboxMachine");
test("restoring spam makes it unread and allows conversion without retaining the spam reason", () => {
  const row = { isRead: false, isSpam: false };
  Object.assign(row, machine.spamPatch(row, true));
  assert.equal(machine.stateOf(row), "spam"); assert.equal(machine.conversionState(row), "blocked");
  Object.assign(row, machine.spamPatch(row, false));
  assert.equal(machine.stateOf(row), "unread"); assert.equal(row.spamReason, null);
  row.leadId = 1; assert.equal(machine.conversionState(row, null), "unconverted");
  assert.equal(machine.conversionState(row, { id: 1 }), "linked");
});
test("unavailable mail setup differs from a failed recorded delivery", () => {
  assert.equal(machine.deliveryState({ sent: false, reason: "not-configured" }), "unavailable");
  assert.equal(machine.deliveryState({ sent: false, reason: "timeout" }), "failed");
  assert.equal(machine.deliveryState({ sent: true }), "sent");
});
