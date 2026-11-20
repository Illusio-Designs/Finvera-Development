const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { test } = require("node:test");
const vm = require("node:vm");

function mockMeta(respond) {
  const file = require.resolve("../src/utils/meta");
  const localRequire = createRequire(file);
  const calls = [];
  const https = {
    request(options, onResponse) {
      const request = new EventEmitter();
      request.end = () => {
        const fields = new URL(options.path, "https://graph.facebook.com").searchParams.get("fields");
        calls.push(fields);
        const body = respond(fields);
        const response = new EventEmitter();
        response.statusCode = body.error ? 400 : 200;
        onResponse(response);
        response.emit("data", JSON.stringify(body));
        response.emit("end");
      };
      return request;
    },
  };
  const metaModule = { exports: {} };
  vm.runInNewContext(readFileSync(file, "utf8"), {
    module: metaModule, require: name => name === "https" ? https : localRequire(name), process, Buffer,
  }, { filename: file });
  const meta = metaModule.exports;
  return { meta, account: { pageToken: meta.encrypt("test-token") }, calls };
}

test("Facebook retains readable metrics and artwork when a requested field is denied", async () => {
  const { meta, account, calls } = mockMeta(fields => {
    if (fields.startsWith("reactions") && fields.includes("shares")) return { error: { code: 10 } };
    if (fields === "shares") return { error: { code: 10 } };
    if (fields.startsWith("reactions")) return { reactions: { summary: { total_count: 5 } } };
    if (fields.startsWith("comments")) return { comments: { summary: { total_count: 0 } } };
    return { full_picture: "https://scontent.fbcdn.net/creative.jpg" };
  });
  const metrics = await meta.fetchPostMetrics(account, "facebook", "123_456");
  assert.equal(calls.length, 5);
  assert.equal(metrics.likes, 5);
  assert.equal(metrics.comments, 0);
  assert.equal(metrics.shares, undefined);
  assert.equal(metrics.picture, "https://scontent.fbcdn.net/creative.jpg");
});

test("expired Facebook tokens do not trigger additional field requests", async () => {
  const { meta, account, calls } = mockMeta(() => ({ error: { code: 190 } }));
  await assert.rejects(meta.fetchPostMetrics(account, "facebook", "123_456"), error => error.meta.code === 190);
  assert.equal(calls.length, 1);
});

test("Instagram distinguishes omitted counts and video artwork from real zero counts", async () => {
  const { meta, account } = mockMeta(() => ({ comments_count: 0, media_type: "VIDEO", media_url: "https://cdninstagram.com/reel.mp4" }));
  const metrics = await meta.fetchPostMetrics(account, "instagram", "123");
  assert.equal(metrics.likes, undefined);
  assert.equal(metrics.comments, 0);
  assert.equal(metrics.picture, null);
});
