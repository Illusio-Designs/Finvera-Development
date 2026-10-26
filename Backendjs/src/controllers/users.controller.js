const bcrypt = require("bcryptjs");
const { User, SocialClient } = require("../models");
const { notifyUsers } = require("../utils/notify");
const { asyncHandler } = require("../utils/crud");
const { ACCEPTED_ROLES, rolesOf } = require("../utils/permissions");

/* Accept either a single `role` or a `roles` array; return a clean, de-duped
   array of valid roles. Empty means none were chosen — callers refuse that
   rather than quietly making the user an admin. */
function normRoles(roles, role) {
  let list = Array.isArray(roles) ? roles : (role != null ? [role] : []);
  return [...new Set(list.filter((r) => ACCEPTED_ROLES.includes(r)))];
}
const NO_ROLE = { message: "Choose at least one role for this user." };

/* Social media brand ids (as strings, matching the multiselect); [] = all brands.
   Accepts an array or a JSON string (MySQL can hand JSON back as text). */
function normBrands(v) {
  let a = v;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = []; } }
  return Array.isArray(a) ? [...new Set(a.map(String).filter((x) => /^\d+$/.test(x)))] : [];
}

/* Tell someone which social brands they were just given. */
async function announceBrands(user, before, actorId) {
  try {
    const added = normBrands(user.socialClients).filter((id) => !before.includes(id));
    if (!added.length) return;
    const names = (await SocialClient.findAll({ where: { id: added.map(Number) } })).map((b) => b.name);
    if (!names.length) return;
    await notifyUsers([user.id], {
      type: "info",
      title: names.length === 1 ? `You now have access to ${names[0]}` : `You now have access to ${names.length} brands`,
      body: names.length === 1 ? "Its content calendar is in Social media → Content calendar." : names.join(", "),
      link: "/dashboard/social",
    }, actorId);
  } catch (e) { console.warn("announceBrands:", e.message); }
}

/* New roles / brands may make someone the right person for waiting posts. */
async function sweepSocial() {
  try { await require("./social.controller").assignUnassigned({ force: true }); }
  catch (e) { console.warn("social sweep:", e.message); }
}

const safe = (u) => ({
  id: u.id, name: u.name, email: u.email,
  role: rolesOf(u)[0] || u.role,
  roles: rolesOf(u),
  active: u.active, avatar: u.avatar, title: u.title, createdAt: u.createdAt,
  socialClients: normBrands(u.socialClients),
});

const list = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ order: [["createdAt", "ASC"]] });
  res.json(users.map(safe));
});

/* Minimal directory for member pickers (kanban assignees, etc.). Any signed-in
   user may read it; exposes only id/name/avatar/title — no emails or roles. */
const assignable = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ where: { active: true }, order: [["name", "ASC"]] });
  res.json(users.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, title: u.title })));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, roles, active, avatar, title, socialClients } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  const list = normRoles(roles, role);
  if (!list.length) return res.status(400).json(NO_ROLE);
  const user = await User.create({
    name, email: String(email).toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: list[0], roles: list,
    active: active !== false,
    avatar: avatar || null,
    title: title || null,
    socialClients: normBrands(socialClients),
  });
  await announceBrands(user, [], req.user?.id);
  await sweepSocial();
  res.status(201).json(safe(user));
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { name, email, password, role, roles, active, avatar, title, socialClients } = req.body;
  const brandsBefore = normBrands(user.socialClients);
  if (name != null) user.name = name;
  if (email != null) user.email = String(email).toLowerCase().trim();
  if (roles != null || role != null) {
    const l = normRoles(roles, role);
    if (!l.length) return res.status(400).json(NO_ROLE);
    user.roles = l; user.role = l[0];
  }
  if (active != null) user.active = active;
  if (avatar !== undefined) user.avatar = avatar || null;
  if (title !== undefined) user.title = title || null;
  if (socialClients !== undefined) user.socialClients = normBrands(socialClients);
  if (password) user.password = await bcrypt.hash(password, 10);
  await user.save();
  await announceBrands(user, brandsBefore, req.user?.id);
  await sweepSocial();
  res.json(safe(user));
});

const remove = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: "You can't delete your own account." });
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  await user.destroy();
  res.json({ message: "Deleted.", id: Number(req.params.id) });
});

module.exports = { list, assignable, create, update, remove };
