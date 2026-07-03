const jwt = require("jsonwebtoken");
const { User } = require("../models");

/* Verify JWT and attach req.user. Blocks if missing/invalid. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: "Invalid or inactive account." });

    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

/* Restrict to specific roles, e.g. requireRole("admin") */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
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
      if (user && user.active) req.user = { id: user.id, role: user.role };
    }
  } catch (_) { /* ignore */ }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
