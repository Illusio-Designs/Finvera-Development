/* Data export — clean, flat rows with human column names (the dashboard
   turns them into an .xlsx in the browser; no spreadsheet library here).

   GET /api/export/:entity?format=json  (+ the entity's filters, below)
     → { entity, columns: ["ID", "Name", …], rows: [{ "ID": 1, "Name": "…" }], total, truncated, generatedAt }
   Entities and who may export them:
     leads        leads area     ?q &stage &owner &source &priority &from &to (created, YYYY-MM-DD)
     renewals     renewals area  ?q &status &owner (__none = unassigned) &cycle &from &to (renewal date)
     contact      contact area   ?q &unread=1 &from &to (received)
     activity     admin          same filters as GET /api/activity
     social-posts social area    ?from &to (go-live date) &client &status &assigneeId &q — only the caller's brands
     tasks        board area     ?boardId &q
     users        admin          (no passwords or other secrets)
   Dates: "YYYY-MM-DD"; date-times "YYYY-MM-DD HH:mm" India time.

   GET /api/export/kpi-report?month=YYYY-MM  (social area; admins: whole team,
   others: their own row, both within their brands)
     → { month, label, period, team: { … }, columns, rows (one per person), brandColumns, brandRows, generatedAt } */

const { Op } = require("sequelize");
const { Lead, Renewal, ContactSubmission, ActivityLog, SocialPost, Task, Board, User, SocialClient } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesCan, rolesOf } = require("../utils/permissions");

const MAX_ROWS = 20000;
const IST = 330 * 60000;
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));
const asObj = (v) => (v && typeof v === "object" ? v : (() => { try { return JSON.parse(v || "{}") || {}; } catch { return {}; } })());
const d10 = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : "");
const dt = (v) => { if (!v) return ""; const t = new Date(v); return isNaN(t) ? "" : new Date(t.getTime() + IST).toISOString().slice(0, 16).replace("T", " "); };
const yes = (v) => (v ? "Yes" : "No");
const like = (fields, q) => ({ [Op.or]: fields.map((f) => ({ [f]: { [Op.like]: `%${String(q).slice(0, 100)}%` } })) });
const istStart = (iso) => new Date(`${iso}T00:00:00+05:30`);
const createdRange = (q) => {
  const r = {};
  if (isDay(q.from)) r[Op.gte] = istStart(q.from);
  if (isDay(q.to)) r[Op.lt] = new Date(istStart(q.to).getTime() + 86400000);
  return Object.getOwnPropertySymbols(r).length ? r : null;
};
const dayRange = (q) => {
  const r = {};
  if (isDay(q.from)) r[Op.gte] = q.from;
  if (isDay(q.to)) r[Op.lte] = q.to;
  return Object.getOwnPropertySymbols(r).length ? r : null;
};
const STAGES = { new: "New", contacted: "Contacted", qualified: "Qualified", proposal: "Proposal", won: "Won", lost: "Lost" };
const POST_STAGES = { planned: "Planned", client: "Need from client", production: "In production", approval: "Pending approval", ready: "Ready to post", posted: "Posted" };
const userNames = async () => new Map((await User.findAll({ attributes: ["id", "name"], raw: true })).map((u) => [u.id, u.name]));

