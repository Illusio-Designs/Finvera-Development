const { test } = require("node:test");
const assert = require("node:assert/strict");
const { completedAssignments } = require("../src/utils/socialPerformance");
const move = (from, to, who = 11, postId = 1) => ({ from, to, who, postId });

test("starting work, scheduling and reassignment do not count as completion", () => {
  assert.equal(completedAssignments([
    move("planned", "production"), move("approval", "ready"), move("production", "production"),
  ]).length, 0);
});
test("maker handoff and publishing credit their outgoing assignees", () => {
  const rows = completedAssignments([move("production", "approval", 11), move("ready", "posted", 33)]);
  assert.deepEqual(rows.map((r) => r.who), [11, 33]);
});
test("rework counts once per post and person using the latest completion", () => {
  const first = { ...move("production", "approval"), day: "2026-11-01" };
  const final = { ...move("production", "approval"), day: "2026-11-03" };
  assert.deepEqual(completedAssignments([first, move("approval", "production", 33), final]), [final]);
});
test("unassigned transitions cannot inflate team completion", () => {
  assert.equal(completedAssignments([move("production", "approval", null)]).length, 0);
});
test("KPI response uses go-live deadlines and current assignment ownership", async () => {
  const models = require("../src/models");
  const kpi = require("../src/controllers/kpi.controller");
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const events = [
    { id: 1, postId: 1, client: "Demo", fromStatus: "planned", toStatus: "production", fromAssigneeId: 11, toAssigneeId: 11, at: new Date() },
    { id: 2, postId: 1, client: "Demo", fromStatus: "production", toStatus: "approval", fromAssigneeId: 11, toAssigneeId: 33, postDate: yesterday, at: new Date() },
    { id: 3, postId: 1, client: "Demo", fromStatus: "approval", toStatus: "ready", fromAssigneeId: 33, toAssigneeId: 33, at: new Date() },
    { id: 4, postId: 2, client: "Demo", fromStatus: "production", toStatus: "approval", fromAssigneeId: 11, toAssigneeId: 33, postDate: null, at: new Date() },
  ];
  const patches = [
    [models.Setting, "findOrCreate", async () => [{}, false]],
    [models.Setting, "update", async () => [0]],
    [models.SocialPost, "findAll", async () => [
      { id: 1, client: "Demo", status: "ready", assigneeId: 33, postDate: yesterday },
      { id: 2, client: "Demo", status: "approval", assigneeId: 33, postDate: null },
    ]],
    [models.SocialPostEvent, "findAll", async () => events],
    [models.SocialPostEvent, "min", async () => new Date()],
    [models.User, "findAll", async () => [
      { id: 11, name: "Maker", role: "graphic", roles: ["graphic"] },
      { id: 33, name: "Reviewer", role: "social", roles: ["social"] },
    ]],
  ];
  const originals = patches.map(([obj, key, fn]) => { const old = obj[key]; obj[key] = fn; return [obj, key, old]; });
  try {
    kpi.bumpKpiCache();
    const data = await kpi.getKpis();
    const maker = data.people.find((p) => p.id === 11), reviewer = data.people.find((p) => p.id === 33);
    assert.equal(data.team.delivered, 2);
    assert.equal(maker.delivered, 2);
    assert.equal(maker.open, 0);
    assert.equal(maker.onTime, 0); // late dated completion; undated work does not improve the rate
    assert.equal(reviewer.delivered, 0);
    assert.equal(reviewer.open, 2);
    assert.equal(reviewer.overdue, 1);
    assert.equal(data.team.onTime, 0);
  } finally {
    for (const [obj, key, value] of originals) obj[key] = value;
    kpi.bumpKpiCache();
  }
});
