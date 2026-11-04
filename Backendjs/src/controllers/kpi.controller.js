/* Content calendar performance KPIs.

   GET /api/social-kpis?period=week|month|quarter&brand=<name>
   Admins get the whole team; a team member gets only their own numbers
   plus team averages (both limited to their brands).

   Definitions (dates are India time):
     • Delivered   — completed maker handoff or Ready → Posted, credited to
                     the outgoing assignee once per post/person. Starting work,
                     scheduling and reassignment do not count as completion.
     • On time     — delivered on or before the post's go-live date.
     • Days in stage — time from when the post entered a stage to when it
                     moved on (needs both moves in the history).
     • Open / Overdue now — current assignments; overdue = go-live passed,
                     not posted.
     • Hours       — time-log entries by the person in the period, against the
                     estimates of the posts they logged time on. */

const { Op } = require("sequelize");
const { SocialPost, SocialPostEvent, User, Setting, Notification } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesOf } = require("../utils/permissions");
const { completedAssignments } = require("../utils/socialPerformance");

const ORDER = ["planned", "client", "production", "approval", "ready", "posted"];
const STAGE_NAMES = { planned: "Planned", client: "Need from client", production: "In production", approval: "Pending approval", ready: "Ready to post", posted: "Posted" };
const TEAM_ROLES = ["social", "marketer", "graphic", "video"];
const IST = 330 * 60000;

/* India-time calendar day of a timestamp. Called for every stage move and
   every time-log entry (tens of thousands per KPI run), so the string for
   each day number is built once and reused. */
const DAY_MS = 86400000;
const dayStr = new Map(); // day number → "YYYY-MM-DD"
const istDay = (d) => {
  const t = (d instanceof Date ? d.getTime() : typeof d === "number" ? d : new Date(d).getTime()) + IST;
  const n = Math.floor(t / DAY_MS);
  let s = dayStr.get(n);
  if (s === undefined) { s = new Date(n * DAY_MS).toISOString().slice(0, 10); if (dayStr.size > 20000) dayStr.clear(); dayStr.set(n, s); }
  return s;
};
const todayIst = () => istDay(Date.now());
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const day = (v) => (v ? String(v).slice(0, 10) : "");
const startUtc = (iso) => new Date(new Date(iso + "T00:00:00Z").getTime() - IST); // IST midnight as a Date
const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};
const round1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

