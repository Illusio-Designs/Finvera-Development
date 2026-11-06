const { test } = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const auto = require("../src/utils/autoPublish");
const controller = require("../src/controllers/publish.controller");

async function invoke(method, { status = "ready", jobStatus = "check", checkpoint = { publishCalled: true, creationId: "old" }, body = {}, platform = "instagram", user = { id: 99, roles: ["admin"] } } = {}) {
  let writes = 0;
  const post = { id: 1, client: "Demo", status, assigneeId: 33, caption: "approved", media: [], publishTo: ["instagram"] };
  const job = { id: 2, postId: 1, client: "Demo", platform, status: jobStatus, checkpoint, update: async (data) => { writes++; Object.assign(job, data); } };
  const originals = [];
  const patch = (obj, key, value) => { originals.push([obj, key, obj[key]]); obj[key] = value; };
  patch(models.sequelize, "transaction", async (fn) => fn({ LOCK: { UPDATE: "UPDATE" } }));
  patch(models.SocialPost, "findByPk", async () => post);
  patch(models.SocialPublishJob, "findByPk", async () => job);
  patch(models.SocialPublishJob, "findAll", async () => [job]);
  patch(models.SocialAccount, "findOne", async () => ({ status: "connected", igUserId: "test-only", paused: [] }));
  patch(auto, "runDue", async () => {});
  patch(require("../src/utils/audit"), "record", () => {});
  const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
  try {
    await controller[method]({ params: { id: method === "publishNow" ? 1 : 2 }, body, user, socialScope: null }, response, (err) => { if (err) throw err; });
    await new Promise((resolve) => setImmediate(resolve));
    return { response, writes, job };
  } finally { for (const [obj, key, value] of originals.reverse()) obj[key] = value; }
}
test("Publish now cannot bypass approval", async () => {
  const result = await invoke("publishNow", { status: "planned" });
  assert.equal(result.response.code, 403); assert.equal(result.writes, 0);
});
test("Publish now cannot reset an uncertain result", async () => {
  const result = await invoke("publishNow");
  assert.equal(result.response.code, 409); assert.equal(result.writes, 0);
});
test("Retry cannot reset an uncertain result without explicit confirmation", async () => {
  const result = await invoke("retry");
  assert.equal(result.response.code, 409); assert.equal(result.writes, 0);
});
test("Only an admin can authorize reattempting an absent uncertain post", async () => {
  const result = await invoke("retry", { body: { confirmedAbsent: true }, user: { id: 33, roles: ["social"] } });
  assert.equal(result.response.code, 409); assert.equal(result.writes, 0);
});
test("Admin absence confirmation is recorded with the replacement checkpoint", async () => {
  const result = await invoke("retry", { body: { confirmedAbsent: true } });
  assert.equal(result.response.code, 200); assert.equal(result.job.status, "scheduled");
  assert.equal(result.job.checkpoint.absenceConfirmedBy, 99); assert.equal(result.job.checkpoint.creationId, undefined);
});
test("Retry preserves a safe pre-publish checkpoint", async () => {
  const result = await invoke("retry", { jobStatus: "failed", checkpoint: { creationId: "existing-container" } });
  assert.equal(result.response.code, 200); assert.equal(result.job.checkpoint.creationId, "existing-container");
});
test("Serialized uncertain checkpoints cannot bypass the guard", async () => {
  const result = await invoke("retry", { jobStatus: "failed", checkpoint: JSON.stringify({ publishCalled: true }) });
  assert.equal(result.response.code, 409); assert.equal(result.writes, 0);
});
test("Manual publication confirmation requires a live permalink", async () => {
  const result = await invoke("markPosted", { body: { url: "" } });
  assert.equal(result.response.code, 400); assert.equal(result.writes, 0);
});

test("a confirmed live Facebook Reel can retry only its pending cover without absence confirmation", async () => {
  const checkpoint = { publishCalled: true, publishedConfirmed: true, publishedId: "live-video", videoId: "live-video", coverPending: true, uploaded: true };
  const result = await invoke("retry", { platform: "facebook", jobStatus: "failed", checkpoint });
  assert.equal(result.response.code, 200); assert.equal(result.job.checkpoint.publishedId, "live-video"); assert.equal(result.job.checkpoint.coverPending, true);
});
