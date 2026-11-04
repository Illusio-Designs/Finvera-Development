const { test } = require("node:test");
const assert = require("node:assert/strict");
const { prepareUpdate, contentHash, liveLink } = require("../src/utils/socialSafety");
const reviewer = { id: 33, roles: ["social"] };
const post = { id: 1, status: "ready", assigneeId: 33, caption: "Approved", media: [{ url: "https://example.test/a.jpg", type: "image" }], team: { social: 33 }, updatedAt: "2026-11-04T10:00:00Z" };
test("editing approved content returns it to review", () => {
  const next = prepareUpdate(post, { caption: "Changed", status: "ready" }, reviewer);
  assert.equal(next.status, "approval"); assert.equal(next.assigneeId, 33);
});
test("saving identical data does not revoke approval", () => assert.notEqual(prepareUpdate(post, { caption: "Approved" }, reviewer).status, "approval"));
test("maker cannot bypass review", () => assert.throws(() => prepareUpdate({ ...post, status: "approval" }, { status: "ready" }, { id: 11, roles: ["graphic"] }), { status: 403 }));
test("reviewer must approve saved content separately from edits", () => assert.throws(() => prepareUpdate({ ...post, status: "approval" }, { status: "ready", caption: "new" }, reviewer), { status: 409 }));
test("publishing locks all edits", () => assert.throws(() => prepareUpdate(post, { remarks: "new" }, reviewer, [{ status: "publishing" }]), { status: 409 }));
test("uncertain or partially published posts cannot silently change payload", () => {
  for (const status of ["published", "check"]) assert.throws(() => prepareUpdate(post, { caption: "new" }, reviewer, [{ status }]), { status: 409 });
});
test("stale editor cannot overwrite a newer post", () => assert.throws(() => prepareUpdate(post, { _expectedUpdatedAt: "2026-11-03T10:00:00Z" }, reviewer), { status: 409 }));
test("manual publication requires deliberate confirmation and a platform permalink", () => {
  assert.throws(() => prepareUpdate(post, { status: "posted" }, reviewer), { status: 400 });
  assert.equal(prepareUpdate(post, { status: "posted", _manualPosted: true, channels: "https://www.instagram.com/p/demo/" }, reviewer).status, "posted");
  assert.throws(() => prepareUpdate(post, { status: "posted", _manualPosted: true, channels: "https://www.instagram.com/p/demo/" }, reviewer, [{ platform: "facebook", status: "scheduled" }]), { status: 400 });
});
test("live links reject foreign domains and profile links", () => {
  assert.equal(liveLink("https://instagram.com.attacker.test/p/test", "instagram"), false);
  assert.equal(liveLink("https://instagram.com/person", "instagram"), false);
  assert.equal(liveLink("https://facebook.com/page/posts/123", "facebook"), true);
});
test("hash is stable for database JSON serialization", () => {
  assert.equal(contentHash(post), contentHash({ ...post, media: JSON.stringify([{ type: "image", url: "https://example.test/a.jpg" }]) }));
});
test("Need requires a description of missing client input", () => assert.throws(() => prepareUpdate({ ...post, status: "planned" }, { status: "client" }, reviewer), { status: 400 }));
test("artwork edits cannot store executable URLs", () => assert.throws(() => prepareUpdate(post, { media: [{ url: "javascript:alert(1)", type: "image" }] }, reviewer), { status: 400 }));
test("profile tagging rejects full names rather than guessing handles", () => assert.throws(() => prepareUpdate(post, { tags: "John Smith" }, reviewer), { status: 400 }));

test("Facebook live permits Instagram-only tag corrections and requires review", () => {
  const jobs = [{ platform: "facebook", status: "published" }, { platform: "instagram", status: "failed", checkpoint: {} }];
  assert.equal(prepareUpdate(post, { tags: "@creator" }, reviewer, jobs).status, "approval");
  assert.equal(prepareUpdate(post, { media: [{ ...post.media[0], userTags: [{ username: "creator", x: 0.5, y: 0.5 }] }] }, reviewer, jobs).status, "approval");
  assert.throws(() => prepareUpdate(post, { tags: "creator", caption: "Changed" }, reviewer, jobs), { status: 409 });
  assert.throws(() => prepareUpdate(post, { tags: "creator" }, reviewer, [...jobs.slice(0, 1), { platform: "instagram", status: "failed", checkpoint: { publishCalled: true } }]), { status: 409 });
  assert.throws(() => prepareUpdate(post, { tags: "creator" }, reviewer, [{ platform: "instagram", status: "published" }]), { status: 409 });
});
