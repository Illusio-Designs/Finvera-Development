/* "Today" home page — one call with everything the page shows.

   GET /api/today  (social area; brands limited by req.socialScope)
   {
     today: "YYYY-MM-DD",                       // India time
     counts: {
       overdue,          // go-live date passed, not posted
       approvals,        // posts in Pending approval
       goingLiveWeek,    // posts going live Mon–Sun this week (any stage)
       scheduledWeek,    // of those, Ready to post or Posted
       onTimeMonthPct,   // team on-time % this month (KPIs), null if nothing delivered
       leadsFollowUpToday, leadsFollowUpOverdue, // lead follow-ups (null without the leads area)
     },
     needsYou: [ { kind: "failed"|"approval"|"atRisk"|"renewal", title, sub, link, id, ... } ]  // max 8
     week: [ { day: "YYYY-MM-DD", total, ready } ] × 7, Monday first
     team: [ { id, name, role, onTimePct, delivered, open, overdue, avatar } ]  // this month
   }
   Admins see every brand and every item. Others see their brands only, and
   in needsYou only what is theirs: posts assigned to them or where they were
   picked for a step, publish failures of those posts (or any in their brands
   for the Social media role, who posts), and renewals due within 7 days or
   overdue that they own or nobody owns (renewals area only). Every kind
   present keeps at least one of the 8 slots. */

const { Op } = require("sequelize");
const { SocialPost, SocialPublishJob, Renewal } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesCan } = require("../utils/permissions");
const { goLiveAt } = require("../utils/autoPublish");
const { getKpis } = require("./kpi.controller");

const IST = 330 * 60000;
const HOUR = 3600000;
const MAX_ITEMS = 8;
const istDay = (d) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const day = (v) => (v ? String(v).slice(0, 10) : "");
const teamOf = (p) => { const t = p && p.team; if (t && typeof t === "object") return t; try { return JSON.parse(t || "{}") || {}; } catch { return {}; } };
const fmt = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtWhen = (date) => new Date(date.getTime() + IST).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const clip = (s, n = 120) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const PLATFORM = { instagram: "Instagram", facebook: "Facebook" };
const STAGE = { planned: "Planned", client: "Need from client", production: "In production", approval: "Pending approval", ready: "Ready to post", posted: "Posted" };
const POST_ATTRS = ["id", "client", "theme", "format", "status", "postDate", "postTime", "assigneeId", "team", "step"];

