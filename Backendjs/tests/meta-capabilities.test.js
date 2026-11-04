const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkCapabilities } = require("../src/utils/metaCapabilities");
const acc = { client: "Demo", status: "connected", pageId: "123", igUserId: "456", igUsername: "demo", pageToken: "opaque-test-value" };
const action = (data, id) => data.actions.find((a) => a.id === id);
const adapter = (scopes, extra = {}) => ({ configured: () => true, decrypt: () => "test-only-token", graph: async (method, path) => {
  assert.equal(method, "GET");
  return path === "/debug_token" ? { data: { is_valid: true, scopes, ...extra } } : { id: "123" };
} });
test("scope presence is not labeled a verified profile write or publish", async () => {
  const data = await checkCapabilities(acc, "facebook", adapter(["pages_manage_metadata", "pages_manage_posts"]));
  assert.equal(action(data, "view").state, "verified");
  assert.equal(action(data, "edit").state, "permission_granted");
  assert.equal(action(data, "publish").state, "permission_granted");
  assert.equal(data.writeTestsPerformed, false);
  assert.equal(JSON.stringify(data).includes("test-only-token"), false);
});
test("missing scopes are explicit", async () => {
  const data = await checkCapabilities(acc, "facebook", adapter([]));
  assert.equal(action(data, "edit").state, "missing_permission");
});
test("Instagram edit opens the platform and media tags are not implemented", async () => {
  const data = await checkCapabilities(acc, "instagram", adapter(["instagram_basic", "instagram_content_publish"]));
  assert.equal(action(data, "edit").state, "external");
  assert.equal(action(data, "mediaTags").state, "not_implemented");
  assert.equal(action(data, "open").url, "https://www.instagram.com/demo/");
});
test("network failures remain unknown rather than claiming missing permission", async () => {
  const data = await checkCapabilities(acc, "facebook", { configured: () => true, decrypt: () => "test", graph: async () => { throw Error("offline"); } });
  assert.equal(action(data, "publish").state, "unknown");
});
test("granular grants for another asset do not authorize this Page", async () => {
  const data = await checkCapabilities(acc, "facebook", adapter(["pages_manage_posts"], { granular_scopes: [{ scope: "pages_manage_posts", target_ids: ["unrelated"] }] }));
  assert.equal(action(data, "publish").state, "missing_permission");
});
test("expired data access is not reported as a verified token", async () => {
  const data = await checkCapabilities(acc, "facebook", adapter(["pages_manage_posts"], { data_access_expires_at: 1 }));
  assert.equal(action(data, "token").state, "unavailable");
});
test("missing app configuration makes no remote or decryption calls", async () => {
  const data = await checkCapabilities(acc, "facebook", { configured: () => false, decrypt: () => { throw Error("must not be called"); } });
  assert.equal(action(data, "token").state, "unknown");
  assert.equal(action(data, "open").state, "available");
});
