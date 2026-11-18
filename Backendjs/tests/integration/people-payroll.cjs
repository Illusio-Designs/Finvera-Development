if (process.env.FINVERA_PEOPLE_TESTS !== "1" || process.env.DB_HOST !== "127.0.0.1" ||
    process.env.DB_NAME !== "finvera_people_test" || !(Number(process.env.DB_PORT) > 1024)) {
  throw new Error("Use the disposable local people payroll test database.");
}

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");
const auth = require("../../src/middleware/auth");

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
    assert.equal((await call("/" + month + "/rules", "PUT", { basis: "working", weeklyOff: [0], holidays: [month + "-15"] })).status, 200);
    const request = { employeeId: created.body.id, from: month + "-17", to: month + "-17", half: true, kind: "unpaid", reason: "Fixture leave" };
    const responses = await Promise.all(Array.from({ length: 2 }, () => call("/leave", "POST", request)));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    const leave = responses.find(r => r.status === 201).body;
    const draft = async () => (await call("/" + month)).body;
    assert.equal((await draft()).rows[0].net, 3000000);
    assert.equal((await call("/" + month + "/finalize", "POST")).status, 409);
    assert.equal((await call("/leave/" + leave.id, "PATCH", { status: "approved" })).status, 200);
    let row = (await draft()).rows[0];
    assert.deepEqual([row.divisor, row.unpaidDays, row.unpaidDeduction, row.net], [24, 0.5, 62500, 2937500]);
    assert.equal((await call("/" + month + "/adjustments/" + created.body.id, "PUT", { bonus: 100000, deduction: 50000, note: "Fixture adjustment" })).status, 200);
    assert.equal((await draft()).rows[0].net, 2987500);
    assert.equal((await call("/" + month + "/finalize", "POST")).status, 200);
    assert.equal((await call("/leave/" + leave.id, "PATCH", { status: "cancelled" })).status, 409);
    assert.equal((await call("/" + month + "/rules", "PUT", { basis: "calendar", weeklyOff: [], holidays: [] })).status, 409);
    assert.equal((await call("/employees/" + created.body.id, "PUT", { ...inputs, salary: 4000000 })).status, 200);
    assert.equal((await draft()).rows[0].net, 2987500);
    assert.equal((await call("/" + month)).cache, "private, no-store");
    await auth.loadUser(admin.id);
    await User.update({ roles: ["graphic"], role: "graphic" }, { where: { id: admin.id } });
    assert.equal((await call("/" + month)).status, 403);
    console.log("PASS employee creation, server permissions, rules, concurrent leave, salary adjustments and frozen payroll.");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
