/* Lead follow-ups: touches (calls, emails, meetings …), the follow-up
   widget, counts for badges / Today, and the daily reminder rows.

   POST /api/leads/:id/touch   { type, note?, nextFollowUpAt?: "YYYY-MM-DD" | null }
     → 201 { touch, lead }
   GET  /api/leads/:id/touches → [touch] newest first
   GET  /api/leads/follow-ups?range=today|overdue|week&mine=1
     → range given: [lead]; no range: { today, counts: { today, overdue, week }, overdue: [lead], week: [lead] }
   Open leads only (stage not won / lost). Dates are India time. */

const { Op } = require("sequelize");
const { Lead, LeadActivity } = require("../models");
const { asyncHandler } = require("../utils/crud");
const audit = require("../utils/audit");

const TOUCH_TYPES = ["call", "email", "whatsapp", "meeting", "note"];
const CONTACT_TYPES = ["call", "email", "whatsapp", "meeting"]; // a plain note isn't contact
const OPEN = { stage: { [Op.notIn]: ["won", "lost"] } };
const LIST_ATTRS = ["id", "name", "company", "email", "phone", "stage", "value", "priority", "owner", "ownerId",
  "nextFollowUpAt", "followUpNote", "meetingAt", "meetingUrl", "lastContactedAt", "source"];

const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* Leads of one user: owned by id, or by name on rows not yet linked. */
const mineWhere = (user) => ({ [Op.or]: [{ ownerId: user.id }, { ownerId: null, owner: user.name || "\u0000" }] });

const RANGES = {
  today: (t) => ({ nextFollowUpAt: t }),
  overdue: (t) => ({ nextFollowUpAt: { [Op.lt]: t } }),
  week: (t) => ({ nextFollowUpAt: { [Op.between]: [t, addDays(t, 6)] } }),
};

const touch = asyncHandler(async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found." });
  const type = String(req.body?.type || "note").toLowerCase();
  if (!TOUCH_TYPES.includes(type)) return res.status(400).json({ message: `type must be one of ${TOUCH_TYPES.join(", ")}.` });
  const note = String(req.body?.note || "").trim().slice(0, 5000) || null;
  const hasNext = req.body && Object.prototype.hasOwnProperty.call(req.body, "nextFollowUpAt");
  const next = hasNext ? (isDay(req.body.nextFollowUpAt) ? req.body.nextFollowUpAt : null) : undefined;
  if (hasNext && req.body.nextFollowUpAt && next === null) return res.status(400).json({ message: "nextFollowUpAt must be YYYY-MM-DD." });

  const before = lead.toJSON();
  const row = await LeadActivity.create({ leadId: lead.id, type, note, nextFollowUpAt: next || null, userId: req.user.id, userName: req.user.name || null });
  const patch = {};
  if (CONTACT_TYPES.includes(type)) patch.lastContactedAt = new Date();
  if (next !== undefined) patch.nextFollowUpAt = next;
  if (hasNext && req.body.followUpNote !== undefined) patch.followUpNote = String(req.body.followUpNote || "").slice(0, 5000) || null;
  if (type === "meeting" && req.body.meetingAt) { const d = new Date(req.body.meetingAt); if (!isNaN(d)) patch.meetingAt = d; }
  if (Object.keys(patch).length) await lead.update(patch);
  audit.record(req, {
    action: "other", entity: "lead", entityId: lead.id, entityLabel: lead.name,
    summary: `Logged ${type}${note ? `: ${note.slice(0, 200)}` : ""}`,
    before, after: lead,
  });
  res.status(201).json({ touch: row, lead });
});

const touches = asyncHandler(async (req, res) => {
  const rows = await LeadActivity.findAll({ where: { leadId: req.params.id }, order: [["createdAt", "DESC"], ["id", "DESC"]], limit: 500 });
  res.json(rows);
});

const followUps = asyncHandler(async (req, res) => {
  const t = todayIst();
  const mine = req.query.mine === "1" || req.query.mine === "true";
  const base = { ...OPEN, ...(mine ? mineWhere(req.user) : {}) };
  const order = [["nextFollowUpAt", "ASC"], ["priority", "DESC"], ["id", "ASC"]];
  const range = String(req.query.range || "");
  if (RANGES[range]) {
    return res.json(await Lead.findAll({ where: { ...base, ...RANGES[range](t) }, attributes: LIST_ATTRS, order, limit: 500, raw: true }));
  }
  // One call for the widget: everything due up to a week ahead, split here.
  const rows = await Lead.findAll({ where: { ...base, nextFollowUpAt: { [Op.lte]: addDays(t, 6) } }, attributes: LIST_ATTRS, order, limit: 1000, raw: true });
  const overdue = rows.filter((l) => String(l.nextFollowUpAt) < t);
  const today = rows.filter((l) => String(l.nextFollowUpAt) === t);
  const week = rows.filter((l) => String(l.nextFollowUpAt) >= t);
  res.json({ today: t, counts: { today: today.length, overdue: overdue.length, week: week.length }, overdue, week });
});

