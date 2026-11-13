const { test } = require("node:test");
const assert = require("node:assert/strict");
const machine = require("../src/utils/leadMachine");
test("won timestamps follow entering/leaving won without restamping an existing win", () => {
  const now = new Date("2026-11-13T10:00:00Z");
  assert.equal(machine.wonAtAfter({ stage: "won" }, now), now);
  assert.equal(machine.wonAtAfter({ stage: "won", wonAt: "existing" }, now), "existing");
  assert.equal(machine.wonAtAfter({ stage: "proposal", wonAt: now }), null);
  assert.equal(machine.progressOfStage("won"), 100); assert.equal(machine.progressOfStage("lost"), 0);
});
test("closed leads do not enter follow-up deadline states", () => {
  const lead = { stage: "new", nextFollowUpAt: "2026-11-13" };
  assert.equal(machine.followUpState(lead, "2026-11-12"), "future");
  assert.equal(machine.followUpState(lead, "2026-11-13"), "today");
  assert.equal(machine.followUpState(lead, "2026-11-14"), "overdue");
  assert.equal(machine.followUpState({ ...lead, stage: "lost" }, "2026-11-14"), "closed");
});
