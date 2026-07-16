/* Renewal reminders — turn renewal dates into in-app notifications.

   Two sources feed the same reminder stream:
     • Task.renewalDate       — a renewal date set on a board card
     • Renewal.renewalDate    — a maintenance/renewal invoice record

   There is no cron on this host, so instead of a scheduled job we sweep on
   demand: the notifications endpoint calls runRenewalSweep() on each poll,
   but a module-level throttle limits the actual work to once every few
   minutes. The sweep is fully deduped (one notification per source record +
   renewal date + milestone + recipient), so running it repeatedly is safe. */

const { Op } = require("sequelize");
const { Task, Renewal, User, Notification } = require("../models");

const LEAD_DAYS = 7;               // remind this many days before a task renewal
const RENEWAL_LEAD_DAYS = 30;      // invoices need more lead time than task chips
const THROTTLE_MS = 5 * 60 * 1000; // run the DB sweep at most this often
let lastRun = 0;

const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};
const parseMeta = (m) => (typeof m === "string" ? (() => { try { return JSON.parse(m); } catch { return {}; } })() : (m || {}));
const rolesOf = (u) => (Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []));

// Whole-day difference (renewal - today), using date-only values.
const daysUntil = (dateStr) => {
  const today = new Date(new Date().toDateString());
  const day = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  return Math.round((day.getTime() - today.getTime()) / 86400000);
};
const milestone = (days) => (days < 0 ? "overdue" : days === 0 ? "due" : "soon");

async function runRenewalSweep(force = false) {
  const now = Date.now();
  if (!force && now - lastRun < THROTTLE_MS) return;
  lastRun = now;

  try {
    const users = await User.findAll({ where: { active: true } });
    const adminIds = users.filter((u) => rolesOf(u).includes("admin")).map((u) => u.id);
    // Users whose roles grant the renewals area get invoice reminders too.
    const renewalRoleIds = users.filter((u) => rolesOf(u).some((r) => r === "admin" || r === "projects")).map((u) => u.id);
    const nameToId = new Map(users.map((u) => [u.name, u.id]));

    // Existing renewal notifications → dedup set keyed by userId | ref | date | kind.
    const existing = await Notification.findAll({ where: { type: "renewal" }, attributes: ["userId", "meta"] });
    const seen = new Set(existing.map((n) => {
      const m = parseMeta(n.meta);
      const ref = m.taskId != null ? `t${m.taskId}` : (m.renewalId != null ? `r${m.renewalId}` : "x");
      return `${n.userId}|${ref}|${m.date}|${m.kind}`;
    }));

    const rows = [];
    const push = (userId, ref, date, kind, title, extra) => {
      const key = `${userId}|${ref}|${date}|${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ userId, type: "renewal", title, body: `Renewal date: ${date}`, link: extra.link, meta: { date, kind, ...extra.meta } });
    };

    /* ── Task renewal dates ── */
    const tasks = await Task.findAll({ where: { renewalDate: { [Op.ne]: null }, completed: false } });
    for (const t of tasks) {
      const days = daysUntil(t.renewalDate);
      if (days > LEAD_DAYS) continue;
      const kind = milestone(days);
      const date = String(t.renewalDate).slice(0, 10);
      const title = kind === "overdue" ? `Renewal overdue: ${t.title}`
        : kind === "due" ? `Renewal due today: ${t.title}`
        : `Renewal in ${days} day${days === 1 ? "" : "s"}: ${t.title}`;
      const recipients = [...new Set([...asArr(t.memberIds), ...adminIds])].filter((id) => id != null);
      for (const userId of recipients) push(userId, `t${t.id}`, date, kind, title, { link: "/dashboard/kanban", meta: { taskId: t.id, boardId: t.boardId } });
    }

    /* ── Maintenance / renewal invoice records ── */
    const records = await Renewal.findAll({ where: { renewalDate: { [Op.ne]: null }, status: "active" } });
    for (const rec of records) {
      const days = daysUntil(rec.renewalDate);
      if (days > RENEWAL_LEAD_DAYS) continue;
      const kind = milestone(days);
      const date = String(rec.renewalDate).slice(0, 10);
      const who = rec.project ? `${rec.client} — ${rec.project}` : rec.client;
      const title = kind === "overdue" ? `Renewal overdue: ${who}`
        : kind === "due" ? `Renewal due today: ${who}`
        : `Renewal in ${days} day${days === 1 ? "" : "s"}: ${who}`;
      const ownerId = rec.owner ? nameToId.get(rec.owner) : null;
      const recipients = [...new Set([...renewalRoleIds, ...(ownerId ? [ownerId] : [])])].filter((id) => id != null);
      for (const userId of recipients) push(userId, `r${rec.id}`, date, kind, title, { link: "/dashboard/renewals", meta: { renewalId: rec.id } });
    }

    if (rows.length) await Notification.bulkCreate(rows);
  } catch (e) {
    console.warn("\x1b[33m⚠ renewal sweep:\x1b[0m", e.message);
  }
}

module.exports = { runRenewalSweep };
