const { ContactSubmission } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { notifyRoles } = require("../utils/notify");

/* Public: submit the contact form */
const submit = asyncHandler(async (req, res) => {
  const { name, email, phone, company, projectType, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email and message are required." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ message: "Please provide a valid email." });
  }
  const row = await ContactSubmission.create({
    name: String(name).slice(0, 160),
    email: String(email).slice(0, 160),
    phone: phone ? String(phone).slice(0, 40) : null,
    company: company ? String(company).slice(0, 160) : null,
    projectType: projectType ? String(projectType).slice(0, 120) : null,
    message: String(message).slice(0, 5000),
    ip: req.ip,
  });
  await notifyRoles(["leads", "contact"], {
    type: "enquiry",
    title: `New enquiry from ${row.name}`,
    body: (row.projectType ? row.projectType + " — " : "") + String(message).slice(0, 120),
    link: "/dashboard/contact",
    meta: { contactId: row.id },
  });
  res.status(201).json({ message: "Thanks! Your message has been received.", id: row.id });
});

/* Admin: list submissions */
const list = asyncHandler(async (req, res) => {
  const rows = await ContactSubmission.findAll({ order: [["createdAt", "DESC"]] });
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

/* Admin: delete */
const remove = asyncHandler(async (req, res) => {
  const row = await ContactSubmission.findByPk(req.params.id);
  if (!row) return res.status(404).json({ message: "Submission not found." });
  await row.destroy();
  res.json({ message: "Deleted.", id: Number(req.params.id) });
});

module.exports = { submit, list, setRead, remove };
