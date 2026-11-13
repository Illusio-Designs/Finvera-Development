const { test } = require("node:test"), assert = require("node:assert/strict");
const { createSingleFlight, createReadCache, createSerialQueue } = require("../src/utils/asyncMachine");
const { artifactState } = require("../src/utils/backupArtifactMachine");
test("overlapping work shares its promise and failure releases the runner", async () => {
  const flight = createSingleFlight(); let reject;
  const first = flight.run(() => new Promise((_, fail) => { reject = fail; }));
  assert.equal(flight.run(() => { throw new Error("must not start"); }), first);
  reject(new Error("failed")); await assert.rejects(first, /failed/); assert.equal(flight.busy, false);
  assert.equal(await flight.run(async () => "retry"), "retry");
});
test("cache invalidation during a read cannot restore stale results or evict its replacement", async () => {
  let time = 0, complete;
  const cache = createReadCache(100, 10, () => time);
  const old = cache.get("key", () => new Promise(resolve => { complete = resolve; }));
  cache.clear(); const fresh = cache.get("key", async () => "new");
  complete("old"); await old; assert.equal(cache.get("key", () => { throw new Error("cached"); }), fresh);
  time = 100; assert.equal(await cache.get("key", async () => "expired"), "expired");
  await assert.rejects(cache.get("bad", async () => { throw new Error("failure"); }));
  assert.equal(await cache.get("bad", async () => "retry"), "retry");
});
test("only completed backup names are eligible for serving", () => {
  const name = "finvera-20261113-023000-auto.sql.gz";
  assert.equal(artifactState(name), "archive"); assert.equal(artifactState(name + ".partial"), "partial");
  assert.equal(artifactState("../" + name), "other"); assert.equal(artifactState("arbitrary.sql.gz"), "other");
});
test("a failed conversion releases the serial queue without starting the next conversion early", async () => {
  const queue = createSerialQueue(), events = []; let release;
  const first = queue.enqueue(async () => { events.push("first"); await new Promise(resolve => { release = resolve; }); throw new Error("conversion failed"); });
  const second = queue.enqueue(async () => { events.push("second"); return "converted"; });
  await Promise.resolve(); assert.deepEqual(events, ["first"]); assert.equal(queue.phase, "running");
  release(); await assert.rejects(first, /conversion failed/); assert.equal(await second, "converted");
  assert.deepEqual(events, ["first", "second"]); assert.equal(queue.phase, "idle");
});
