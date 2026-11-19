const express = require("express");
const { Op } = require("sequelize");
const { requireAuth, requireRole } = require("../middleware/auth");
const { rolesOf } = require("../utils/permissions");
const { sequelize, Setting, User, TeamMember } = require("../models");
const { Employee, Leave, Period, EmployeeLink } = require("../models/people");
const { asyncHandler } = require("../utils/crud");
const { isDay, todayIst } = require("../utils/leadFollowUp");
const { fail, defaultRules, monthBounds, rulesInput, daysBetween, leaveDays, payrollRows } = require("../utils/payroll");

const router = express.Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
router.use(requireAuth, requireRole("admin"), asyncHandler(async (req, res, next) => {
  // Check the current role before returning HR data even if auth's shared cache is warm.
  const user = await User.findByPk(req.user.id, { attributes: ["active", "role", "roles"] });
  if (!user?.active || !rolesOf(user).includes("admin")) return res.status(403).json({ message: "Administrator access is required." });
  next();
}));

const lockKey = "payroll.writeLock";
async function write(run) {
  await Setting.findOrCreate({ where: { key: lockKey }, defaults: { value: "1", group: "system", isPublic: false } });
  return sequelize.transaction(async transaction => {
    // All edits and finalization share this lock, including leave spanning two months.
    await Setting.findOne({ where: { key: lockKey }, transaction, lock: transaction.LOCK.UPDATE });
    return run(transaction);
  });
}

function text(value, limit, required = false) {
  if (typeof value !== "string" || value.trim().length > limit || (required && !value.trim())) {
    throw fail(400, "Enter the required text within the field length.");
  }
  return value.trim();
}

function money(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000000000) throw fail(400, "Enter a valid INR amount up to ₹1 crore.");
  return value;
}

async function employee(id, transaction) {
  const row = await Employee.findByPk(id, { transaction });
  if (!row) throw fail(404, "Employee not found.");
  return row;
}

async function getPeriod(month, transaction) {
  monthBounds(month);
  return Period.findByPk(month, { transaction });
}

const hasDate = (from, to) => ({ from: { [Op.lte]: to }, to: { [Op.gte]: from } });
const liveLeave = { [Op.in]: ["pending", "approved"] };

async function openDates(from, to, transaction) {
  const count = await Period.count({ where: { month: { [Op.between]: [from.slice(0, 7), to.slice(0, 7)] }, finalizedAt: { [Op.ne]: null } }, transaction });
  if (count) throw fail(409, "These leave dates touch finalized payroll.");
}

async function loadMonth(month, transaction) {
  const [from, to] = monthBounds(month);
  const period = await getPeriod(month, transaction);
  const [employees, leaves] = await Promise.all([
    Employee.findAll({ order: [["name", "ASC"], ["id", "ASC"]], transaction }),
    Leave.findAll({ where: hasDate(from, to), order: [["from", "ASC"], ["id", "ASC"]], transaction }),
  ]);
  const rules = period?.finalizedAt && period.rules ? period.rules : defaultRules(period?.rules?.holidays);
  const days = daysBetween(from, to);
  const leaveList = leaves.map(row => {
    const leave = row.get({ plain: true });
    return { ...leave, days: leaveDays(leave, days, rules) };
  });
  return {
    month, employees, leaves: leaveList, rules,
    rows: period?.snapshot ?? payrollRows(employees, leaveList, month, rules, period?.adjustments || {}),
    finalizedAt: period?.finalizedAt || null,
    finalizedBy: period?.finalizedBy || null,
  };
}

router.get("/links", asyncHandler(async (_req, res) => {
  const payload = await sequelize.transaction(async transaction => {
    const [employees, users, profiles, links] = await Promise.all([
      Employee.findAll({ attributes: ["id", "name", "title", "endsOn"], order: [["name", "ASC"], ["id", "ASC"]], transaction }),
      User.findAll({ attributes: ["id", "name", "email", "roles", "role", "active"], order: [["name", "ASC"], ["id", "ASC"]], transaction }),
      TeamMember.findAll({ attributes: ["id", "name", "role", "status"], order: [["name", "ASC"], ["id", "ASC"]], transaction }),
      EmployeeLink.findAll({ attributes: ["employeeId", "userId", "teamMemberId"], transaction }),
    ]);
    return {
      employees, profiles, links,
      users: users.map(user => ({ id: user.id, name: user.name, email: user.email, roles: rolesOf(user), active: user.active })),
    };
  });
  res.json(payload);
}));

