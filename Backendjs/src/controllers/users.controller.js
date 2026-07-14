const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { ACCEPTED_ROLES } = require("../utils/permissions");

/* Accept either a single `role` or a `roles` array; return a clean, de-duped
   array of valid roles (defaults to ["admin"] if nothing valid was sent). */
function normRoles(roles, role) {
  let list = Array.isArray(roles) ? roles : (role != null ? [role] : []);
  list = [...new Set(list.filter((r) => ACCEPTED_ROLES.includes(r)))];
  return list.length ? list : ["admin"];
}

const safe = (u) => ({
  id: u.id, name: u.name, email: u.email,
  role: (Array.isArray(u.roles) && u.roles[0]) || u.role,
  roles: Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []),
  active: u.active, avatar: u.avatar, title: u.title, createdAt: u.createdAt,
});

const list = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ order: [["createdAt", "ASC"]] });
  res.json(users.map(safe));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, roles, active, avatar, title } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  const list = normRoles(roles, role);
  const user = await User.create({
    name, email: String(email).toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: list[0], roles: list,
    active: active !== false,
    avatar: avatar || null,
    title: title || null,
  });
  res.status(201).json(safe(user));
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { name, email, password, role, roles, active, avatar, title } = req.body;
  if (name != null) user.name = name;
  if (email != null) user.email = String(email).toLowerCase().trim();
  if (roles != null || role != null) { const l = normRoles(roles, role); user.roles = l; user.role = l[0]; }
  if (active != null) user.active = active;
  if (avatar !== undefined) user.avatar = avatar || null;
  if (title !== undefined) user.title = title || null;
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

module.exports = { list, create, update, remove };