/* entity → { area, rows(req) → [[colName, value], …][] } */
const EXPORTS = {
  leads: {
    area: "leads",
    async rows(req) {
      const q = req.query, where = {};
      const and = [];
      if (q.q) and.push(like(["name", "company", "email", "source", "owner", "purpose"], q.q));
      if (q.stage) where.stage = String(q.stage).split(",");
      if (q.owner) where.owner = q.owner;
      if (q.source) where.source = q.source;
      if (q.priority) where.priority = String(q.priority).split(",");
      const c = createdRange(q); if (c) where.createdAt = c;
      if (and.length) where[Op.and] = and;
      const rows = await Lead.findAll({ where, order: [["createdAt", "DESC"]], limit: MAX_ROWS + 1, raw: true });
      return rows.map((l) => [
        ["ID", l.id], ["Name", l.name], ["Company", l.company || ""], ["Purpose", l.purpose || ""], ["Email", l.email || ""], ["Phone", l.phone || ""],
        ["Source", l.source || ""], ["Stage", STAGES[l.stage] || l.stage || ""], ["Progress (%)", l.progress ?? ""], ["Value (₹)", Number(l.value) || 0],
        ["Owner", l.owner || ""], ["Priority", l.priority || ""], ["Next follow-up", d10(l.nextFollowUpAt || l.nextFollowUp)],
        ["Follow-up note", l.followUpNote || ""], ["Meeting at", dt(l.meetingAt)], ["Meeting link", l.meetingUrl || ""],
        ["Last contacted", dt(l.lastContactedAt)], ["Won at", dt(l.wonAt)], ["Lost reason", l.lostReason || ""], ["Notes", l.notes || ""],
        ["Created", dt(l.createdAt)], ["Updated", dt(l.updatedAt)],
      ]);
    },
  },
  renewals: {
    area: "renewals",
    async rows(req) {
      const q = req.query, where = {};
      if (q.q) Object.assign(where, like(["client", "project", "owner", "email"], q.q));
      if (q.status) where.status = String(q.status).split(",");
      if (q.owner) where.owner = q.owner === "__none" ? { [Op.or]: [null, ""] } : q.owner;
      if (q.cycle) where.cycle = String(q.cycle).split(",");
      const r = dayRange(q); if (r) where.renewalDate = r;
      const rows = await Renewal.findAll({ where, order: [["renewalDate", "ASC"], ["id", "ASC"]], limit: MAX_ROWS + 1, raw: true });
      return rows.map((x) => [
        ["ID", x.id], ["Client", x.client], ["Project", x.project || ""], ["Amount (₹)", Number(x.amount) || 0], ["Cycle", x.cycle || ""],
        ["Renewal date", d10(x.renewalDate)], ["Last invoiced", d10(x.lastInvoiced)], ["Status", x.status || ""], ["Owner", x.owner || ""],
        ["Email", x.email || ""], ["Phone", x.phone || ""], ["Notes", x.notes || ""], ["Created", dt(x.createdAt)], ["Updated", dt(x.updatedAt)],
      ]);
    },
  },
  contact: {
    area: "contact",
    async rows(req) {
      const where = require("./contact.controller").contactWhere(req.query);
      const c = createdRange(req.query); if (c) where.createdAt = c;
      const rows = await ContactSubmission.findAll({ where, order: [["createdAt", "DESC"]], limit: MAX_ROWS + 1, raw: true });
      return rows.map((m) => [
        ["ID", m.id], ["Received", dt(m.createdAt)], ["Name", m.name], ["Email", m.email], ["Phone", m.phone || ""], ["Company", m.company || ""],
        ["Project type", m.projectType || ""], ["Message", m.message || ""], ["Read", yes(m.isRead)],
      ]);
    },
  },
  activity: {
    area: "admin",
    async rows(req) {
      const { whereOf, fix } = require("./activity.controller");
      const rows = (await ActivityLog.findAll({ where: whereOf(req.query), order: [["createdAt", "DESC"], ["id", "DESC"]], limit: MAX_ROWS + 1, raw: true })).map(fix);
      const show = (v) => (v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
      return rows.map((a) => [
        ["When", dt(a.createdAt)], ["User", a.userName || ""], ["Action", a.action], ["Type", a.entity], ["Item ID", a.entityId || ""],
        ["Item", a.entityLabel || ""], ["Summary", a.summary || ""],
        ["Changes", a.changes && typeof a.changes === "object" ? Object.entries(a.changes).map(([f, [o, n]]) => `${f}: ${show(o)} → ${show(n)}`).join("; ") : ""],
        ["IP", a.ip || ""],
      ]);
    },
  },
  "social-posts": {
    area: "social",
    scoped: true,
    async rows(req) {
      const q = req.query, and = [];
      if (req.socialScope) { if (!req.socialScope.size) return []; and.push({ client: [...req.socialScope] }); }
      const r = dayRange(q); if (r) and.push({ postDate: r });
      if (q.client) and.push({ client: String(q.client).split(",") });
      if (q.status) and.push({ status: String(q.status).split(",") });
      if (q.assigneeId && /^\d+$/.test(q.assigneeId)) and.push({ assigneeId: Number(q.assigneeId) });
      if (q.q) and.push(like(["client", "theme", "topic", "caption", "festive"], q.q));
      const [rows, names] = await Promise.all([
        SocialPost.findAll({ where: and.length ? { [Op.and]: and } : {}, attributes: { exclude: ["timeLog", "media"] }, order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]], limit: MAX_ROWS + 1, raw: true }),
        userNames(),
      ]);
      const team = (p) => Object.entries(asObj(p.team)).filter(([, id]) => id).map(([role, id]) => `${role}: ${names.get(Number(id)) || id}`).join(", ");
      return rows.map((p) => [
        ["ID", p.id], ["Brand", p.client], ["Stage", POST_STAGES[p.status] || p.status], ["Go-live date", d10(p.postDate)], ["Time", p.postTime || ""],
        ["Start-work date", d10(p.dueDate)], ["Assigned to", names.get(p.assigneeId) || ""], ["Team", team(p)], ["Format", p.format || ""],
        ["Day / festival", p.festive || ""], ["Theme", p.theme || ""], ["Topic", p.topic || ""], ["Caption", p.caption || ""],
        ["Keywords", p.keywords || ""], ["Requirements", p.requirements || ""], ["Reference", p.reference || ""], ["Data status", p.dataStatus || ""],
        ["Client contact", p.poc || ""], ["Tags", p.tags || ""], ["Drive link", p.driveLink || ""], ["Live links", p.channels || ""],
        ["Remarks", p.remarks || ""], ["Estimate (h)", p.estimateHours ?? ""], ["Created", dt(p.createdAt)], ["Updated", dt(p.updatedAt)],
      ]);
    },
  },
  tasks: {
    area: "board",
    async rows(req) {
      const q = req.query, where = {};
      if (q.boardId) where.boardId = q.boardId;
      if (q.q) Object.assign(where, like(["title", "assignee", "label"], q.q));
      const [rows, boards, names] = await Promise.all([
        Task.findAll({ where, order: [["boardId", "ASC"], ["position", "ASC"]], limit: MAX_ROWS + 1, raw: true }),
        Board.findAll({ raw: true }),
        userNames(),
      ]);
      const byId = new Map(boards.map((b) => [b.id, { ...b, columns: asArr(b.columns), labels: asArr(b.labels) }]));
      return rows.map((t) => {
        const b = byId.get(t.boardId);
        const checklist = asArr(t.checklist);
        return [
          ["ID", t.id], ["Board", b?.name || ""], ["Title", t.title], ["Column", b?.columns.find((c) => c.id === t.column)?.title || t.column || ""],
          ["Priority", t.priority || ""], ["Start", d10(t.startDate)], ["Due", d10(t.dueDate)], ["Renewal", d10(t.renewalDate)], ["Completed", yes(t.completed)],
          ["Members", asArr(t.memberIds).map((id) => names.get(Number(id)) || id).join(", ")],
          ["Labels", asArr(t.labelIds).map((id) => b?.labels.find((l) => l.id === id)?.name).filter(Boolean).join(", ")],
          ["Checklist", checklist.length ? `${checklist.filter((c) => c && c.done).length}/${checklist.length}` : ""],
          ["Description", t.description || ""], ["Created", dt(t.createdAt)], ["Updated", dt(t.updatedAt)],
        ];
      });
    },
  },
  users: {
    area: "admin",
    async rows() {
      const [rows, brands] = await Promise.all([
        User.findAll({ attributes: ["id", "name", "email", "role", "roles", "active", "title", "socialClients", "createdAt"], order: [["createdAt", "ASC"]] }),
        SocialClient.findAll({ attributes: ["id", "name"], raw: true }),
      ]);
      const brandName = new Map(brands.map((b) => [String(b.id), b.name]));
      return rows.map((u) => [
        ["ID", u.id], ["Name", u.name], ["Email", u.email], ["Roles", rolesOf(u).join(", ")], ["Title", u.title || ""], ["Active", yes(u.active)],
        ["Brands", rolesOf(u).includes("admin") ? "All" : asArr(u.socialClients).map((id) => brandName.get(String(id))).filter(Boolean).join(", ")],
        ["Created", dt(u.createdAt)],
      ]);
    },
  },
};

