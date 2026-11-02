const jwt = require("jsonwebtoken");
const { User, UserSession } = require("../models");
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

/* ── Session cache ──
   Tokens issued since sessions exist carry a jti naming a user_sessions row.
   Its validity is cached per process for SESSION_TTL_MS (revoking in this
   process forgets it at once; other processes notice within the TTL).
   lastSeenAt is written at most once per SESSION_TOUCH_MS per session. */
const SESSION_TTL_MS = 10 * 1000;
const SESSION_TOUCH_MS = 5 * 60 * 1000;
const sessionCache = new Map(); // jti → { at, userId, row: Promise<{id,userId,revokedAt,lastSeenAt,expiresAt}|null> }

function loadSession(jti, userId) {
  const hit = sessionCache.get(jti);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.row;
  const row = UserSession.findOne({ where: { jti }, attributes: ["id", "userId", "revokedAt", "lastSeenAt", "expiresAt"], raw: true });
  if (sessionCache.size > 2000) sessionCache.clear();
  sessionCache.set(jti, { at: Date.now(), userId: Number(userId), row });
  row.catch(() => { if (sessionCache.get(jti)?.row === row) sessionCache.delete(jti); });
  return row;
}
function forgetSession(jti) { if (jti) sessionCache.delete(jti); }
function forgetUserSessions(userId) {
  for (const [k, v] of sessionCache) if (v.userId === Number(userId)) sessionCache.delete(k);
}

function touch(sess, userId) {
  const now = Date.now();
  if (sess.lastSeenAt && now - new Date(sess.lastSeenAt).getTime() < SESSION_TOUCH_MS) return;
  sess.lastSeenAt = new Date(now); // the cached copy — so this process writes once per window
  UserSession.update({ lastSeenAt: sess.lastSeenAt }, { where: { id: sess.id }, silent: true }).catch(() => {});
  User.update({ lastSeenAt: sess.lastSeenAt }, { where: { id: userId }, silent: true, hooks: false }).catch(() => {});
}

class AuthFail extends Error {}

/* Token → { payload, user, session } or throws AuthFail(message). */
async function resolve(token) {
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new AuthFail("Invalid or expired token."); }
  if (payload.kind) throw new AuthFail("Invalid or expired token."); // 2FA tickets etc. are not access tokens
  const [user, session] = await Promise.all([
    loadUser(payload.id),
    payload.jti ? loadSession(payload.jti, payload.id) : null,
  ]);
  if (!user || !user.active) throw new AuthFail("Invalid or inactive account.");
  if (payload.jti) {
    if (!session || session.revokedAt || Number(session.userId) !== Number(user.id)) throw new AuthFail("Your session has ended. Please sign in again.");
  } else if (user.tokensValidAfter && (payload.iat || 0) * 1000 < new Date(user.tokensValidAfter).getTime()) {
    // Old-style token (no session) issued before a logout-all / reset / deactivate.
    throw new AuthFail("Your session has ended. Please sign in again.");
  }
  return { payload, user, session };
}

/* Verify JWT + session and attach req.user. Blocks if missing/invalid. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required." });

    const { payload, user, session } = await resolve(token);
    if (session) touch(session, user.id);

    req.userRow = user;
    req.jti = payload.jti || null;           // null = old token without a session
    req.sessionId = session ? session.id : null;
    req.user = { id: user.id, email: user.email, role: user.role, roles: rolesOf(user), name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ message: err instanceof AuthFail ? err.message : "Invalid or expired token." });
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
      const { payload, user } = await resolve(token);
      req.userRow = user; req.jti = payload.jti || null;
      req.user = { id: user.id, role: user.role, roles: rolesOf(user) };
    }
  } catch (_) { /* ignore */ }
  next();
}

module.exports = { requireAuth, requireRole, requireArea, optionalAuth, loadUser, forgetUser, forgetSession, forgetUserSessions };