function periodOf(kind, today) {
  const t = new Date(today + "T00:00:00Z");
  // A calendar month, "YYYY-MM" (the KPI report export): to its last day, or today for the running month.
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(kind)) {
    const [y, m] = kind.split("-").map(Number);
    const from = `${kind}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const prevFrom = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const label = new Date(from + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return { kind: "month", month: kind, from, to: end < today ? end : today, prevFrom, prevTo: addDays(from, -1), label };
  }
  if (kind === "week") {
    const from = addDays(today, -((t.getUTCDay() + 6) % 7)); // Monday
    return { kind, from, to: today, prevFrom: addDays(from, -7), prevTo: addDays(from, -1), label: "This week" };
  }
  if (kind === "quarter") {
    const from = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 2, 1)).toISOString().slice(0, 10);
    const prevFrom = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 5, 1)).toISOString().slice(0, 10);
    return { kind, from, to: today, prevFrom, prevTo: addDays(from, -1), label: "Last 3 months" };
  }
  const from = today.slice(0, 8) + "01";
  const prevFrom = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  return { kind: "month", from, to: today, prevFrom, prevTo: addDays(from, -1), label: "This month" };
}

/* Week buckets (Monday-based) ending with the current week. */
function weekBuckets(today, n) {
  const t = new Date(today + "T00:00:00Z");
  const monday = addDays(today, -((t.getUTCDay() + 6) % 7));
  return Array.from({ length: n }, (_, i) => {
    const from = addDays(monday, -7 * (n - 1 - i));
    return { from, to: addDays(from, 6), label: new Date(from + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) };
  });
}

/* One-time catch-up for work finished before the stage history existed.
   Each finished stage is credited to the person who did it, not to whoever
   holds the post now — e.g. a graphic designer who designed a post and sent
   it to Ready to post gets that delivery, the Social media person gets the
   posting. Who and when come from what was recorded at the time:
     • who  — someone with that stage's role who logged time on the post (most
              minutes wins), else the last one of them it was assigned to
              (assignment notifications); for Posted, the current assignee
     • when — when the next stage's person was given the post, else the
              maker's last time-log entry, else when the post was last saved;
              Posted counts on its go-live date
   Stages nobody can be matched to still count in the team totals.
   Claimed atomically so it runs exactly once. */
const BACKFILL_KEY = "social.kpiBackfill.v2";
let backfillChecked = false;
const parseMeta = (m) => (typeof m === "string" ? (() => { try { return JSON.parse(m); } catch { return {}; } })() : (m || {}));

async function backfillOnce() {
  if (backfillChecked) return;
  try {
    await Setting.findOrCreate({ where: { key: BACKFILL_KEY }, defaults: { key: BACKFILL_KEY, value: "", group: "system", isPublic: false } });
    const [claimed] = await Setting.update({ value: `running ${new Date().toISOString()}` }, { where: { key: BACKFILL_KEY, [Op.or]: [{ value: null }, { value: "" }] } });
    backfillChecked = true;
    if (!claimed) return;
    const { stageRole } = require("./social.controller");
    const today = todayIst();
    const [posts, events, users, notes] = await Promise.all([
      SocialPost.findAll({ where: { status: { [Op.ne]: "planned" } } }),
      SocialPostEvent.findAll({ attributes: ["postId", "toStatus"] }),
      User.findAll(),
      Notification.findAll({ where: { type: "assigned", title: { [Op.like]: "%social post%" } }, order: [["createdAt", "ASC"]] }),
    ]);
    const have = new Set(events.map((e) => `${e.postId}|${e.toStatus}`));
    const roleOf = new Map(users.map((u) => [u.id, rolesOf(u)]));
    const hasRole = (uid, r) => (roleOf.get(Number(uid)) || []).includes(r);
    // assignment notifications per post: [{ userId, at }]
    const assignedTo = new Map();
    for (const n of notes) {
      const m = parseMeta(n.meta);
      let pid = m.socialPostId ? Number(m.socialPostId) : null;
      if (!pid) {
        const theme = String(n.title).split(": ").slice(1).join(": ");
        const hit = theme && posts.find((p) => p.theme === theme);
        pid = hit ? hit.id : null;
      }
      if (!pid) continue;
      if (!assignedTo.has(pid)) assignedTo.set(pid, []);
      assignedTo.get(pid).push({ userId: n.userId, at: new Date(n.createdAt) });
    }

    const rows = [];
    const noonOf = (iso) => new Date(startUtc(iso).getTime() + 12 * 3600000);
    for (const p of posts) {
      const reached = ORDER.indexOf(p.status);
      const isReel = /reel|video|influencer/i.test(p.format || "");
      const logs = asArr(p.timeLog).filter((l) => l && l.userId);
      const given = assignedTo.get(p.id) || [];
      // hand-offs this post has completed: [from, to]
      const steps = [];
      if (isReel && reached >= 2) steps.push(["client", "production"]);   // Marketer → Video editor
      if (reached >= ORDER.indexOf("ready")) steps.push(["production", "ready"]);  // maker → Social media
      if (reached >= ORDER.indexOf("posted")) steps.push(["ready", "posted"]);     // Social media posts it
      for (const [from, to] of steps) {
        if (have.has(`${p.id}|${to}`)) continue;
        const role = stageRole(from, p.format);
        let who = null, at = null;
        if (to === "posted") {
          who = p.assigneeId && hasRole(p.assigneeId, "social") ? p.assigneeId : (given.filter((g) => hasRole(g.userId, "social")).pop()?.userId ?? p.assigneeId ?? null);
          const goLive = day(p.postDate);
          at = goLive && goLive <= today ? noonOf(goLive) : new Date(p.updatedAt || Date.now());
        } else {
          const minutes = new Map();
          for (const l of logs) if (hasRole(l.userId, role)) minutes.set(Number(l.userId), (minutes.get(Number(l.userId)) || 0) + (Number(l.minutes) || 0));
          const top = [...minutes.entries()].sort((a, b) => b[1] - a[1])[0];
          who = top ? top[0] : (given.filter((g) => hasRole(g.userId, role)).pop()?.userId ?? null);
          const nextRole = stageRole(to, p.format);
          const handed = given.find((g) => hasRole(g.userId, nextRole));
          const lastLog = logs.filter((l) => Number(l.userId) === who).map((l) => new Date(l.at)).sort((a, b) => b - a)[0];
          at = handed ? handed.at : lastLog || (ORDER.indexOf(to) === reached ? new Date(p.updatedAt || Date.now()) : (day(p.postDate) ? noonOf(day(p.postDate)) : new Date(p.updatedAt || Date.now())));
        }
        if (at > new Date()) at = new Date();
        rows.push({ postId: p.id, client: p.client, format: p.format || null, fromStatus: from, toStatus: to,
          fromAssigneeId: who, toAssigneeId: null, byUserId: null, postDate: p.postDate || null, at });
      }
    }
    if (rows.length) await SocialPostEvent.bulkCreate(rows);
    await Setting.update({ value: `done ${today} (${rows.length} stages)` }, { where: { key: BACKFILL_KEY } });
    console.log(`\x1b[36mℹ KPI catch-up: ${rows.length} finished stages credited\x1b[0m`);
  } catch (e) {
    backfillChecked = false;
    console.warn("KPI catch-up:", e.message);
  }
}

/* ── In-memory cache ──
   Results are kept for 10 minutes per (day, period, brand, caller scope).
   Any stage change clears the lot (bumpKpiCache), so numbers never lag
   behind the board; a computation started before a bump is not kept. */
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map(); // key → { at, value: Promise }
let generation = 0;

function bumpKpiCache() { generation += 1; cache.clear(); }

function cacheKey({ period, brand, scope, userId }) {
  const who = scope ? `u${userId}:${[...scope].sort().join(",")}` : "all";
  return `${todayIst()}|${period}|${brand}|${who}`;
}

/* Cached KPIs. `scope` null = whole team (admin); otherwise a Set of brand
   names, and only `userId`'s own row is returned in people. */
function getKpis({ period = "month", brand = "", scope = null, userId = null } = {}) {
  const args = { period: String(period || "month"), brand: brand ? String(brand) : "", scope, userId };
  const key = cacheKey(args);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const gen = generation;
  const value = computeKpis(args);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
  value.then(
    () => { if (gen !== generation && cache.get(key)?.value === value) cache.delete(key); }, // bumped mid-way
    () => { if (cache.get(key)?.value === value) cache.delete(key); },
  );
  return value;
}

const kpis = asyncHandler(async (req, res) => {
  res.json(await getKpis({ period: req.query.period, brand: req.query.brand, scope: req.socialScope, userId: req.user.id }));
});

const KPI_POST_ATTRS = ["id", "client", "status", "postDate", "postTime", "dueDate", "assigneeId", "theme", "format", "estimateHours", "timeLog"];
const KPI_EVENT_ATTRS = ["id", "postId", "client", "format", "fromStatus", "toStatus", "fromAssigneeId", "toAssigneeId", "postDate", "postTime", "at"];

async function computeKpis({ period, brand, scope, userId }) {
  await backfillOnce();
  const today = todayIst();
  const P = periodOf(period, today);
  const meOnly = !!scope; // scope null = admin (all brands)
  const brandFilter = brand;
  if (scope && brandFilter && !scope.has(brandFilter)) return { period: P, team: null, people: [] };
  const brandWhere = brandFilter ? { client: brandFilter } : scope ? { client: [...scope] } : {};

  const weeks = weekBuckets(today, P.kind === "quarter" ? 12 : 8);
  const historyFrom = [P.prevFrom, weeks[0].from].sort()[0];

  // Only the columns used below, as plain rows: the posts' captions, briefs
  // and media made this the heaviest read in the app, and it reruns after
  // every stage change (bumpKpiCache).
  const [posts, events, users, firstEvent] = await Promise.all([
    SocialPost.findAll({ where: brandWhere, attributes: KPI_POST_ATTRS, raw: true }),
    SocialPostEvent.findAll({ where: { ...brandWhere, at: { [Op.gte]: startUtc(addDays(historyFrom, -120)) } }, attributes: KPI_EVENT_ATTRS, order: [["at", "ASC"]], raw: true }),
    User.findAll({ where: { active: true } }),
    SocialPostEvent.min("at", { where: { byUserId: { [Op.ne]: null } } }), // first real (not caught-up) move
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));

  // Each event's duration in its stage = time since the post's previous event.
  const lastByPost = new Map();
  const moves = [];
  for (const e of events) {
    const prev = lastByPost.get(e.postId);
    lastByPost.set(e.postId, e);
    if (!e.fromStatus) continue;

    const d = istDay(e.at);
    const goLive = day(e.postDate) || day(postById.get(e.postId)?.postDate);
    moves.push({
      postId: e.postId, client: e.client, format: e.format, from: e.fromStatus, to: e.toStatus,
      who: e.fromAssigneeId, day: d, // Legacy events have only a date: retain their original day-level result.
      // New events snapshot the time and support an exact IST deadline.
      onTime: goLive ? e.postTime ? +new Date(e.at) <= +require("../utils/socialDeadline").goLiveAt({ postDate: goLive, postTime: e.postTime }) : d <= goLive : null,
      deadlinePrecision: e.postTime ? "minute" : "day",
      days: prev && prev.toStatus === e.fromStatus && Number(prev.toAssigneeId) === Number(e.fromAssigneeId) ? (new Date(e.at) - new Date(prev.at)) / 86400000 : null,
    });
  }
  const inRange = (d, a, b) => d >= a && d <= b;
  const delivered = completedAssignments(moves);

  // Time log entries (minutes) in a date range, by user.
  const logs = [];
  for (const p of posts) for (const l of asArr(p.timeLog)) {
    if (!l || !l.userId || !l.at) continue;
    logs.push({ userId: Number(l.userId), postId: p.id, client: p.client, minutes: Number(l.minutes) || 0, day: istDay(l.at), est: Number(p.estimateHours) || 0 });
  }

  // Grouped once by person (in event order) so each person's numbers scan
  // only their own moves / time logs instead of the whole history again.
  const groupBy = (list, keyOf) => { const m = new Map(); for (const x of list) { const k = keyOf(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const deliveredBy = groupBy(delivered, (m) => Number(m.who));
  const logsBy = groupBy(logs, (l) => l.userId);
  const logMinutes = new Map(); // "postId|userId" → minutes
  for (const l of logs) { const k = `${l.postId}|${l.userId}`; logMinutes.set(k, (logMinutes.get(k) || 0) + l.minutes); }
  const weekStart = Date.parse(weeks[0].from + "T00:00:00Z");
  const weekIdx = new Map();
  const weekOf = (d) => {
    let i = weekIdx.get(d);
    if (i === undefined) { i = Math.floor((Date.parse(d + "T00:00:00Z") - weekStart) / (7 * 86400000)); if (!(i >= 0 && i < weeks.length)) i = -1; weekIdx.set(d, i); }
    return i;
  };

  function statsFor(filterUser, moves = delivered, logList = logs) {
    const del = moves.filter((m) => inRange(m.day, P.from, P.to) && filterUser(m.who));
    const prev = moves.filter((m) => inRange(m.day, P.prevFrom, P.prevTo) && filterUser(m.who));
    const stageDays = del.filter((m) => m.days != null).map((m) => m.days);
    const myLogs = logList.filter((l) => inRange(l.day, P.from, P.to) && filterUser(l.userId));
    const wk = weeks.map((w) => ({ label: w.label, onTime: 0, late: 0, undated: 0 }));
    for (const m of moves) {
      if (!filterUser(m.who)) continue;
      const i = weekOf(m.day);
      if (i >= 0) { if (m.onTime == null) wk[i].undated++; else if (m.onTime) wk[i].onTime++; else wk[i].late++; }
    }
    const minutes = myLogs.reduce((s, l) => s + l.minutes, 0);
    const estPosts = new Map(myLogs.map((l) => [`${l.userId}|${l.postId}`, l.est]));
    const est = [...estPosts.values()].reduce((s, v) => s + v, 0);
    return {
      delivered: del.length, deliveredPrev: prev.length,
      onTime: pct(del.filter((m) => m.onTime === true).length, del.filter((m) => m.onTime != null).length), onTimePrev: pct(prev.filter((m) => m.onTime === true).length, prev.filter((m) => m.onTime != null).length),
      avgStageDays: stageDays.length ? round1(stageDays.reduce((a, b) => a + b, 0) / stageDays.length) : null,
      hours: round1(minutes / 60), estHours: est ? round1(est) : null,
      weeks: wk,
      del, myLogs,
    };
  }

  const open = posts.filter((p) => p.status !== "posted" && p.assigneeId);
  const overdueOf = (ps) => ps.filter((p) => require("../utils/socialDeadline").isOverdue(p));

  /* ── People ── */
  const isTeam = (u) => rolesOf(u).some((r) => TEAM_ROLES.includes(r));
  const involved = new Set([...open.map((p) => p.assigneeId), ...delivered.map((m) => m.who)].filter(Boolean).map(Number));
  let people = users.filter((u) => isTeam(u) || involved.has(u.id));
  if (meOnly) people = people.filter((u) => u.id === Number(userId));

  const roleLabel = { social: "Social media", marketer: "Marketer", graphic: "Graphic designer", video: "Video editor", admin: "Admin" };
  const rows = people.map((u) => {
    const s = statsFor((id) => Number(id) === u.id, deliveredBy.get(u.id) || [], logsBy.get(u.id) || []);
    const mine = open.filter((p) => Number(p.assigneeId) === u.id);
    const byBrand = new Map();
    for (const l of s.myLogs) byBrand.set(l.client, (byBrand.get(l.client) || 0) + l.minutes);
    const recent = s.del.slice(-8).reverse().map((m) => {
      const p = postById.get(m.postId);
      const minutes = logMinutes.get(`${m.postId}|${u.id}`) || 0;
      return { postId: m.postId, theme: p?.theme || "(deleted post)", client: m.client, format: m.format, day: m.day, to: STAGE_NAMES[m.to] || m.to, onTime: m.onTime, deadlinePrecision: m.deadlinePrecision, minutes };
    });
    return {
      id: u.id, name: u.name, avatar: u.avatar || null,
      role: rolesOf(u).map((r) => roleLabel[r] || r).join(", "),
      open: mine.length, overdue: overdueOf(mine).length,
      delivered: s.delivered, deliveredPrev: s.deliveredPrev, onTime: s.onTime, onTimePrev: s.onTimePrev,
      avgStageDays: s.avgStageDays, hours: s.hours, estHours: s.estHours, weeks: s.weeks,
      startsToday: mine.filter((p) => day(p.dueDate) === today).length,
      timeByBrand: [...byBrand.entries()].map(([brand, minutes]) => ({ brand, hours: round1(minutes / 60), posts: new Set(s.myLogs.filter((l) => l.client === brand).map((l) => l.postId)).size })).sort((a, b) => b.hours - a.hours),
      recent,
    };
  }).sort((a, b) => b.delivered - a.delivered || b.open - a.open);

  /* ── Team (always the whole team within the caller's brands) ── */
  const t = statsFor(() => true);
  const stages = ORDER.slice(0, 4).map((st) => {
    const ds = t.del.filter((m) => m.from === st && m.days != null).map((m) => m.days);
    return { status: st, name: STAGE_NAMES[st], days: ds.length ? round1(ds.reduce((a, b) => a + b, 0) / ds.length) : null, moves: ds.length };
  });
  // By brand: everything planned to go live in the period's full span
  // (the whole week / month / three months), posted vs overdue.
  const monthEnd = (iso) => { const d = new Date(iso.slice(0, 8) + "01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
  const spanTo = P.kind === "week" ? addDays(P.from, 6) : monthEnd(P.to);
  const brands = [...new Set(posts.map((p) => p.client))].sort().map((name) => {
    const planned = posts.filter((p) => p.client === name && p.postDate && inRange(day(p.postDate), P.from, spanTo));
    return { name, planned: planned.length, posted: planned.filter((p) => p.status === "posted").length, overdue: overdueOf(planned.filter((p) => p.status !== "posted")).length };
  }).filter((b) => b.planned > 0);

  return {
    period: { ...P, spanTo }, today, historySince: firstEvent ? istDay(firstEvent) : null,
    team: {
      delivered: t.delivered, deliveredPrev: t.deliveredPrev, onTime: t.onTime, onTimePrev: t.onTimePrev,
      overdue: overdueOf(open).length, open: open.length,
      avgStageDays: t.avgStageDays, hours: t.hours, estHours: t.estHours, weeks: t.weeks,
      people: people.length, stages, brands,
    },
    people: rows,
  };
}

module.exports = { kpis, getKpis, bumpKpiCache };
