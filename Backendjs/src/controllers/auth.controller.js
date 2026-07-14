const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { asyncHandler } = require("../utils/crud");

function rolesOf(user) {
  return Array.isArray(user.roles) && user.roles.length ? user.roles : (user.role ? [user.role] : []);
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role, roles: rolesOf(u),
    avatar: u.avatar, title: u.title,
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

  const user = await User.findOne({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.active) return res.status(401).json({ message: "Invalid email or password." });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid email or password." });

  res.json({ token: sign(user), user: publicUser(user) });
});

const me = asyncHandler(async (req, res) => {
  const u = await User.findByPk(req.user.id);
  if (!u || !u.active) return res.status(401).json({ message: "Invalid or inactive account." });
  res.json({ user: publicUser(u) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters." });
  }
  const user = await User.findByPk(req.user.id);
  const ok = await bcrypt.compare(currentPassword || "", user.password);
  if (!ok) return res.status(401).json({ message: "Current password is incorrect." });
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: "Password updated." });
});

module.exports = { login, me, changePassword };
