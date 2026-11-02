const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { rolesCan, rolesOf } = require("../utils/permissions");

/* ── Signed-in user cache ──
   Every authed request used to load its user row (and the social routes
   loaded it a second time for the brand scope). Rows are now kept per
   process for a few seconds and shared by everything in the request
   (req.userRow). Changing a user (roles, brands, active, delete) calls
   forgetUser() so this process sees it at once; other app processes see it
   within USER_TTL_MS. */
const USER_TTL_MS = 10 * 1000;
const userCache = new Map(); // id → { at, row: Promise<User|null> }

function loadUser(id) {
  const key = Number(id);
  const hit = userCache.get(key);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.row;
  const row = User.findByPk(key);
  if (userCache.size > 500) userCache.clear();
  userCache.set(key, { at: Date.now(), row });
  row.catch(() => { if (userCache.get(key)?.row === row) userCache.delete(key); });
  return row;
}
function forgetUser(id) { if (id == null) userCache.clear(); else userCache.delete(Number(id)); }

/* Verify JWT and attach req.user. Blocks if missing/invalid. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(payload.id);
    if (!user || !user.active) return res.status(401).json({ message: "Invalid or inactive account." });

    req.userRow = user;
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
      const user = await loadUser(payload.id);
      if (user && user.active) { req.userRow = user; req.user = { id: user.id, role: user.role, roles: rolesOf(user) }; }
    }
  } catch (_) { /* ignore */ }
  next();
}

module.exports = { requireAuth, requireRole, requireArea, optionalAuth, loadUser, forgetUser };
