const { test } = require("node:test");
const assert = require("node:assert/strict");
const { imageTags, imageParams, profileNames, postMediaWithTags } = require("../src/utils/instagramTags");
test("positioned image tags are serialized into Meta's user_tags field", () => {
  const params = imageParams({ url: "https://example.test/art.jpg", userTags: [{ username: "@creator", x: 0.2, y: 0.8 }] }, { caption: "Saved caption" });
  assert.deepEqual(JSON.parse(params.user_tags), [{ username: "creator", x: 0.2, y: 0.8 }]);
  assert.equal(params.image_url, "https://example.test/art.jpg"); assert.equal(params.caption, "Saved caption");
});
test("carousel child parameters retain image-specific tags", () => {
  const params = imageParams({ url: "https://example.test/art.jpg", userTags: [{ username: "brand", x: 0.5, y: 0.5 }] }, { is_carousel_item: "true" });
  assert.equal(params.is_carousel_item, "true"); assert.equal(JSON.parse(params.user_tags)[0].username, "brand");
});
test("images without tags omit the optional Meta parameter", () => assert.equal(imageParams({ url: "https://example.test/art.jpg" }).user_tags, undefined));
test("invalid coordinates, duplicate names and oversized tag lists are rejected", () => {
  assert.throws(() => imageTags({ userTags: [{ username: "brand", x: 2, y: 0 }] }));
  assert.throws(() => imageTags({ userTags: [{ username: "brand", x: 0, y: 0 }, { username: "BRAND", x: 1, y: 1 }] }));
  assert.throws(() => imageTags({ userTags: Array.from({ length: 21 }, (_, i) => ({ username: `user${i}`, x: 0.5, y: 0.5 })) }));
});
test("People to tag usernames and profile URLs become publishing targets", () => {
  assert.deepEqual(profileNames("@creator, https://www.instagram.com/brand/, @creator,"), ["creator", "brand"]);
  const media = postMediaWithTags([{ url: "https://example.test/art.jpg", type: "image" }], "@creator");
  assert.deepEqual(JSON.parse(imageParams(media[0]).user_tags), [{ username: "creator", x: 0.5, y: 0.5 }]);
});
test("explicit positions override post-wide center placement", () => {
  const media = postMediaWithTags([{ url: "https://example.test/art.jpg", userTags: [{ username: "creator", x: 0.1, y: 0.9 }] }], "@creator, @brand");
  assert.deepEqual(media[0].userTags, [{ username: "creator", x: 0.1, y: 0.9 }, { username: "brand", x: 0.5, y: 0.5 }]);
});
test("post-wide image tags cannot silently disappear from a video-only post", () => assert.throws(() => postMediaWithTags([{ url: "https://example.test/reel.mp4", type: "video" }], "@creator")));
test("plain full names are not guessed as Instagram usernames", () => assert.throws(() => profileNames("John Smith")));

async function capturePublishing(media, profiles, check) {
  const https = require("node:https");
  const { EventEmitter } = require("node:events");
  const meta = require("../src/utils/meta");
  const original = https.request;
  const calls = [];
  let containers = 0;
  https.request = (options, callback) => {
    const request = new EventEmitter();
    let body = "";
    request.write = (chunk) => { body += chunk; };
    request.end = () => {
      const params = new URLSearchParams(body);
      calls.push({ method: options.method, path: options.path, params });
      let data;
      if (options.method === "POST") data = { id: options.path.includes("media_publish") ? "published-test" : `container-${++containers}` };
      else data = options.path.includes("status_code") ? { status_code: "FINISHED" } : { permalink: "https://www.instagram.com/p/test/" };
      queueMicrotask(() => { const response = new EventEmitter(); response.statusCode = 200; callback(response); response.emit("data", JSON.stringify(data)); response.emit("end"); });
    };
    return request;
  };
  try {
    const result = await meta.publishInstagram({ igUserId: "test-ig", pageToken: meta.encrypt("local-test-only") }, media, "Saved caption", {}, async () => {}, profiles);
    assert.equal(result.id, "published-test");
    check(calls);
  } finally { https.request = original; }
}

test("the actual Instagram publisher sends post-wide profile tags to Graph", async () => {
  await capturePublishing([{ url: "https://example.test/art.jpg", type: "image" }], "@creator", (calls) => {
    const image = calls.find((call) => call.params.has("image_url"));
    assert.deepEqual(JSON.parse(image.params.get("user_tags")), [{ username: "creator", x: 0.5, y: 0.5 }]);
    assert.equal(calls.filter((call) => call.path.includes("media_publish")).length, 1);
  });
});
test("the actual carousel publisher tags each child, not its parent container", async () => {
  await capturePublishing([{ url: "https://example.test/a.jpg", type: "image", userTags: [{ username: "creator", x: 0.2, y: 0.8 }] }, { url: "https://example.test/b.jpg", type: "image" }], "@brand", (calls) => {
    const children = calls.filter((call) => call.params.has("image_url"));
    assert.equal(children.length, 2);
    assert.equal(JSON.parse(children[0].params.get("user_tags"))[0].username, "creator");
    assert.equal(JSON.parse(children[1].params.get("user_tags"))[0].username, "brand");
    assert.equal(calls.find((call) => call.params.get("media_type") === "CAROUSEL").params.has("user_tags"), false);
  });
});

test("invalid legacy profile text explains which tag needs correction", () => {
  assert.throws(() => profileNames("Jane Doe"), /Invalid Instagram tag "Jane Doe".*display name/);
  assert.throws(() => imageTags({ userTags: [{ username: "#brand", x: 0.5, y: 0.5 }] }), /Invalid Instagram tag "#brand"/);
  assert.deepEqual(profileNames(""), []);
});
