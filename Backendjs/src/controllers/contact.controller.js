const { Op } = require("sequelize");
const { ContactSubmission } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { notifyRoles } = require("../utils/notify");

/* ── Spam guard for the public form ──
   • honeypot: hidden fields `website` / `company_url` — a person never fills them
   • startedAt: ms timestamp of when the form was shown; sent < 3 s later = bot
     (missing → allowed, for older forms)
   • the same message from the same email / IP within 10 minutes = duplicate
   • Cloudflare Turnstile when TURNSTILE_SECRET is set (turnstileToken required)
   Certain bots get a normal-looking success and nothing is stored. Borderline
   cases (many links, captcha service unreachable) are stored with isSpam=true:
   hidden from the inbox, no alerts, visible with GET /api/contact?spam=1. */
const OK_MESSAGE = "Thanks! Your message has been received.";
const fakeOk = (res) => res.status(201).json({ message: OK_MESSAGE, id: null });
const MIN_FILL_MS = 3000;
const linkCount = (s) => (String(s || "").match(/https?:\/\/|www\.|\[url|<a\s/gi) || []).length;

async function verifyTurnstile(token, ip) {
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    return data.success ? "ok" : "failed";
  } catch (e) {
    console.warn("turnstile:", e.message);
    return "unavailable";
  }
}

/* Public: submit the contact form */
const submit = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const { name, email, phone, company, projectType, message } = b;

  // 1. Honeypot → pretend it worked.
  if (String(b.website || "").trim() || String(b.company_url || "").trim()) return fakeOk(res);
  // 2. Filled in faster than a person can.
  const started = Number(b.startedAt);
  if (b.startedAt != null && b.startedAt !== "" && Number.isFinite(started) && started > 0) {
    const took = Date.now() - started;
    if (took >= 0 && took < MIN_FILL_MS) return fakeOk(res);
  }

  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email and message are required." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ message: "Please provide a valid email." });
  }

  // 3. Captcha (only when configured).
  let spamReason = null;
  if (process.env.TURNSTILE_SECRET) {
    if (!b.turnstileToken) return res.status(400).json({ message: "Please complete the security check and try again." });
    const v = await verifyTurnstile(b.turnstileToken, req.ip);
    if (v === "failed") return res.status(400).json({ message: "The security check failed — please try again." });
    if (v === "unavailable") spamReason = "Captcha service unreachable";
  }

  const clean = {
    name: String(name).slice(0, 160),
    email: String(email).slice(0, 160),
    phone: phone ? String(phone).slice(0, 40) : null,
    company: company ? String(company).slice(0, 160) : null,
    projectType: projectType ? String(projectType).slice(0, 120) : null,
    message: String(message).slice(0, 5000),
  };

  // 4. Duplicate of a message sent in the last 10 minutes → already have it.
  const dup = await ContactSubmission.findOne({
    where: { message: clean.message, createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60000) }, [Op.or]: [{ email: clean.email }, { ip: req.ip || "" }] },
    attributes: ["id"],
  });
  if (dup) return fakeOk(res);

  // 5. Links: a link in the name, or more than 2 in the message → suspected spam.
  const links = linkCount(clean.message);
  if (!spamReason && linkCount(clean.name) > 0) spamReason = "Link in the name";
  if (!spamReason && links > 2) spamReason = `${links} links in the message`;

  const isSpam = !!spamReason;
  const row = await ContactSubmission.create({ ...clean, ip: req.ip, isSpam, spamReason, isRead: isSpam });
  res.status(201).json({ message: OK_MESSAGE, id: row.id });
  if (isSpam) return; // kept for review, no alerts

  await notifyRoles(["leads", "contact"], {
    type: "enquiry",
    title: `New enquiry from ${row.name}`,
    body: (row.projectType ? row.projectType + " — " : "") + String(message).slice(0, 120),
    link: "/dashboard/contact",
    meta: { contactId: row.id },
  });
  emailNewEnquiry(row);
});

/* Email the new enquiry to admins + everyone who can see the inbox
   (contact / leads roles), reply-to = the sender. Never blocks or throws. */
