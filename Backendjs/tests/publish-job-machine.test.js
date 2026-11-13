const { test } = require("node:test");
const assert = require("node:assert/strict");
const machine = require("../src/utils/publishJobMachine");

test("publication succeeds through a lease claim and cannot be republished", () => {
  const publishing = machine.transition("scheduled", "CLAIM");
  assert.equal(publishing, "publishing");
  assert.equal(machine.transition(publishing, "SUCCESS"), "published");
  assert.throws(() => machine.transition("published", "PUBLISH_NOW"), { status: 409 });
  assert.throws(() => machine.transition("published", "RETRY"), { status: 409 });
  assert.equal(machine.transition("published", "CONFIRM"), "published");
});

test("automatic retry is available only before an uncertain publishing outcome", () => {
  assert.equal(machine.transition("publishing", "RETRY_LATER"), "scheduled");
  assert.equal(machine.transition("publishing", "UNCERTAIN"), "check");
  assert.throws(() => machine.transition("check", "RETRY_LATER"), { status: 409 });
  assert.equal(machine.retryKind({ status: "check", checkpoint: {} }), "verify");
  assert.equal(machine.retryKind({ status: "failed", checkpoint: { publishCalled: true } }), "verify");
  assert.equal(machine.retryKind({ status: "failed", checkpoint: "broken json" }), "verify");
});

test("lease recovery distinguishes interruption before and after the remote write", () => {
  for (const [checkpoint, target] of [[{}, "scheduled"], [{ creationId: "container" }, "scheduled"], [{ publishCalled: true }, "check"]]) {
    assert.equal(machine.transition("publishing", machine.recoveryEvent(checkpoint)), target);
  }
});

test("cover-only retry requires the complete confirmed Facebook Reel checkpoint", () => {
  const checkpoint = { publishCalled: true, publishedConfirmed: true, coverPending: true, publishedId: "live", videoId: "video" };
  assert.equal(machine.retryKind({ status: "failed", platform: "facebook", checkpoint }), "cover");
  assert.equal(machine.retryKind({ status: "failed", platform: "instagram", checkpoint }), "verify");
  assert.equal(machine.retryKind({ status: "failed", platform: "facebook", checkpoint: { ...checkpoint, videoId: null } }), "verify");
  assert.equal(machine.retryKind({ status: "published", platform: "facebook", checkpoint }), "forbidden");
});

test("post settlement requires every intended platform and at least one result", () => {
  assert.equal(machine.publicationState([]), "none");
  assert.equal(machine.publicationState([{ status: "cancelled" }]), "none");
  assert.equal(machine.publicationState([{ status: "scheduled" }]), "pending");
  for (const status of ["scheduled", "publishing", "check", "failed", "missed"]) {
    assert.equal(machine.publicationState([{ status: "published" }, { status }]), "partial");
  }
  assert.equal(machine.publicationState([{ status: "published" }, { status: "cancelled" }]), "complete");
});

test("unknown persisted states and event names cannot select a transition", () => {
  for (const state of ["unknown", "constructor", "__proto__"]) assert.throws(() => machine.transition(state, "CLAIM"), { status: 409 });
  assert.throws(() => machine.transition("scheduled", "toString"), { status: 409 });
});
