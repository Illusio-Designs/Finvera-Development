const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { ACCEPTED_ROLES, rolesOf } = require("../utils/permissions");

/* Accept either a single `role` or a `roles` array; return a clean, de-duped
   array of valid roles (defaults to ["admin"] if nothing valid was sent). */
function normRoles(roles, role) {
  let list = Array.isArray(roles) ? roles : (role != null ? [role] : []);
  list = [...new Set(list.filter((r) => ACCEPTED_ROLES.includes(r)))];
  return list.length ? list : ["admin"];
}

/* Social media brand ids (as strings, matching the multiselect); [] = all brands.
   Accepts an array or a JSON string (MySQL can hand JSON back as text). */
function normBrands(v) {
  let a = v;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = []; } }
  return Array.isArray(a) ? [...new Set(a.map(String).filter((x) => /^\d+$/.test(x)))] : [];
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
  const user = await User.create({
    name, email: String(email).toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: list[0], roles: list,
    active: active !== false,
    avatar: avatar || null,
    title: title || null,
    socialClients: normBrands(socialClients),
  });
  res.status(201).json(safe(user));
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { name, email, password, role, roles, active, avatar, title, socialClients } = req.body;
  if (name != null) user.name = name;
  if (email != null) user.email = String(email).toLowerCase().trim();
  if (roles != null || role != null) { const l = normRoles(roles, role); user.roles = l; user.role = l[0]; }
  if (active != null) user.active = active;
  if (avatar !== undefined) user.avatar = avatar || null;
  if (title !== undefined) user.title = title || null;
  if (socialClients !== undefined) user.socialClients = normBrands(socialClients);
  if (password) user.password = await bcrypt.hash(password, 10);
  await user.save();
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