function emailNewEnquiry(row) {
  (async () => {
    const { usersWithRoles, emailUsers, layout, esc, dashboardUrl } = require("../utils/emails");
    if (!require("../utils/mailer").configured()) return;
    const users = await usersWithRoles(["contact", "leads"]);
    const lines = [
      ["Name", row.name], ["Email", row.email], ["Phone", row.phone], ["Company", row.company], ["Project type", row.projectType],
    ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="color:#5b6478;padding:3px 12px 3px 0">${k}</td><td>${esc(v)}</td></tr>`).join("");
    emailUsers(users, "contact", {
      subject: `New enquiry from ${row.name}${row.projectType ? ` — ${row.projectType}` : ""}`,
      replyTo: `"${String(row.name).replace(/["\r\n<>]/g, "")}" <${String(row.email).replace(/[\r\n<>]/g, "")}>`,
      html: layout({
        title: `New enquiry from ${row.name}`,
        body: `<table style="font-size:14px;border-collapse:collapse">${lines}</table>
<div style="margin-top:14px;padding:12px 14px;background:#f4f6fb;border-radius:10px;white-space:pre-wrap">${esc(row.message)}</div>
<p style="color:#8a93aa;font-size:13px">Reply to this email to answer ${esc(row.name)} directly.</p>`,
        button: { label: "Open the inbox", url: dashboardUrl("/dashboard/contact") },
      }),
      text: `New enquiry from ${row.name} <${row.email}>${row.phone ? `\nPhone: ${row.phone}` : ""}${row.company ? `\nCompany: ${row.company}` : ""}${row.projectType ? `\nProject: ${row.projectType}` : ""}\n\n${row.message}`,
    });
  })().catch((e) => console.warn("contact email:", e.message));
}

/* Admin: list submissions. Without params: every non-spam submission, newest first
   (as before). Opt-in: ?q= (name, email, company, project type, message),
   ?unread=1, ?sort=field|-field, ?page=&limit= → { items, total, page, limit }. */
const CONTACT_SEARCH = ["name", "email", "company", "projectType", "message", "phone"];
const contactWhere = (q) => {
  const { Op } = require("sequelize");
  const where = {};
  if (q.q) where[Op.or] = CONTACT_SEARCH.map((f) => ({ [f]: { [Op.like]: `%${String(q.q).slice(0, 100)}%` } }));
  if (q.unread === "1" || q.unread === "true") where[Op.and] = [{ [Op.or]: [{ isRead: false }, { isRead: null }] }];
  // Suspected spam is hidden unless asked for: ?spam=1 → only the spam rows.
  where.isSpam = ["1", "true", "yes"].includes(String(q.spam || "").toLowerCase());
  return where;
};
const list = asyncHandler(async (req, res) => {
  const { pageOf, sortOf, paged } = require("../utils/paginate");
  const order = sortOf(req, Object.keys(ContactSubmission.rawAttributes), [["createdAt", "DESC"]]);
  const where = contactWhere(req.query);
  const p = pageOf(req);
  if (p) return paged(res, await ContactSubmission.findAndCountAll({ where, order, limit: p.limit, offset: p.offset }), p);
  const rows = await ContactSubmission.findAll({ where, order });
  res.json(rows);
});

/* Admin: mark read / unread */
const setRead = asyncHandler(async (req, res) => {
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Submission not found." });
  row.isRead = req.body.isRead !== false;
  await row.save();
  res.json(row);
});

/* Admin: mark as spam / not spam. Not spam → back in the inbox as unread. */
const setSpam = asyncHandler(async (req, res) => {
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Submission not found." });
  const isSpam = req.body?.isSpam !== false;
  await row.update(isSpam ? { isSpam: true, spamReason: row.spamReason || "Marked by hand", isRead: true } : { isSpam: false, spamReason: null, isRead: false });
  res.json(row);
});

/* Admin: delete */
const remove = asyncHandler(async (req, res) => {
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Submission not found." });
  await row.destroy();
  res.json({ message: "Deleted.", id: Number(req.params.id) });
});

module.exports = { submit, list, setRead, setSpam, remove, contactWhere };