function linkValues(input) {
  const { userId, teamMemberId } = input || {};
  if (![userId, teamMemberId].every(id => id === null || (Number.isSafeInteger(id) && id > 0 && id <= 2147483647))) {
    throw fail(400, "Choose an existing login and website profile, or leave either unlinked.");
  }
  return { userId, teamMemberId };
}

router.put("/links/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw fail(404, "Employee not found.");
  const next = linkValues(req.body);
  const expected = linkValues(req.body?.expected);
  const saved = await write(async transaction => {
    await employee(id, transaction);
    const current = await EmployeeLink.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if ((current?.userId ?? null) === next.userId && (current?.teamMemberId ?? null) === next.teamMemberId) {
      return { employeeId: id, ...next };
    }
    if ((current?.userId ?? null) !== expected.userId || (current?.teamMemberId ?? null) !== expected.teamMemberId) {
      throw fail(409, "These links changed since you opened the record. Reload links and review the current selections.");
    }
    for (const [field, Model, label] of [["userId", User, "login"], ["teamMemberId", TeamMember, "website profile"]]) {
      if (next[field] === null) continue;
      if (!await Model.findByPk(next[field], { attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE })) {
        throw fail(404, `That ${label} no longer exists.`);
      }
      if (await EmployeeLink.findOne({ where: { [field]: next[field], employeeId: { [Op.ne]: id } }, transaction })) {
        throw fail(409, `That ${label} is already linked to another employee.`);
      }
    }
    if (current) await current.update(next, { transaction });
    else await EmployeeLink.create({ employeeId: id, ...next }, { transaction });
    return { employeeId: id, ...next };
  });
  res.json(saved);
}));

router.get("/:month", asyncHandler(async (req, res) => {
  res.json(await sequelize.transaction(transaction => loadMonth(req.params.month, transaction)));
}));

const saveEmployee = asyncHandler(async (req, res) => {
  const { name, title = "", startsOn, endsOn = null, salary } = req.body || {};
  if (!isDay(startsOn) || (endsOn !== null && (!isDay(endsOn) || endsOn < startsOn))) throw fail(400, "Enter a valid joining and optional last working date.");
  const data = { name: text(name, 120, true), title: text(title, 120), startsOn, endsOn, salary: money(salary) };
  const row = await write(async transaction => {
    if (!req.params.id) return Employee.create(data, { transaction });
    const current = await employee(req.params.id, transaction);
    const outside = [{ from: { [Op.lt]: startsOn } }];
    if (endsOn) outside.push({ to: { [Op.gt]: endsOn } });
    if ((current.startsOn !== startsOn || current.endsOn !== endsOn) &&
        await Leave.count({ where: { employeeId: current.id, status: liveLeave, [Op.or]: outside }, transaction })) {
      throw fail(409, "Review the employee’s leave before changing their employment dates.");
    }
    return current.update(data, { transaction });
  });
  res.status(req.params.id ? 200 : 201).json(row);
});
router.post("/employees", saveEmployee);
router.put("/employees/:id", saveEmployee);

