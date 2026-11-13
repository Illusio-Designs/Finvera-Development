const { test } = require("node:test");
const assert = require("node:assert/strict");
const machine = require("../src/utils/socialPostMachine");
const { prepareUpdate } = require("../src/utils/socialSafety");

test("a post completes the maker, review and publication sequence", () => {
  let state = "planned";
  for (const [event, expected] of [["START", "production"], ["SUBMIT", "approval"], ["APPROVE", "ready"], ["CONFIRM_PUBLICATION", "posted"]]) {
    state = machine.transition(state, event);
    assert.equal(state, expected);
  }
  assert.equal(machine.transition(state, "START"), null);
  assert.equal(machine.canMove("posted", "planned"), false);
});

test("client input, requested revisions and revoked approval have explicit return paths", () => {
  assert.equal(machine.transition("planned", "REQUEST_CLIENT"), "client");
  assert.equal(machine.transition("client", "RETURN_TO_PLAN"), "planned");
  assert.equal(machine.transition("production", "REQUEST_CLIENT"), "client");
  assert.equal(machine.transition("approval", "REQUEST_CHANGES"), "production");
  assert.equal(machine.transition("ready", "REVOKE_APPROVAL"), "approval");
});

test("unknown states and prototype names cannot become workflow edges", () => {
  for (const state of ["unknown", "constructor", "__proto__", null]) {
    assert.equal(machine.isState(state), false);
    assert.equal(machine.canMove(state, "production"), false);
    assert.equal(machine.transition(state, "START"), null);
  }
  assert.equal(machine.transition("planned", "toString"), null);
});

test("API stage changes enforce the graph and still enforce guards on its valid edges", () => {
  const maker = { id: 11, roles: ["graphic"] };
  const planned = { status: "planned", assigneeId: 11, media: [] };
  assert.throws(() => prepareUpdate(planned, { status: "approval" }, maker), { status: 409 });
  assert.equal(prepareUpdate(planned, { status: "production" }, maker).status, "production");
  assert.throws(() => prepareUpdate({ ...planned, assigneeId: null }, { status: "production" }, maker), { status: 400 });
  assert.throws(() => prepareUpdate({ ...planned, status: "production" }, { status: "approval" }, maker), { status: 400 });
  assert.throws(() => prepareUpdate({ ...planned, status: "approval" }, { status: "ready" }, maker), { status: 403 });
  assert.throws(() => prepareUpdate({ ...planned, status: "ready" }, { status: "posted" }, maker), { status: 400 });
});
