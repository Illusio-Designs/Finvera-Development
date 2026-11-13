const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stateOf, advance } = require("../src/utils/publishCheckpointMachine");
test("Facebook checkpoints retain the live result across a cover failure and resume", () => {
  const cp = { approvedHash: "approved" };
  assert.equal(stateOf(cp), "empty");
  assert.equal(advance(cp, "ALLOCATE_VIDEO", { videoId: "video", uploadUrl: "upload" }), cp);
  assert.equal(stateOf(cp), "staged");
  advance(cp, "UPLOAD_COMPLETE"); assert.equal(stateOf(cp), "uploaded");
  advance(cp, "START_WRITE"); assert.equal(stateOf(cp), "write-started");
  advance(cp, "RECORD_VIDEO_RESULT", { publishedId: "live" });
  advance(cp, "CONFIRM_VIDEO", { publishedUrl: "permalink", coverPending: true });
  assert.equal(stateOf(cp), "cover-pending");
  advance(cp, "APPLY_COVER"); assert.equal(stateOf(cp), "published");
  assert.equal(cp.publishedId, "live"); assert.equal(cp.approvedHash, "approved"); assert.equal(cp.publishCalled, true);
});
test("Instagram stores its container before recording the uncertain write boundary", () => {
  const cp = {}; advance(cp, "STAGE_INSTAGRAM", { creationId: "container" });
  assert.equal(stateOf(cp), "staged"); assert.equal(cp.publishCalled, undefined);
  advance(cp, "START_WRITE"); assert.equal(stateOf(cp), "write-started"); assert.equal(cp.creationId, "container");
  assert.throws(() => advance(cp, "UNKNOWN"), /Unknown publishing checkpoint/);
});
