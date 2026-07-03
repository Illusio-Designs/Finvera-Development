const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { asyncHandler } = require("../utils/crud");

const safe = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, createdAt: u.createdAt });

const list = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ order: [["createdAt", "ASC"]] });
  res.json(users.map(safe));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, active } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  const user = await User.create({
    name, email: String(email).toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: role === "editor" ? "editor" : "admin",
    active: active !== false,
  });
  res.status(201).json(safe(user));
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { name, email, password, role, active } = req.body;
  if (name != null) user.name = name;
  if (email != null) user.email = String(email).toLowerCase().trim();
  if (role != null) user.role = role === "editor" ? "editor" : "admin";
  if (active != null) user.active = active;
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