const allowed = (req, area) => {
  const roles = req.user?.roles || [];
  return roles.includes("admin") || (area !== "admin" && rolesCan(roles, area));
};

/* Social exports need the caller's brand scope (req.socialScope). */
const scopeIfSocial = (req, res, next) => {
  const e = EXPORTS[req.params.entity];
  if (!e || !e.scoped || !allowed(req, e.area)) return next();
  return require("./social.controller").withScope(req, res, next);
};

const exportEntity = asyncHandler(async (req, res) => {
  const e = EXPORTS[req.params.entity];
  if (!e) return res.status(404).json({ message: `Nothing to export called "${req.params.entity}". Use one of: ${Object.keys(EXPORTS).join(", ")}, kpi-report.` });
  if (req.query.format && req.query.format !== "json") return res.status(400).json({ message: "Only format=json is supported (the dashboard builds the spreadsheet)." });
  if (!allowed(req, e.area)) return res.status(403).json({ message: "You do not have permission to do that." });
  const pairs = await e.rows(req);
  const truncated = pairs.length > MAX_ROWS;
  const list = truncated ? pairs.slice(0, MAX_ROWS) : pairs;
  const columns = list.length ? list[0].map(([k]) => k) : [];
  res.json({ entity: req.params.entity, columns, rows: list.map((p) => Object.fromEntries(p)), total: list.length, truncated, generatedAt: new Date().toISOString() });
});

