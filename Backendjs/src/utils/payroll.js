const { isDay } = require("./leadFollowUp");

const bases = ["calendar", "working", "fixed30"];
const defaultRules = () => ({ basis: "calendar", weeklyOff: [0], holidays: [] });
const fail = (status, message) => Object.assign(new Error(message), { status });
const validMonth = value => typeof value === "string" && /^[2-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);

function daysBetween(from, to) {
  const days = [];
  for (let date = new Date(from + "T00:00:00Z"); date <= new Date(to + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + 1)) {
    days.push({ date: date.toISOString().slice(0, 10), weekday: date.getUTCDay() });
  }
  return days;
}

function monthBounds(month) {
  if (!validMonth(month)) throw fail(400, "Choose a valid payroll month.");
  const [year, number] = month.split("-").map(Number);
  return [month + "-01", new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)];
}

function rulesInput(input, month) {
  const { basis, weeklyOff, holidays } = input || {};
  if (!bases.includes(basis) || !Array.isArray(weeklyOff) || weeklyOff.length > 6 ||
      weeklyOff.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
      !Array.isArray(holidays) || holidays.length > 31 || holidays.some(day => !isDay(day) || day.slice(0, 7) !== month)) {
    throw fail(400, "Choose a salary basis, up to six weekly days off, and valid holidays in this month.");
  }
  return { basis, weeklyOff: [...new Set(weeklyOff)].sort(), holidays: [...new Set(holidays)].sort() };
}

const isWorkday = (day, rules) => !rules.weeklyOff.includes(day.weekday) && !rules.holidays.includes(day.date);

function leaveDays(leave, days, rules) {
  return days.filter(day => day.date >= leave.from && day.date <= leave.to && isWorkday(day, rules)).length * (leave.half ? 0.5 : 1);
}

function payrollRows(employees, leaves, month, rules, adjustments = {}) {
  const days = daysBetween(...monthBounds(month));
  const periodDays = rules.basis === "working" ? days.filter(day => isWorkday(day, rules)) : days;
  const divisor = rules.basis === "fixed30" ? 30 : periodDays.length;
  if (!divisor) throw fail(400, "Working-day payroll requires at least one working day in the month.");

  const byEmployee = new Map();
  for (const leave of leaves) {
    if (leave.status !== "approved") continue;
    const list = byEmployee.get(leave.employeeId) || [];
    list.push(leave);
    byEmployee.set(leave.employeeId, list);
  }
  return employees.flatMap(employee => {
    const employed = day => day.date >= employee.startsOn && (!employee.endsOn || day.date <= employee.endsOn);
    if (!days.some(employed)) return [];
    const eligible = periodDays.filter(employed).length;
    const employeeDays = days.filter(employed);
    let paidDays = 0;
    let unpaidDays = 0;
    for (const leave of byEmployee.get(employee.id) || []) {
      const count = leaveDays(leave, employeeDays, rules);
      if (leave.kind === "paid") paidDays += count;
      else unpaidDays += count;
    }
    const { bonus = 0, deduction = 0, note = "" } = adjustments[employee.id] || {};
    // Store paise and round each line to the nearest paise.
    const earned = Math.round(employee.salary * (eligible === periodDays.length && eligible > 0 ? divisor : Math.min(eligible, divisor)) / divisor);
    const unpaidDeduction = Math.min(earned, Math.round(employee.salary * unpaidDays / divisor));
    return [{
      employeeId: employee.id, name: employee.name, salary: employee.salary, divisor, eligible,
      paidDays, unpaidDays, earned, unpaidDeduction, bonus, deduction, note,
      net: earned - unpaidDeduction + bonus - deduction,
    }];
  });
}

module.exports = { fail, defaultRules, monthBounds, rulesInput, daysBetween, leaveDays, payrollRows };
