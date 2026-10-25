/* Daily reminders — sent once a day at 10:15 AM India time.

   This host has no cron, so maybeRunDaily() is called from three places: a
   timer in server.js, every notifications poll from an open dashboard, and
   GET /api/cron/daily (pinged by a scheduled GitHub workflow in case the app
   is asleep). A row in settings is claimed atomically for the day, so the
   reminders go out exactly once even with several app processes.

   What goes out (grouped: at most one alert per person per kind):
     • Content calendar — "Start work today" (start-work day) and "Overdue"
       (go-live passed, not posted) → the assigned person
     • Renewals — due in 7 days, tomorrow, today, and the day after (overdue)
       → the owner + admins (invoice records and board-card renewal dates)
     • Project board — card "Due tomorrow" and "Overdue" → the card's members */

const { Op } = require("sequelize");
const { SocialPost, Renewal, Task, Board, User, Setting } = require("../models");
const { rolesOf } = require("./permissions");
const { createRows } = require("./notify");
const { fmtDate, when, asArr, day } = require("./changeNotes");

const IST_OFFSET_MIN = 330;      // UTC+5:30
const RUN_AT_MIN = 10 * 60 + 15; // 10:15 AM
const KEY = "reminders.lastRun";

const istNow = () => {
  const d = new Date(Date.now() + IST_OFFSET_MIN * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
};
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const list = (items, f) => items.slice(0, 4).map(f).join(", ") + (items.length > 4 ? ` +${items.length - 4} more` : "");

let checkedFor = null; // in-process shortcut so polls don't hit the DB once today's run is claimed

async function maybeRunDaily() {
  const { date, minutes } = istNow();
  if (minutes < RUN_AT_MIN || checkedFor === date) return { ran: false };
  try {
    await Setting.findOrCreate({ where: { key: KEY }, defaults: { key: KEY, value: "", group: "system", isPublic: false } });
    const [claimed] = await Setting.update({ value: date }, { where: { key: KEY, [Op.or]: [{ value: null }, { value: { [Op.ne]: date } }] } });
    checkedFor = date;
    if (!claimed) return { ran: false };
    const sent = await runDaily(date);
    console.log(`\x1b[36mℹ Daily reminders ${date}: ${sent} sent\x1b[0m`);
    return { ran: true, sent };
  } catch (e) {
    console.warn("\x1b[33m⚠ daily reminders:\x1b[0m", e.message);
    return { ran: false, error: e.message };
  }
}

async function runDaily(today) {
  const users = await User.findAll({ where: { active: true } });
  const active = new Set(users.map((u) => u.id));
  const adminIds = users.filter((u) => rolesOf(u).includes("admin")).map((u) => u.id);
  const nameToId = new Map(users.map((u) => [u.name, u.id]));
  const rows = [];
  const add = (userIds, n) => { for (const userId of new Set(userIds)) if (active.has(userId)) rows.push({ userId, ...n }); };
  const byUser = (items, idsOf) => {
    const m = new Map();
    for (const it of items) for (const id of idsOf(it)) { if (!m.has(id)) m.set(id, []); m.get(id).push(it); }
    return m;
  };

  /* ── Content calendar ── */
  const posts = await SocialPost.findAll({ where: { status: { [Op.ne]: "posted" }, assigneeId: { [Op.ne]: null } } });
  const starting = posts.filter((p) => day(p.dueDate) === today);
  const overdue = posts.filter((p) => p.postDate && day(p.postDate) < today);
  for (const [uid, ps] of byUser(starting, (p) => [p.assigneeId])) {
    add([uid], ps.length === 1
      ? { type: "due", title: `Start work today: ${ps[0].theme}`, body: `${ps[0].client} · goes live ${when(ps[0].postDate, ps[0].postTime)}`, link: "/dashboard/social", meta: { kind: "start", day: today } }
      : { type: "due", title: `Start work today on ${ps.length} posts`, body: list(ps, (p) => `${p.theme} (${p.client})`), link: "/dashboard/social", meta: { kind: "start", day: today } });
  }
  for (const [uid, ps] of byUser(overdue, (p) => [p.assigneeId])) {
    add([uid], ps.length === 1
      ? { type: "due", title: `Overdue: ${ps[0].theme}`, body: `${ps[0].client} · go-live was ${fmtDate(ps[0].postDate)}`, link: "/dashboard/social", meta: { kind: "overdue", day: today } }
      : { type: "due", title: `${ps.length} posts are overdue`, body: list(ps, (p) => `${p.theme} (${fmtDate(p.postDate)})`), link: "/dashboard/social", meta: { kind: "overdue", day: today } });
  }

  /* ── Renewals: 7 days, tomorrow, today, overdue (day after) ── */
  const label = (d) => (d === 7 ? "Renewal due in 7 days" : d === 1 ? "Renewal due tomorrow" : d === 0 ? "Renewal due today" : d === -1 ? "Renewal overdue" : null);
  const records = await Renewal.findAll({ where: { renewalDate: { [Op.ne]: null }, status: "active" } });
  for (const r of records) {
    const head = label(daysBetween(today, day(r.renewalDate)));
    if (!head) continue;
    const owner = r.owner ? nameToId.get(r.owner) : null;
    add([...adminIds, ...(owner ? [owner] : [])], {
      type: "renewal", title: `${head}: ${r.project ? `${r.client} — ${r.project}` : r.client}`,
      body: `Renewal date ${fmtDate(r.renewalDate)}${r.amount ? ` · ₹${Number(r.amount).toLocaleString("en-IN")}` : ""}`,
      link: "/dashboard/renewals", meta: { renewalId: r.id, day: today },
    });
  }

  /* ── Project board ── */
  const boards = await Board.findAll();
  const doneCols = new Map(boards.map((b) => [b.id, new Set(asArr(b.columns).filter((c) => /done|complete|shipped/i.test(c.title || "")).map((c) => c.id))]));
  const open = (t) => !t.completed && !(doneCols.get(t.boardId)?.has(t.column));
  const cards = (await Task.findAll({ where: { [Op.or]: [{ dueDate: { [Op.ne]: null } }, { renewalDate: { [Op.ne]: null } }] } })).filter(open);
  for (const t of cards) {
    const head = t.renewalDate ? label(daysBetween(today, day(t.renewalDate))) : null;
    if (head) add([...adminIds, ...asArr(t.memberIds)], { type: "renewal", title: `${head}: ${t.title}`, body: `Renewal date ${fmtDate(t.renewalDate)}`, link: "/dashboard/kanban", meta: { taskId: t.id, day: today } });
  }
  const tomorrow = addDays(today, 1);
  const dueTomorrow = cards.filter((t) => day(t.dueDate) === tomorrow);
  const late = cards.filter((t) => t.dueDate && day(t.dueDate) < today);
  for (const [uid, ts] of byUser(dueTomorrow, (t) => asArr(t.memberIds))) {
    add([uid], ts.length === 1
      ? { type: "due", title: `Due tomorrow: ${ts[0].title}`, body: `Project board · due ${fmtDate(ts[0].dueDate)}`, link: "/dashboard/kanban", meta: { kind: "card-due", day: today } }
      : { type: "due", title: `${ts.length} cards are due tomorrow`, body: list(ts, (t) => t.title), link: "/dashboard/kanban", meta: { kind: "card-due", day: today } });
  }
  for (const [uid, ts] of byUser(late, (t) => asArr(t.memberIds))) {
    add([uid], ts.length === 1
      ? { type: "due", title: `Overdue card: ${ts[0].title}`, body: `Was due ${fmtDate(ts[0].dueDate)}`, link: "/dashboard/kanban", meta: { kind: "card-overdue", day: today } }
      : { type: "due", title: `${ts.length} cards are overdue`, body: list(ts, (t) => `${t.title} (${fmtDate(t.dueDate)})`), link: "/dashboard/kanban", meta: { kind: "card-overdue", day: today } });
  }

  await createRows(rows);
  return rows.length;
}

module.exports = { maybeRunDaily, runDaily, istNow };
