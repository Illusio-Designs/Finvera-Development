const { dailyState, claimDate } = require("./taskMachine");
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
       → the owner + admins (invoice records)

   Email: the same run also sends ONE digest email per person (renewals +
   content calendar sections, each only if their email preferences allow it),
   in the background — see sendDigest(). */

const { Op } = require("sequelize");
const { SocialPost, Renewal, User, Setting } = require("../models");
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
  if (dailyState(date, minutes, RUN_AT_MIN, checkedFor) !== "eligible") return { ran: false };
  try {
    const claimed = await claimDate(KEY, date);
    checkedFor = date;
    if (!claimed) return { ran: false };
    const sent = await runDaily(date);
    // Activity history retention (365 days), once a day with the reminders.
    require("./audit").purgeOld().catch(() => {});
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
  const digest = new Map(); // userId → { renewals: [], start: [], overdue: [] }
  const dig = (userIds, section, item) => {
    for (const id of new Set(userIds)) {
      if (!active.has(id)) continue;
      if (!digest.has(id)) digest.set(id, { renewals: [], start: [], overdue: [] });
      digest.get(id)[section].push(item);
    }
  };
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
  for (const p of starting) dig([p.assigneeId], "start", { title: p.theme, sub: `${p.client} · goes live ${when(p.postDate, p.postTime)}` });
  for (const p of overdue) dig([p.assigneeId], "overdue", { title: p.theme, sub: `${p.client} · go-live was ${fmtDate(p.postDate)}` });
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
  const { reminderLabel } = require("./renewalMachine");
  const records = await Renewal.findAll({ where: { renewalDate: { [Op.ne]: null }, status: "active" } });
  for (const r of records) {
    const head = reminderLabel({ status: r.status, renewalDate: day(r.renewalDate) }, today);
    if (!head) continue;
    const owner = r.owner ? nameToId.get(r.owner) : null;
    dig([...adminIds, ...(owner ? [owner] : [])], "renewals", {
      head, title: r.project ? `${r.client} — ${r.project}` : r.client,
      sub: `Renewal date ${fmtDate(r.renewalDate)}${r.amount ? ` · ₹${Number(r.amount).toLocaleString("en-IN")}` : ""}${r.owner ? ` · ${r.owner}` : ""}`,
    });
    add([...adminIds, ...(owner ? [owner] : [])], {
      type: "renewal", title: `${head}: ${r.project ? `${r.client} — ${r.project}` : r.client}`,
      body: `Renewal date ${fmtDate(r.renewalDate)}${r.amount ? ` · ₹${Number(r.amount).toLocaleString("en-IN")}` : ""}`,
      link: `/dashboard/renewals?renewal=${r.id}`, meta: { renewalId: r.id, day: today },
    });
  }

  /* ── Lead follow-ups (today / overdue / meeting today) → the lead owner ── */
  try { rows.push(...(await require("../controllers/leads.controller").reminderRows(today, users, adminIds))); }
  catch (e) { console.warn("lead follow-up reminders:", e.message); }

  await createRows(rows);
  sendDigest(users, digest, today);
  return rows.length;
}

/* One email per person: their renewals and content-calendar items for today.
   Fire-and-forget; respects each user's emailPrefs (renewals / calendar). */
function sendDigest(users, digest, today) {
  try {
    const { emailUsers, prefsOf, layout, esc, ul, dashboardUrl } = require("./emails");
    const byId = new Map(users.map((u) => [u.id, u]));
    const people = [...digest.keys()].map((id) => byId.get(id)).filter(Boolean);
    const item = (i) => `<b>${esc(i.title)}</b>${i.head ? ` — ${esc(i.head)}` : ""}<br><span style="color:#5b6478">${esc(i.sub)}</span>`;
    emailUsers(people, null, (u) => {
      const d = digest.get(u.id);
      const prefs = prefsOf(u);
      const parts = [], subj = [];
      if (prefs.renewals && d.renewals.length) {
        parts.push(`<h2 style="font-size:16px;margin:18px 0 4px">Renewals (${d.renewals.length})</h2>${ul(d.renewals.map(item))}`);
        subj.push(`${d.renewals.length} renewal${d.renewals.length === 1 ? "" : "s"}`);
      }
      if (prefs.calendar && d.start.length) {
        parts.push(`<h2 style="font-size:16px;margin:18px 0 4px">Start work today (${d.start.length})</h2>${ul(d.start.map(item))}`);
        subj.push(`${d.start.length} post${d.start.length === 1 ? "" : "s"} to start`);
      }
      if (prefs.calendar && d.overdue.length) {
        parts.push(`<h2 style="font-size:16px;margin:18px 0 4px;color:#b42318">Overdue posts (${d.overdue.length})</h2>${ul(d.overdue.map(item))}`);
        subj.push(`${d.overdue.length} overdue`);
      }
      if (!parts.length) return null;
      return {
        subject: `Finvera today: ${subj.join(", ")}`,
        html: layout({ title: `Your day — ${fmtDate(today)}`, body: `<p>Hi ${esc(String(u.name || "").split(" ")[0] || "there")}, here's what needs you today.</p>${parts.join("")}`, button: { label: "Open the dashboard", url: dashboardUrl("/dashboard") } }),
      };
    });
  } catch (e) { console.warn("daily digest email:", e.message); }
}

module.exports = { maybeRunDaily, runDaily, istNow };