router.post("/leave", asyncHandler(async (req, res) => {
  const { employeeId, from, to, kind, half = false, reason } = req.body || {};
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !isDay(from) || !isDay(to) || to < from ||
      Date.parse(to) - Date.parse(from) >= 62 * 86400000 || !["paid", "unpaid"].includes(kind) ||
      typeof half !== "boolean" || (half && from !== to)) {
    throw fail(400, "Choose a valid leave range of up to 62 days. Half-day leave uses one date.");
  }
  const data = { employeeId, from, to, kind, half, reason: text(reason, 255, true), recordedBy: req.user.id };
  const row = await write(async transaction => {
    const person = await employee(employeeId, transaction);
    if (from < person.startsOn || (person.endsOn && to > person.endsOn)) throw fail(400, "The leave must fall within the employee’s employment dates.");
    await openDates(from, to, transaction);
    if (await Leave.count({ where: { employeeId, ...hasDate(from, to), status: liveLeave }, transaction })) {
      throw fail(409, "This employee already has leave covering those dates.");
    }
    const days = daysBetween(from, to);
    const months = [...new Set(days.map(day => day.date.slice(0, 7)))];
    const periods = await Period.findAll({ where: { month: months }, transaction });
    const rulesByMonth = new Map(periods.map(period => [period.month, defaultRules(period.rules?.holidays)]));
    if (!days.some(day => leaveDays(data, [day], rulesByMonth.get(day.date.slice(0, 7)) || defaultRules()))) {
      throw fail(400, "Choose a range that includes a working day.");
    }
    return Leave.create(data, { transaction });
  });
  res.status(201).json(row);
}));

router.patch("/leave/:id", asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["approved", "rejected", "cancelled"].includes(status)) throw fail(400, "Choose a valid leave decision.");
  const row = await write(async transaction => {
    const leave = await Leave.findByPk(req.params.id, { transaction });
    if (!leave) throw fail(404, "Leave entry not found.");
    if (leave.status === status) return leave;
    if (!(leave.status === "pending" || (leave.status === "approved" && status === "cancelled"))) {
      throw fail(409, "This leave already has a decision.");
    }
    await openDates(leave.from, leave.to, transaction);
    return leave.update({ status, reviewedBy: req.user.id, reviewedAt: new Date() }, { transaction });
  });
  res.json(row);
}));

async function openPeriod(month, transaction) {
  const existing = await getPeriod(month, transaction);
  if (existing?.finalizedAt) throw fail(409, "This payroll month is finalized.");
  return existing || Period.create({ month }, { transaction });
}

router.put("/:month/rules", asyncHandler(async (req, res) => {
  const month = req.params.month;
  monthBounds(month);
  const rules = rulesInput(req.body, month);
  await write(async transaction => {
    const period = await openPeriod(month, transaction);
    await period.update({ rules }, { transaction });
  });
  res.json({ rules });
}));

router.put("/:month/adjustments/:id", asyncHandler(async (req, res) => {
  const { bonus, deduction, note = "" } = req.body || {};
  const adjustment = { bonus: money(bonus), deduction: money(deduction), note: text(note, 255, !!(bonus || deduction)) };
  await write(async transaction => {
    const period = await openPeriod(req.params.month, transaction);
    const person = await employee(req.params.id, transaction);
    const [from, to] = monthBounds(req.params.month);
    if (person.startsOn > to || (person.endsOn && person.endsOn < from)) throw fail(400, "This employee was not employed during the selected month.");
    await period.update({ adjustments: { ...period.adjustments, [person.id]: adjustment } }, { transaction });
  });
  res.json({ ok: true });
}));

router.post("/:month/finalize", asyncHandler(async (req, res) => {
  const month = req.params.month;
  const [, to] = monthBounds(month);
  if (todayIst() <= to) throw fail(409, "Payroll can be finalized after the month ends in India.");
  const result = await write(async transaction => {
    const existing = await getPeriod(month, transaction);
    if (existing?.finalizedAt) return loadMonth(month, transaction);
    const period = existing || await openPeriod(month, transaction);
    const data = await loadMonth(month, transaction);
    if (data.leaves.some(leave => leave.status === "pending")) throw fail(409, "Review pending leave before finalizing.");
    if (!data.rows.length || data.rows.some(row => row.net < 0)) throw fail(409, "Add eligible employees and review any negative salary estimates before finalizing.");
    const finalizedAt = new Date();
    await period.update({ rules: data.rules, snapshot: data.rows, finalizedAt, finalizedBy: req.user.id }, { transaction });
    return { ...data, finalizedAt, finalizedBy: req.user.id };
  });
  res.json(result);
}));

module.exports = router;
