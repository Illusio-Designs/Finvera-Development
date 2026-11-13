const { test } = require("node:test");
const assert = require("node:assert/strict");
const { actionPatch, reminderLabel } = require("../src/utils/renewalMachine");
test("renewing reactivates a record without forcing an invoice when declined", () => {
  const row = { status: "cancelled", cycle: "monthly", renewalDate: "2026-01-31" };
  assert.deepEqual(actionPatch(row, "renew", { today: "2026-01-15", invoiced: false }), { status: "active", renewalDate: "2026-02-28" });
  assert.deepEqual(actionPatch(row, "end"), { status: "cancelled" });
  assert.deepEqual(actionPatch(row, "restore"), { status: "active" });
});
test("reminders retain selected due offsets rather than sending every day", () => {
  const row = { status: "active", renewalDate: "2026-11-13" };
  assert.equal(reminderLabel(row, "2026-11-06"), "Renewal due in 7 days");
  assert.equal(reminderLabel(row, "2026-11-11"), null);
  assert.equal(reminderLabel(row, "2026-11-14"), "Renewal overdue");
  assert.equal(reminderLabel(row, "2026-11-15"), null);
  assert.equal(reminderLabel({ ...row, status: "paused" }, "2026-11-13"), null);
});
