const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { rolesCan } = require("../utils/permissions");

/* Normalise a user to a roles array (supports both the new `roles` JSON
   column and the legacy single `role`). */
function rolesOf(user) {
  const arr = Array.isArray(user.roles) && user.roles.length ? user.roles : (user.role ? [user.role] : []);
  return arr;
}

/* Verify JWT and attach req.user. Blocks if missing/invalid. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: "Invalid or inactive account." });

    req.user = { id: user.id, email: user.email, role: user.role, roles: rolesOf(user), name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

/* Restrict to specific roles, e.g. requireRole("admin") */
function requireRole(...roles) {
  return (req, res, next) => {
    const has = req.user && (req.user.roles || []).some((r) => roles.includes(r));
    if (!has) {
      return res.status(403).json({ message: "You do not have permission to do that." });
    }
    next();
  };
}

/* Restrict to a permission area, e.g. requireArea("leads"). Admin passes all. */
function requireArea(area) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required." });
    if (!rolesCan(req.user.roles || [], area)) {
      return res.status(403).json({ message: "You do not have permission to do that." });
    }
    next();
  };
}

/* Soft auth — attaches req.user if a valid token is present, else continues. */
async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(payload.id);
      if (user && user.active) req.user = { id: user.id, role: user.role, roles: rolesOf(user) };
    }
  } catch (_) { /* ignore */ }
  next();
}

module.exports = { requireAuth, requireRole, requireArea, optionalAuth };
