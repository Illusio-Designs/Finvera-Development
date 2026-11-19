if (process.env.FINVERA_PEOPLE_TESTS !== "1" || process.env.DB_HOST !== "127.0.0.1" ||
    process.env.DB_NAME !== "finvera_people_test" || !(Number(process.env.DB_PORT) > 1024)) {
  throw new Error("Use the disposable local people payroll test database.");
}

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const { sequelize, User, TeamMember } = require("../../src/models");
const auth = require("../../src/middleware/auth");
const { Period } = require("../../src/models/people");

async function run() {
  await sequelize.sync({ force: true });
  const admin = await User.create({ name: "Admin Fixture", email: "admin@example.test", password: "fixture", role: "admin", roles: ["admin"] });
  const viewer = await User.create({ name: "Staff Fixture", email: "staff@example.test", password: "fixture", role: "graphic", roles: ["graphic"] });
  const token = user => jwt.sign({ id: user.id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "5m" });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/api/people";
  const call = async (path, method = "GET", data, user = admin) => {
    const response = await fetch(base + path, {
      method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: "Bearer " + token(user) } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  };
  try {
    const month = "2025-11";
    const inputs = { name: "Employee Fixture", title: "Designer", startsOn: month + "-01", salary: 3000000 };
    assert.equal((await call("/" + month, "GET", undefined, null)).status, 401);
    assert.equal((await call("/" + month, "GET", undefined, viewer)).status, 403);
    assert.equal((await call("/employees", "POST", inputs, viewer)).status, 403);
    const created = await call("/employees", "POST", inputs);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(await User.count(), 2);
    await Period.create({ month, rules: { basis: "working", weeklyOff: [6], holidays: [month + "-15"] } });
    const draft = async (period = month) => (await call("/" + period)).body;
    assert.deepEqual((await draft()).rules, { basis: "fixed30", weeklyOff: [0], holidays: [month + "-15"], paidLeaveDays: 1 });
    const oldRules = { basis: "working", weeklyOff: [6], holidays: [] };
    await Period.create({ month: "2025-10", rules: oldRules, snapshot: [{ net: 123 }], finalizedAt: new Date() });
    assert.deepEqual((await draft("2025-10")).rules, oldRules);
    assert.equal((await draft("2025-10")).rows[0].net, 123);
    assert.equal((await call("/" + month + "/rules", "PUT", { holidays: [month + "-15"] })).status, 200);
    const request = { employeeId: created.body.id, from: month + "-17", to: month + "-17", half: true, kind: "unpaid", reason: "Fixture leave" };
    assert.equal((await call("/leave", "POST", { ...request, from: month + "-16", to: month + "-16" })).status, 400);
    assert.equal((await call("/leave", "POST", { ...request, from: month + "-15", to: month + "-15" })).status, 400);
    const responses = await Promise.all(Array.from({ length: 2 }, () => call("/leave", "POST", request)));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    const leave = responses.find(r => r.status === 201).body;
    assert.equal((await draft()).rows[0].net, 3000000);
    assert.equal((await call("/" + month + "/finalize", "POST")).status, 409);
    assert.equal((await call("/leave/" + leave.id, "PATCH", { status: "approved" })).status, 200);
    const approve = async (from, to, half) => {
      const recorded = await call("/leave", "POST", { ...request, kind: "paid", from, to, half });
      assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
      assert.equal((await call("/leave/" + recorded.body.id, "PATCH", { status: "approved" })).status, 200);
    };
    await approve(month + "-18", month + "-18", true);
    await approve(month + "-19", month + "-19", true);
    let row = (await draft()).rows[0];
    assert.deepEqual([row.divisor, row.paidDays, row.unpaidDays, row.unpaidDeduction, row.net], [30, 1, 0.5, 50000, 2950000]);
    await approve(month + "-29", "2025-12-02", false);
    row = (await draft()).rows[0];
    assert.deepEqual([row.paidDays, row.unpaidDays, row.unpaidDeduction, row.net], [1, 1.5, 150000, 2850000]);
    const next = (await draft("2025-12")).rows[0];
    assert.deepEqual([next.divisor, next.paidDays, next.unpaidDays, next.net], [30, 1, 1, 2900000]);
    assert.equal((await call("/" + month + "/adjustments/" + created.body.id, "PUT", { bonus: 100000, deduction: 50000, note: "Fixture adjustment" })).status, 200);
    assert.equal((await draft()).rows[0].net, 2900000);
    assert.equal((await call("/" + month + "/finalize", "POST")).status, 200);
    assert.equal((await call("/leave/" + leave.id, "PATCH", { status: "cancelled" })).status, 409);
    assert.equal((await call("/" + month + "/rules", "PUT", { holidays: [] })).status, 409);
    assert.equal((await call("/employees/" + created.body.id, "PUT", { ...inputs, salary: 4000000 })).status, 200);
    assert.equal((await draft()).rows[0].net, 2900000);
    assert.equal((await call("/" + month)).cache, "private, no-store");
    const unlinked = { userId: null, teamMemberId: null };
    const profile = await TeamMember.create({ name: inputs.name, role: "Public job title", status: "published" });
    const linkPath = "/links/" + created.body.id;
    const selection = { userId: viewer.id, teamMemberId: profile.id };
    assert.equal((await call("/links", "GET", undefined, viewer)).status, 403);
    assert.equal((await call(linkPath, "PUT", { ...selection, expected: unlinked }, viewer)).status, 403);
    assert.deepEqual((await call("/links")).body.links, []);
    assert.equal((await call(linkPath, "PUT", { ...selection, expected: unlinked })).status, 200);
    assert.equal((await call(linkPath, "PUT", { ...selection, expected: unlinked })).status, 200);
    assert.equal((await call(linkPath, "PUT", { ...unlinked, expected: unlinked })).status, 409);
    assert.equal((await call(linkPath, "PUT", { ...selection, teamMemberId: 999, expected: selection })).status, 404);
    const links = await call("/links");
    assert.equal(links.cache, "private, no-store");
    assert.deepEqual(links.body.links, [{ employeeId: created.body.id, ...selection }]);
    assert.equal(links.body.employees[0].salary, undefined);
    assert.equal(links.body.users[0].password, undefined);
    const second = await call("/employees", "POST", { ...inputs, name: "Second employee" });
    assert.equal((await call("/links/" + second.body.id, "PUT", { ...selection, expected: unlinked })).status, 409);
    const site = await fetch(base.replace(/people$/, "team"));
    assert.equal(site.status, 200);
    const team = await site.json();
    assert.ok(team.some(item => item.id === profile.id));
    assert.ok(team.every(item => !("userId" in item) && !("employeeId" in item) && !("salary" in item)));
    await profile.destroy();
    assert.deepEqual((await call("/links")).body.links[0], { employeeId: created.body.id, userId: viewer.id, teamMemberId: null });
    assert.equal((await call(linkPath, "PUT", { ...unlinked, expected: { userId: viewer.id, teamMemberId: null } })).status, 200);
    assert.equal((await User.findByPk(viewer.id)).role, "graphic");
    assert.equal((await draft()).rows[0].net, 2900000);
    console.log("PASS admin link authorization, explicit linking and unlinking, stale and duplicate writes, deleted profiles, and public data isolation.");
    await auth.loadUser(admin.id);
    await User.update({ roles: ["graphic"], role: "graphic" }, { where: { id: admin.id } });
    assert.equal((await call("/" + month)).status, 403);
    console.log("PASS employee creation, server permissions, fixed-30 salary, Sunday and holiday exclusions, monthly paid allowance, cross-month leave, adjustments and frozen payroll.");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
