/* Contact inbox extras (all behind the "contact" area):
     GET  /api/contact/counts          → { all, unread, spam }
     GET  /api/contact/:id             → one submission (deep links ?msg=ID)
     GET  /api/contact/:id/replies     → email replies sent from the inbox, newest first
     POST /api/contact/:id/reply       { subject?, message } → { reply, emailed }
     POST /api/contact/:id/to-lead     → { lead, created } (idempotent)
   The list / read / spam / delete endpoints stay in contact.controller.js. */
const { Op } = require("sequelize");
const { ContactSubmission, ContactReply, Lead, sequelize } = require("../models");
const { asyncHandler } = require("../utils/crud");

const NOT_FOUND = { message: "Submission not found." };
const NO_MAIL = "Email isn't set up yet — copy the text and reply from your mail app.";
const unreadWhere = { [Op.or]: [{ isRead: false }, { isRead: null }] };

const counts = asyncHandler(async (_req, res) => {
  const [all, unread, spam] = await Promise.all([
    ContactSubmission.count({ where: { isSpam: false } }),
    ContactSubmission.count({ where: { isSpam: false, ...unreadWhere } }),
    ContactSubmission.count({ where: { isSpam: true } }),
  ]);
  res.json({ all, unread, spam });
});

const getOne = asyncHandler(async (req, res) => {
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json(NOT_FOUND);
  res.json(row);
});

const replies = asyncHandler(async (req, res) => {
  const rows = await ContactReply.findAll({ where: { contactId: req.params.id }, order: [["createdAt", "DESC"], ["id", "DESC"]], limit: 100 });
  res.json(rows);
});

const clean = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim();

const reply = asyncHandler(async (req, res) => {
  const mailer = require("../utils/mailer");
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json(NOT_FOUND);
  if (row.isSpam) return res.status(409).json({ message: "Restore this message from spam before replying." });
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ message: "Write a reply first.", field: "message" });
  if (message.length > 10000) return res.status(400).json({ message: "That reply is too long (10,000 characters at most).", field: "message" });
  const subject = clean(req.body?.subject).slice(0, 300) || `Re: your enquiry to Finvera${row.projectType ? ` (${clean(row.projectType)})` : ""}`;
  if (!mailer.configured()) return res.status(400).json({ message: NO_MAIL, code: "mail-not-configured" });

  const me = req.user || {};
  const esc = mailer.esc;
  const quoted = `<div style="margin-top:22px;padding:12px 14px;border-left:3px solid #d5dcea;color:#5b6478;font-size:13px;white-space:pre-wrap">`
    + `<div style="font-weight:600;margin-bottom:6px">${esc(row.name)} wrote on ${esc(new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }))}:</div>${esc(row.message)}</div>`;
  const html = mailer.layout({
    title: subject,
    body: `<p style="margin:0 0 12px">Hi ${esc(String(row.name).split(/\s+/)[0])},</p><div style="white-space:pre-wrap">${esc(message)}</div>`
      + `<p style="margin-top:18px">${esc(me.name || "The Finvera team")}<br><span style="color:#8a93aa">Finvera Solutions</span></p>${quoted}`,
  });
  const text = `Hi ${String(row.name).split(/\s+/)[0]},\n\n${message}\n\n${me.name || "The Finvera team"}\nFinvera Solutions\n\n> ${row.name} wrote:\n> ${String(row.message).split("\n").join("\n> ")}`;
  const replyTo = me.email ? `"${clean(me.name || "Finvera").replace(/["<>]/g, "")}" <${clean(me.email).replace(/[<>]/g, "")}>` : undefined;

  const r = await mailer.sendMail({ to: clean(row.email).replace(/[<>]/g, ""), subject, html, text, replyTo });
  if (!r.sent && (r.reason === "not-configured" || r.reason === "nodemailer-missing")) return res.status(400).json({ message: NO_MAIL, code: "mail-not-configured" });

  const saved = await ContactReply.create({
    contactId: row.id, userId: me.id || null, userName: me.name || null, subject, message,
    sent: !!r.sent, error: r.sent ? null : String(r.reason || "Unknown error").slice(0, 500),
  });
  if (!row.isRead) await row.update({ isRead: true });
  require("../utils/audit").record(req, {
    action: "other", entity: "contact", entityId: row.id, entityLabel: row.name,
    summary: r.sent ? `Replied by email: ${subject}` : `Email reply failed: ${String(r.reason || "").slice(0, 200)}`,
  });
  if (!r.sent) return res.status(502).json({ message: `The email couldn't be sent (${String(r.reason || "unknown error").slice(0, 200)}). Copy the text and reply from your mail app.`, reply: saved, emailed: false });
  res.status(201).json({ reply: saved, emailed: true });
});

const toLead = asyncHandler(async (req, res) => {
  const { rolesCan } = require("../utils/permissions");
  let created = false;
  const out = await sequelize.transaction(async (t) => {
    const row = await ContactSubmission.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) return null;
    if (row.isSpam) return { spam: true };
    if (row.leadId) {
      const existing = await Lead.findByPk(row.leadId, { transaction: t });
      if (existing) {
        if (!row.isRead) await row.update({ isRead: true }, { transaction: t });
        return { row, lead: existing };
      }
    }
    const note = [row.projectType ? `Project type: ${row.projectType}` : "", `From the website contact form (${new Date(row.createdAt).toISOString().slice(0, 10)}):`, row.message]
      .filter(Boolean).join("\n");
    const data = {
      name: String(row.name).slice(0, 255), email: row.email || null, phone: row.phone || null, company: row.company || null,
      source: "Website", stage: "new", notes: note,
    };
    if (Lead.rawAttributes.purpose) data.purpose = row.projectType || null;          // newer lead model
    if (req.user?.id && rolesCan(req.user.roles || [], "leads")) data.ownerId = req.user.id; // the person converting it
    const lead = await Lead.create(data, { transaction: t });
    await row.update({ leadId: lead.id, isRead: true }, { transaction: t });
    created = true;
    return { row, lead };
  });
  if (!out) return res.status(404).json(NOT_FOUND);
  if (out.spam) return res.status(409).json({ message: "Restore this message from spam before creating a lead." });
  const { row, lead } = out;
  if (created) {
    const audit = require("../utils/audit");
    audit.record(req, { action: "create", entity: "lead", entityId: lead.id, entityLabel: lead.name, after: lead, summary: `Created from a contact message (#${row.id})` });
    audit.record(req, { action: "other", entity: "contact", entityId: row.id, entityLabel: row.name, summary: `Converted to a lead (#${lead.id})` });
    const { notifyRoles } = require("../utils/notify");
    notifyRoles(["leads"], { type: "lead", title: `New lead: ${lead.name}`, body: row.projectType || lead.company || undefined, link: `/dashboard/leads?lead=${lead.id}`, meta: { leadId: lead.id } }, req.user?.id);
  }
  res.status(created ? 201 : 200).json({ lead, created, contact: row });
});

module.exports = { counts, getOne, replies, reply, toLead };
