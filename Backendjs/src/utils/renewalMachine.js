const CYCLES = Object.freeze({ monthly: 1, quarterly: 3, "half-yearly": 6, yearly: 12 });
const STATES = Object.freeze(["active", "paused", "cancelled"]);
function addMonths(iso, count) {
  const [year, month, day] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + count, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + count, Math.min(day, last))).toISOString().slice(0, 10);
}
function actionPatch(row, event, { today, renewalDate, invoiced } = {}) {
  if (event === "renew") return { renewalDate: renewalDate || addMonths(row.renewalDate || today, CYCLES[row.cycle] || 12), status: "active", ...(invoiced === false ? {} : { lastInvoiced: today }) };
  if (event === "end") return { status: "cancelled" };
  if (event === "restore") return { status: "active" };
  if (event === "remark") return {};
  throw new Error(`Unknown renewal event: ${event}`);
}
function deadlineState(row, today) {
  if (row.status !== "active" || !row.renewalDate) return "inactive";
  const days = Math.round((Date.parse(row.renewalDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "approaching" : "future";
}
function reminderLabel(row, today) {
  if (deadlineState(row, today) === "inactive") return null;
  const days = Math.round((Date.parse(row.renewalDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  return days === 7 ? "Renewal due in 7 days" : days === 1 ? "Renewal due tomorrow" : days === 0 ? "Renewal due today" : days === -1 ? "Renewal overdue" : null;
}
module.exports = { CYCLES, STATES, addMonths, actionPatch, deadlineState, reminderLabel };
