const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stateOf, revokeApproval } = require("../src/utils/socialReviewMachine");
test("publishing and live outcomes override editable workflow stages", () => {
  for (const status of ["planned", "approval", "ready", "posted"]) {
    assert.equal(stateOf({ status }, [{ status: "publishing" }]), "publishing");
    assert.equal(stateOf({ status }, [{ status: "failed", checkpoint: '{"publishCalled":true}' }]), "live");
  }
  assert.equal(stateOf({ status: "ready" }), "approved");
  assert.equal(stateOf({ status: "approval" }), "review");
  assert.equal(stateOf({ status: "production" }), "draft");
});
test("revoking approval restores the selected reviewer and clears the production step", () => {
  assert.deepEqual(revokeApproval({ status: "ready", team: '{"social":33}', assigneeId: 11 }), { status: "approval", step: null, assigneeId: 33 });
  assert.equal(revokeApproval({ status: "ready", assigneeId: 11 }).assigneeId, 11);
  assert.throws(() => revokeApproval({ status: "posted" }), { status: 409 });
});