/* { leadsFollowUpToday, leadsFollowUpOverdue } for badges / Today.
   Admins count every open lead; everyone else their own. */
async function followUpCounts(user, isAdmin) {
  const t = todayIst();
  const base = { ...OPEN, ...(isAdmin ? {} : mineWhere(user)) };
  const [today, overdue] = await Promise.all([
    Lead.count({ where: { ...base, nextFollowUpAt: t } }),
    Lead.count({ where: { ...base, nextFollowUpAt: { [Op.lt]: t } } }),
  ]);
  return { leadsFollowUpToday: today, leadsFollowUpOverdue: overdue };
}

/* Daily reminder rows (type "lead_followup") for the 10:15 IST run:
   "Follow up today" / "Follow-up overdue" / "Meeting today" → the lead's owner
   (by ownerId, else by name); leads nobody owns → admins. */
async function reminderRows(today, users, adminIds) {
  const active = new Set(users.map((u) => u.id));
  const byName = new Map(users.map((u) => [u.name, u.id]));
  const leads = await Lead.findAll({
    where: { ...OPEN, [Op.or]: [{ nextFollowUpAt: { [Op.lte]: today } }, { meetingAt: { [Op.between]: [new Date(`${today}T00:00:00+05:30`), new Date(`${today}T23:59:59.999+05:30`)] } }] },
    attributes: LIST_ATTRS, raw: true,
  });
  const dayStart = Date.parse(`${today}T00:00:00+05:30`);
  const ownersOf = (l) => {
    const id = l.ownerId && active.has(l.ownerId) ? l.ownerId : l.owner ? byName.get(l.owner) : null;
    return id ? [id] : adminIds;
  };
  const groups = new Map(); // `${uid}|${kind}` → leads
  const put = (uid, kind, l) => { const k = `${uid}|${kind}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); };
  for (const l of leads) {
    const d = l.nextFollowUpAt ? String(l.nextFollowUpAt).slice(0, 10) : null;
    const kind = d === today ? "today" : d && d < today ? "overdue" : null;
    if (kind) for (const uid of ownersOf(l)) put(uid, kind, l);
    const m = l.meetingAt ? new Date(l.meetingAt).getTime() : NaN;
    if (m >= dayStart && m < dayStart + 86400000) for (const uid of ownersOf(l)) put(uid, "meeting", l);
  }
  const who = (l) => (l.company ? `${l.name} (${l.company})` : l.name);
  const list = (ls) => ls.slice(0, 4).map(who).join(", ") + (ls.length > 4 ? ` +${ls.length - 4} more` : "");
  const hhmm = (v) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(11, 16);
  const rows = [];
  for (const [k, ls] of groups) {
    const [uid, kind] = k.split("|");
    const one = ls.length === 1 ? ls[0] : null;
    const title = kind === "today"
      ? (one ? `Follow up today: ${who(one)}` : `Follow up today with ${ls.length} leads`)
      : kind === "overdue"
        ? (one ? `Follow-up overdue: ${who(one)}` : `${ls.length} lead follow-ups are overdue`)
        : (one ? `Meeting today: ${who(one)} at ${hhmm(one.meetingAt)}` : `${ls.length} lead meetings today`);
    const body = one
      ? [kind === "overdue" ? `Was due ${one.nextFollowUpAt}` : null, one.followUpNote ? String(one.followUpNote).slice(0, 140) : null, kind === "meeting" && one.meetingUrl ? one.meetingUrl : null].filter(Boolean).join(" · ") || null
      : list(ls);
    rows.push({
      userId: Number(uid), type: "lead_followup", title: title.slice(0, 250), body,
      link: one ? `/dashboard/leads?lead=${one.id}` : "/dashboard/leads",
      meta: { kind: `followup-${kind}`, day: today, leadIds: ls.map((l) => l.id) },
    });
  }
  return rows;
}

/* A lead was deleted → its touches go too. */
async function forgetLead(id) {
  try { await LeadActivity.destroy({ where: { leadId: id } }); } catch (e) { console.warn("lead touches:", e.message); }
}

module.exports = { touch, touches, followUps, followUpCounts, reminderRows, forgetLead, todayIst, TOUCH_TYPES, LIST_ATTRS };