const kpiReport = asyncHandler(async (req, res) => {
  const month = String(req.query.month || new Date(Date.now() + IST).toISOString().slice(0, 7));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ message: "month must be YYYY-MM." });
  const today = new Date(Date.now() + IST).toISOString().slice(0, 10);
  if (`${month}-01` > today) return res.status(400).json({ message: "That month hasn't started yet." });
  const { getKpis } = require("./kpi.controller");
  const k = await getKpis({ period: month, scope: req.socialScope, userId: req.user.id });
  const rows = (k.people || []).map((p) => ({
    Name: p.name, Role: p.role, Delivered: p.delivered, "Delivered (previous month)": p.deliveredPrev,
    "On time %": p.onTime ?? "", "On time % (previous month)": p.onTimePrev ?? "", "Avg days in stage": p.avgStageDays ?? "",
    "Hours logged": p.hours, "Estimated hours": p.estHours ?? "", "Open now": p.open, "Overdue now": p.overdue,
  }));
  const brandRows = (k.team?.brands || []).map((b) => ({ Brand: b.name, Planned: b.planned, Posted: b.posted, Overdue: b.overdue }));
  const t = k.team || {};
  res.json({
    month, label: k.period?.label, period: k.period,
    team: k.team ? {
      delivered: t.delivered, deliveredPrev: t.deliveredPrev, onTime: t.onTime, onTimePrev: t.onTimePrev,
      avgStageDays: t.avgStageDays, hours: t.hours, estHours: t.estHours, open: t.open, overdue: t.overdue, people: t.people,
      stages: (t.stages || []).map((s) => ({ stage: s.name, avgDays: s.days, moves: s.moves })),
    } : null,
    columns: rows.length ? Object.keys(rows[0]) : ["Name", "Role", "Delivered", "Delivered (previous month)", "On time %", "On time % (previous month)", "Avg days in stage", "Hours logged", "Estimated hours", "Open now", "Overdue now"],
    rows,
    brandColumns: ["Brand", "Planned", "Posted", "Overdue"],
    brandRows,
    generatedAt: new Date().toISOString(),
  });
});

module.exports = { exportEntity, kpiReport, scopeIfSocial, EXPORTS };