const today = asyncHandler(async (req, res) => {
  const scope = req.socialScope; // null = admin (all brands)
  const me = Number(req.user.id);
  const roles = req.user.roles || [];
  const isAdmin = !scope;
  const brandWhere = scope ? { client: { [Op.in]: [...scope] } } : {};
  const now = new Date();
  const todayIso = istDay(now);
  const monday = addDays(todayIso, -((new Date(todayIso + "T00:00:00Z").getUTCDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const soon = addDays(todayIso, 2); // 48 h ahead, by date; exact time checked below

  const canRenewals = rolesCan(roles, "renewals");
  const [posts, overdueCount, jobs, renewals, kpi, leadCounts] = await Promise.all([
    // Anything in approval, this whole week, and everything up to two days
    // ahead (at risk). Overdue posts (go-live passed, any age) are only
    // counted — loading them all made this the slowest part of the page.
    SocialPost.findAll({
      where: { ...brandWhere, [Op.or]: [
        { status: "approval" },
        { postDate: { [Op.between]: [monday < todayIso ? monday : todayIso, soon > sunday ? soon : sunday] } },
      ] },
      attributes: POST_ATTRS,
      raw: true,
    }),
    SocialPost.count({ where: { ...brandWhere, status: { [Op.ne]: "posted" }, postDate: { [Op.lt]: todayIso } } }),
    SocialPublishJob.findAll({
      where: { ...brandWhere, status: { [Op.in]: ["failed", "check", "missed"] } },
      attributes: ["id", "postId", "client", "platform", "status", "error", "runAt", "updatedAt"],
      order: [["updatedAt", "DESC"]], limit: 50,
    }),
    canRenewals
      ? Renewal.findAll({ where: { status: "active", renewalDate: { [Op.lte]: addDays(todayIso, 7) } }, order: [["renewalDate", "ASC"]], limit: 50 })
      : [],
    getKpis({ period: "month", scope, userId: me }).catch((e) => { console.warn("today kpis:", e.message); return null; }),
    rolesCan(roles, "leads")
      ? require("./leads.controller").followUpCounts(req.user, isAdmin).catch(() => null)
      : null,
  ]);

  const postById = new Map(posts.map((p) => [p.id, p]));
  // Posts behind failed jobs that the main query didn't pick up (e.g. a later go-live).
  const missing = [...new Set(jobs.map((j) => j.postId).filter((id) => !postById.has(id)))];
  if (missing.length) for (const p of await SocialPost.findAll({ where: { id: missing }, attributes: POST_ATTRS })) postById.set(p.id, p);

  const mine = (p) => isAdmin || (p && (Number(p.assigneeId) === me || Object.values(teamOf(p)).map(Number).includes(me)));
  const isSocialRole = roles.includes("social");

  /* ── Counts (brand-wide within scope) ── */
  const open = posts.filter((p) => p.status !== "posted");
  const thisWeek = posts.filter((p) => { const d = day(p.postDate); return d >= monday && d <= sunday; });
  const isReady = (p) => p.status === "ready" || p.status === "posted";
  const counts = {
    overdue: overdueCount,
    approvals: posts.filter((p) => p.status === "approval").length,
    goingLiveWeek: thisWeek.length,
    scheduledWeek: thisWeek.filter(isReady).length,
    onTimeMonthPct: kpi?.team?.onTime ?? null,
    leadsFollowUpToday: leadCounts ? leadCounts.leadsFollowUpToday : null,     // null = no leads area
    leadsFollowUpOverdue: leadCounts ? leadCounts.leadsFollowUpOverdue : null,
  };

  /* ── Needs you ── */
  const needsYou = [];
  for (const j of jobs) {
    const p = postById.get(j.postId);
    if (!p || p.status === "posted") continue; // already live (e.g. marked posted by hand)
    if (!isAdmin && !mine(p) && !isSocialRole) continue;
    const where = PLATFORM[j.platform] || j.platform;
    needsYou.push({
      kind: "failed", id: j.id, postId: p.id, client: p.client, platform: j.platform, status: j.status,
      title: j.status === "check" ? `Check ${where}: ${p.theme}` : j.status === "missed" ? `Missed on ${where}: ${p.theme}` : `Auto-post failed: ${p.theme}`,
      sub: clip(`${p.client} · ${where}${j.error ? `: ${j.error}` : ""}`),
      link: `/dashboard/social-studio?post=${p.id}`,
    });
  }
  for (const p of posts.filter((x) => x.status === "approval").sort((a, b) => day(a.postDate).localeCompare(day(b.postDate)) || a.id - b.id)) {
    if (!isAdmin && Number(p.assigneeId) !== me) continue;
    const d = day(p.postDate);
    needsYou.push({
      kind: "approval", id: p.id, postId: p.id, client: p.client,
      title: `Approve: ${p.theme}`,
      sub: [p.client, p.format, d && (d < todayIso ? `go-live ${fmt(d)} has passed` : `goes live ${fmt(d)}`)].filter(Boolean).join(" · "),
      link: `/dashboard/social?post=${p.id}`,
    });
  }
  const horizon = now.getTime() + 48 * HOUR;
  const atRisk = open
    .filter((p) => ["planned", "client", "production"].includes(p.status))
    .map((p) => ({ p, at: goLiveAt(p) }))
    .filter(({ p, at }) => at && at.getTime() >= now.getTime() && at.getTime() <= horizon && mine(p))
    .sort((a, b) => a.at - b.at);
  for (const { p, at } of atRisk) {
    const hours = Math.max(0, Math.round((at - now) / HOUR));
    needsYou.push({
      kind: "atRisk", id: p.id, postId: p.id, client: p.client, goLiveAt: at.toISOString(),
      title: `Goes live in ${hours < 1 ? "under an hour" : `${hours} h`}: ${p.theme}`,
      sub: `${p.client} · still ${STAGE[p.status] || p.status} · ${fmtWhen(at)}`,
      link: `/dashboard/social?post=${p.id}`,
    });
  }
  const myName = String(req.user.name || "").trim().toLowerCase();
  for (const r of renewals) {
    const owner = String(r.owner || "").trim().toLowerCase();
    if (!isAdmin && owner && owner !== myName) continue;
    const d = day(r.renewalDate);
    const late = d < todayIso;
    needsYou.push({
      kind: "renewal", id: r.id, client: r.client, renewalDate: d,
      title: `${late ? "Renewal overdue" : d === todayIso ? "Renewal due today" : "Renewal due"}: ${r.client}`,
      sub: [r.project, r.amount ? `₹${Number(r.amount).toLocaleString("en-IN")}` : "", `${late ? "was due" : "due"} ${fmt(d)}`].filter(Boolean).join(" · "),
      link: "/dashboard/renewals",
    });
  }

  /* ── This week, Monday first ── */
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const ps = thisWeek.filter((p) => day(p.postDate) === d);
    return { day: d, total: ps.length, ready: ps.filter(isReady).length };
  });

  /* ── Team this month (from the cached KPIs) ── */
  const team = (kpi?.people || []).map((u) => ({
    id: u.id, name: u.name, avatar: u.avatar, role: u.role,
    onTimePct: u.onTime, delivered: u.delivered, open: u.open, overdue: u.overdue,
  }));

  // At most 8, but every kind present keeps at least one slot; order stays
  // failed → approval → atRisk → renewal.
  const keep = new Set();
  for (const kind of ["failed", "approval", "atRisk", "renewal"]) { const i = needsYou.findIndex((x) => x.kind === kind); if (i >= 0) keep.add(i); }
  for (let i = 0; i < needsYou.length && keep.size < MAX_ITEMS; i++) keep.add(i);
  const shown = needsYou.filter((_, i) => keep.has(i));

  res.json({ today: todayIso, weekFrom: monday, weekTo: sunday, counts, needsYou: shown, needsYouTotal: needsYou.length, week, team });
});

module.exports = { today };
