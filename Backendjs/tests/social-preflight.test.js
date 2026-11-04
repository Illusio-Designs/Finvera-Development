const { test } = require("node:test");
const assert = require("node:assert/strict");
const { preflight } = require("../src/utils/socialPreflight");
const { deletionProblem } = require("../src/utils/socialDelete");
const { prepareUpdate } = require("../src/utils/socialSafety");
const { goLiveAt, isOverdue } = require("../src/utils/socialDeadline");
const post = { status: "approval", assigneeId: 1, format: "Post", postDate: "2026-11-10", postTime: "10:00", tags: "@creator", media: [{ type: "image", url: "https://example.test/1.jpg" }] };
const admin = { id: 1, roles: ["admin"] };
test("approval catches imported invalid tag text before scheduling", () => {
  assert.throws(() => prepareUpdate({ ...post, tags: "Illusio Designs" }, { status: "ready" }, admin), /Invalid Instagram tag/);
  assert.equal(prepareUpdate(post, { status: "ready" }, admin).status, "ready");
});
test("Story publishing is blocked while manual approval remains available", () => {
  assert.match(preflight({ ...post, format: "Story" })[0].message, /Story auto-publishing/);
  assert.deepEqual(preflight({ ...post, format: "Story", publishTo: [] }, []), []);
});
test("reels and Facebook mixed media have platform-specific requirements", () => {
  assert.ok(preflight({ ...post, format: "Reel" }, ["instagram"]).some((issue) => /exactly one video/.test(issue.message)));
  assert.ok(preflight({ ...post, media: [...post.media, { type: "video", url: "https://example.test/a.mp4" }] }, ["facebook"]).some((issue) => /one video/.test(issue.message)));
});
test("malformed legacy artwork produces issues rather than crashing", () => {
  assert.ok(preflight({ ...post, media: [null] }).length);
  assert.ok(preflight({ ...post, media: [{ url: "javascript:alert(1)" }] }).some((issue) => /HTTPS/.test(issue.message)));
});
test("stage skipping and unowned work cannot bypass the normal workflow", () => {
  assert.throws(() => prepareUpdate({ ...post, status: "planned" }, { status: "approval" }, admin), /cannot be skipped/);
  assert.throws(() => prepareUpdate({ ...post, status: "planned", assigneeId: null }, { status: "production" }, admin), /person responsible/);
  assert.throws(() => prepareUpdate({ ...post, status: "production", media: [] }, { status: "approval" }, admin), /Upload the finished work/);
  assert.equal(prepareUpdate({ ...post, status: "planned" }, { status: "production" }, admin).status, "production");
});
test("published Facebook never blocks approval of corrected unpublished Instagram tags", () => {
  const jobs = [{ platform: "facebook", status: "published" }, { platform: "instagram", status: "cancelled" }];
  assert.equal(prepareUpdate(post, { status: "ready" }, admin, jobs).status, "ready");
});
test("deleting a batch is blocked if any result is live, in flight or uncertain", () => {
  for (const status of ["publishing", "published", "check"]) assert.match(deletionProblem([{ status: "ready" }], [{ status }]), /live, publishing or uncertain/);
  assert.ok(deletionProblem([{ status: "posted" }], []));
  assert.ok(deletionProblem([{ status: "ready" }], [{ status: "failed", checkpoint: JSON.stringify({ publishCalled: true }) }]));
  assert.equal(deletionProblem([{ status: "planned" }], [{ status: "scheduled" }]), null);
});
test("go-live deadline is exact in IST, including the default time", () => {
  assert.equal(goLiveAt(post).toISOString(), "2026-11-10T04:30:00.000Z");
  assert.equal(goLiveAt({ postDate: post.postDate }).toISOString(), "2026-11-10T04:30:00.000Z");
  assert.equal(isOverdue(post, new Date("2026-11-10T04:29:59Z")), false);
  assert.equal(isOverdue(post, new Date("2026-11-10T04:30:01Z")), true);
  assert.equal(isOverdue({ ...post, status: "posted" }, new Date("2026-11-11")), false);
});
