if (process.env.FINVERA_PEOPLE_TESTS !== "1" || process.env.DB_HOST !== "127.0.0.1" ||
    process.env.DB_NAME !== "finvera_people_test" || !(Number(process.env.DB_PORT) > 1024)) {
  throw new Error("Use the disposable local people payroll test database.");
}

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");
const { sequelize, User, TeamMember, SocialClient } = require("../../src/models");
const auth = require("../../src/middleware/auth");
const { Period, Employee, EmployeeDocument, EmployeeLink } = require("../../src/models/people");

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
    const createProfilePath = linkPath + "/team-profile";
    assert.equal((await call(createProfilePath, "POST", undefined, viewer)).status, 403);
    assert.equal((await call("/links/999/team-profile", "POST")).status, 404);
    await call(linkPath, "PUT", { userId: viewer.id, teamMemberId: null, expected: unlinked });
    const profiles = await Promise.all([call(createProfilePath, "POST"), call(createProfilePath, "POST")]);
    assert.deepEqual(profiles.map(response => response.status).sort(), [201, 409]);
    const { profile: draftProfile, link } = profiles.find(response => response.status === 201).body;
    assert.deepEqual(draftProfile, { id: draftProfile.id, name: inputs.name, role: inputs.title, status: "draft" });
    assert.deepEqual(link, { employeeId: created.body.id, userId: viewer.id, teamMemberId: draftProfile.id });
    assert.equal(await TeamMember.count({ where: { status: "draft", name: inputs.name } }), 1);
    const publicDraft = await fetch(base.replace(/people$/, "team") + "/" + draftProfile.id);
    assert.equal(publicDraft.status, 404);
    const secondCreated = await call("/links/" + second.body.id + "/team-profile", "POST");
    assert.equal(secondCreated.status, 201);
    assert.equal(secondCreated.body.link.userId, null);
    console.log("PASS linked team draft creation, preserved login, staff denial, concurrent duplicate prevention and public draft exclusion.");
    assert.equal((await User.findByPk(viewer.id)).role, "graphic");
    assert.equal((await draft()).rows[0].net, 2900000);
    console.log("PASS admin link authorization, explicit linking and unlinking, stale and duplicate writes, deleted profiles, and public data isolation.");
    const brand = await SocialClient.create({ name: "Onboarding Fixture Brand" });
    const onboardData = {
      ...inputs, name: "Onboarding Fixture",
      login: { mode: "create", email: "onboarding@example.test", roles: ["graphic", "content"], brandIds: [brand.id] },
      team: { mode: "create", name: "Public Fixture", role: "Public designer", bio: "Fixture biography", initials: "PF" },
    };
    assert.equal((await call("/onboard", "POST", onboardData, viewer)).status, 403);
    const onboarded = await call("/onboard", "POST", onboardData);
    assert.equal(onboarded.status, 201, JSON.stringify(onboarded.body));
    const createdUser = await User.findByPk(onboarded.body.userId);
    assert.deepEqual(createdUser.roles, ["graphic", "content"]);
    assert.deepEqual(createdUser.socialClients, [brand.id]);
    assert.equal(createdUser.invitePending, true);
    const setup = new URL(onboarded.body.invite.link);
    const info = await fetch(base.replace(/people$/, "auth/reset-info") + setup.search);
    assert.equal(info.status, 200);
    assert.equal((await info.json()).kind, "invite");
    const createdTeam = await TeamMember.findByPk(onboarded.body.teamMemberId);
    assert.equal(createdTeam.name, "Public Fixture");
    assert.equal(createdTeam.bio, "Fixture biography");
    assert.equal(createdTeam.status, "draft");
    assert.equal((await EmployeeLink.findByPk(onboarded.body.employeeId)).userId, createdUser.id);
    assert.equal((await call("/onboard", "POST", onboardData)).status, 409);
    assert.equal(await Employee.count({ where: { name: onboardData.name } }), 1);

    const oldError = console.error;
    TeamMember.addHook("beforeCreate", "fixture-onboard-fail", () => { throw new Error("Fixture draft creation failure"); });
    try {
      console.error = () => {};
      const failed = await call("/onboard", "POST", {
        ...onboardData, name: "Rollback Fixture", login: { ...onboardData.login, email: "rollback@example.test" },
      });
      assert.equal(failed.status, 500);
    } finally {
      console.error = oldError;
      TeamMember.removeHook("beforeCreate", "fixture-onboard-fail");
    }
    assert.equal(await Employee.count({ where: { name: "Rollback Fixture" } }), 0);
    assert.equal(await User.count({ where: { email: "rollback@example.test" } }), 0);
    const standalone = await call("/onboard", "POST", { ...inputs, login: { mode: "none" }, team: { mode: "none" } });
    assert.equal(standalone.status, 201);
    assert.deepEqual([standalone.body.userId, standalone.body.teamMemberId, standalone.body.invite], [null, null, null]);
    const existingTeam = await TeamMember.create({ name: "Unlinked website profile", status: "draft" });
    const existingLogin = await User.create({ name: "Unlinked login", email: "unlinked@example.test", password: "fixture", role: "graphic", roles: ["graphic"] });
    const linked = await call("/onboard", "POST", { ...inputs, login: { mode: "existing", id: existingLogin.id }, team: { mode: "existing", id: existingTeam.id } });
    assert.equal(linked.status, 201);
    assert.deepEqual([linked.body.userId, linked.body.teamMemberId, linked.body.invite], [existingLogin.id, existingTeam.id, null]);
    console.log("PASS atomic employee setup, login roles and brands, working invite, draft profile, existing selections and rollback.");
    const fixtureBytes = Buffer.from("%PDF-1.4\nEmployee document fixture\n%%EOF");
    function multipart(details, files) {
      const form = new FormData();
      form.append("details", JSON.stringify(details));
      for (const [kind, bytes] of files) form.append(kind, new Blob([bytes], { type: "application/pdf" }), "employee-fixture.pdf");
      return form;
    }
    async function documentRequest(path, method = "GET", body, user = admin) {
      return fetch(base + path, { method, body, headers: user ? { Authorization: "Bearer " + token(user) } : {} });
    }
    const fileKinds = ["aadhaar", "pan", "cheque", "offerLetter"];
    const allFiles = fileKinds.map(kind => [kind, fixtureBytes]);
    const documentInput = { ...inputs, name: "Employee With Files", login: { mode: "none" }, team: { mode: "none" } };
    assert.equal((await documentRequest("/onboard", "POST", multipart(documentInput, allFiles), viewer)).status, 403);
    assert.equal((await documentRequest("/onboard", "POST", multipart(documentInput, [["pan", Buffer.from("not a document")]]))).status, 400);
    assert.equal(await Employee.count({ where: { name: documentInput.name } }), 0);
    const uploaded = await documentRequest("/onboard", "POST", multipart(documentInput, allFiles));
    assert.equal(uploaded.status, 201, await uploaded.clone().text());
    const { employeeId } = await uploaded.json();
    const endpoint = `/employees/${employeeId}/documents`;
    const list = await documentRequest(endpoint);
    assert.match(list.headers.get("cache-control"), /private, no-store/);
    const metadata = await list.json();
    assert.deepEqual(metadata.map(doc => doc.kind).sort(), [...fileKinds].sort());
    assert(metadata.every(doc => !Object.hasOwn(doc, "contents")));
    const raw = await EmployeeDocument.findOne({ where: { employeeId, kind: "aadhaar" } });
    assert(!raw.contents.includes(fixtureBytes));
    assert.equal((await documentRequest(endpoint, "GET", undefined, viewer)).status, 403);
    assert.equal((await documentRequest(endpoint + "/aadhaar", "GET", undefined, viewer)).status, 403);
    assert.equal((await documentRequest(endpoint + "/aadhaar", "GET", undefined, null)).status, 401);
    const downloaded = await documentRequest(endpoint + "/aadhaar");
    assert.match(downloaded.headers.get("content-disposition"), /attachment.*aadhaar\.pdf/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), fixtureBytes);
    const revised = Buffer.from("%PDF-1.4\nUpdated fixture\n%%EOF");
    assert.equal((await documentRequest(`/employees/${employeeId}`, "PUT", multipart(documentInput, [["pan", revised]]))).status, 200);
    assert.deepEqual(Buffer.from(await (await documentRequest(endpoint + "/pan")).arrayBuffer()), revised);
    assert.deepEqual(Buffer.from(await (await documentRequest(endpoint + "/aadhaar")).arrayBuffer()), fixtureBytes);
    EmployeeDocument.addHook("beforeUpsert", "fixture-doc-fail", () => { throw new Error("Fixture document write failure"); });
    try {
      console.error = () => {};
      const rollback = { ...onboardData, name: "Rollback With File", login: { ...onboardData.login, email: "document-rollback@example.test" } };
      assert.equal((await documentRequest("/onboard", "POST", multipart(rollback, allFiles))).status, 500);
      assert.equal(await Employee.count({ where: { name: rollback.name } }), 0);
      assert.equal(await User.count({ where: { email: rollback.login.email } }), 0);
    } finally {
      console.error = oldError;
      EmployeeDocument.removeHook("beforeUpsert", "fixture-doc-fail");
    }
    console.log("PASS private multipart onboarding, encrypted storage, admin-only file lists and downloads, replacement and rollback.");
    await auth.loadUser(admin.id);
    await User.update({ roles: ["graphic"], role: "graphic" }, { where: { id: admin.id } });
    assert.equal((await call("/" + month)).status, 403);
    console.log("PASS employee creation, server permissions, fixed-30 salary, Sunday and holiday exclusions, monthly paid allowance, cross-month leave, adjustments and frozen payroll.");
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => sequelize.close());
