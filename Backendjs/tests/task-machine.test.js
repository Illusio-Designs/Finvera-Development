const { test } = require("node:test"), assert = require("node:assert/strict");
const { dailyState, runnerState, claimDate } = require("../src/utils/taskMachine");
test("a force request bypasses cooldown but never a running publisher", () => {
  assert.equal(runnerState(true, 100, 101, 20000, true), "running");
  assert.equal(runnerState(false, 100, 101, 20000), "cooldown");
  assert.equal(runnerState(false, 100, 101, 20000, true), "eligible");
  assert.equal(dailyState("day", 614, 615, null), "early");
  assert.equal(dailyState("day", 615, 615, "day"), "checked");
});
test("daily claim preserves the atomic conditional update and does not mean work succeeded", async () => {
  const { Setting } = require("../src/models");
  const oldFind = Setting.findOrCreate, oldUpdate = Setting.update;
  let saved = "";
  Setting.findOrCreate = async () => [];
  Setting.update = async ({ value }, options) => { assert.ok(Reflect.ownKeys(options.where).length > 1); const n = saved !== value ? 1 : 0; saved = value; return [n]; };
  try { assert.equal(await claimDate("test", "day1"), true); assert.equal(await claimDate("test", "day1"), false); assert.equal(await claimDate("test", "day2"), true); }
  finally { Setting.findOrCreate = oldFind; Setting.update = oldUpdate; }
});
