const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { inspectMedia } = require("../src/utils/socialMediaHealth");
const { isRetryable, retryCheckpoint } = require("../src/utils/autoPublish");

test("missing local artwork is identified without an external request", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "finvera-media-"));
  try {
    const result = await inspectMedia([{ url: "https://media.example.test/uploads/social/missing.jpg", type: "image" }], { publicUrl: "https://media.example.test", uploadDir: folder });
    assert.equal(result.files[0].localStatus, "missing");
    assert.match(result.files[0].problems[0], /Re-upload/);
    assert.equal(result.publicAccess, "not_verified");
  } finally { await fs.rm(folder, { recursive: true }); }
});
test("local JPEG check inspects bytes and does not claim Meta fetch succeeded", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "finvera-media-"));
  try {
    await fs.mkdir(path.join(folder, "social"));
    await fs.writeFile(path.join(folder, "social", "art.jpg"), Buffer.from([255, 216, 255, 224]));
    const result = await inspectMedia([{ url: "https://media.example.test/uploads/social/art.jpg", type: "image" }], { publicUrl: "https://media.example.test", uploadDir: folder });
    assert.equal(result.files[0].localStatus, "available");
    assert.equal(result.files[0].jpeg, true);
    assert.equal(result.files[0].publicAccess, "not_verified");
  } finally { await fs.rm(folder, { recursive: true }); }
});
test("JPEG extension does not disguise non-JPEG bytes", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "finvera-media-"));
  try {
    await fs.mkdir(path.join(folder, "social"));
    await fs.writeFile(path.join(folder, "social", "art.jpg"), "<html>Access denied</html>");
    const result = await inspectMedia([{ url: "https://media.example.test/uploads/social/art.jpg", type: "image" }], { publicUrl: "https://media.example.test", uploadDir: folder });
    assert.equal(result.files[0].jpeg, false);
  } finally { await fs.rm(folder, { recursive: true }); }
});
test("external hosts are never fetched or mapped onto local files", async () => {
  const result = await inspectMedia([{ url: "https://external.example.test/uploads/social/art.jpg" }], { publicUrl: "https://media.example.test" });
  assert.equal(result.files[0].localStatus, "not_checked");
});
test("insecure and localhost media URLs explain why Meta cannot use them", async () => {
  const result = await inspectMedia([{ url: "http://localhost:5000/uploads/social/art.jpg" }]);
  assert.equal(result.files[0].problems.length, 2);
});
test("the observed fetch error is retryable while validation errors are not", () => {
  assert.equal(isRetryable(new Error("The media could not be fetched from this URI: https://media.example.test/art.jpg")), true);
  assert.equal(isRetryable(new Error("Unsupported image aspect ratio")), false);
});
test("a failed media container is replaced only before publishing was called", () => {
  const checkpoint = { creationId: "failed-container", approvedHash: "saved-version" };
  const next = retryCheckpoint(checkpoint, "The media could not be fetched from this URI: https://example.test/art.jpg");
  assert.equal(next.creationId, undefined);
  assert.equal(next.approvedHash, "saved-version");
  assert.equal(checkpoint.creationId, "failed-container");
});
test("uncertain published checkpoints are never automatically cleared", () => {
  const checkpoint = { creationId: "container", publishCalled: true };
  assert.equal(retryCheckpoint(checkpoint, "The media could not be fetched from this URI"), checkpoint);
});
