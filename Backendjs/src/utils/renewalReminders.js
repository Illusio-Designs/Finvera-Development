/* Renewal reminders — turn a task's `renewalDate` into in-app notifications.

   There is no cron on this host, so instead of a scheduled job we sweep on
   demand: the notifications endpoint calls runRenewalSweep() on each poll,
   but a module-level throttle limits the actual work to once every few
   minutes. The sweep is fully deduped (one notification per task + renewal
   date + milestone + recipient), so running it repeatedly is safe. */

const { Op } = require("sequelize");
const { Task, User, Notification } = require("../models");

const LEAD_DAYS = 7;              // start reminding this many days before the date
const THROTTLE_MS = 5 * 60 * 1000; // run the DB sweep at most this often
let lastRun = 0;

const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

// Whole-day difference (renewal - today), using date-only values.
const daysUntil = (dateStr) => {
  const today = new Date(new Date().toDateString());
  const day = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  return Math.round((day.getTime() - today.getTime()) / 86400000);
};

async function runRenewalSweep(force = false) {
  const now = Date.now();
  if (!force && now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  try {
    // Only tasks that are still open and have a renewal date within the window.
    const tasks = await Task.findAll({ where: { renewalDate: { [Op.ne]: null }, completed: false } });
    const due = tasks
      .map((t) => ({ t, days: daysUntil(t.renewalDate) }))
      .filter(({ days }) => days <= LEAD_DAYS); // upcoming (within lead) or already past
    if (!due.length) return;

    // Admins always get renewal reminders, alongside the card's assignees.
    const admins = await User.findAll({ where: { active: true } });
    const adminIds = admins
      .filter((u) => (Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : [])).includes("admin"))
      .map((u) => u.id);

    // Existing renewal notifications, for dedup by (userId | taskId | date | kind).
    const existing = await Notification.findAll({ where: { type: "renewal" }, attributes: ["userId", "meta"] });
    const seen = new Set(
      existing.map((n) => {
        const m = typeof n.meta === "string" ? (() => { try { return JSON.parse(n.meta); } catch { return {}; } })() : (n.meta || {});
        return `${n.userId}|${m.taskId}|${m.date}|${m.kind}`;
      })
    );

    const rows = [];
    for (const { t, days } of due) {
      const kind = days < 0 ? "overdue" : days === 0 ? "due" : "soon"; // one milestone crossing per date
      const date = String(t.renewalDate).slice(0, 10);
      const title =
        kind === "overdue" ? `Renewal overdue: ${t.title}`
        : kind === "due" ? `Renewal due today: ${t.title}`
        : `Renewal in ${days} day${days === 1 ? "" : "s"}: ${t.title}`;
      const recipients = [...new Set([...asArr(t.memberIds), ...adminIds])].filter((id) => id != null);
      for (const userId of recipients) {
        const key = `${userId}|${t.id}|${date}|${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          userId,
          type: "renewal",
          title,
          body: `Renewal date: ${date}`,
          link: "/dashboard/kanban",
          meta: { taskId: t.id, boardId: t.boardId, date, kind },
        });
      }
    }
    if (rows.length) await Notification.bulkCreate(rows);
  } catch (e) {
    console.warn("\x1b[33m⚠ renewal sweep:\x1b[0m", e.message);
  }
}

module.exports = { runRenewalSweep };
