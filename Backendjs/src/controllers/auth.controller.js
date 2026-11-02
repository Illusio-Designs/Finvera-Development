const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, UserSession, SecurityEvent } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesOf } = require("../utils/permissions");
const { brandIdsOf } = require("./social.controller");
const { forgetUser } = require("../middleware/auth");
const { checkPassword } = require("../utils/password");
const totp = require("../utils/totp");
const sec = require("../utils/security");

/* ── Lockout: 5 wrong passwords (or 2FA codes) within 15 min → locked 15 min ── */
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const TICKET_TTL = "5m";

const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
};
const normEmail = (e) => String(e || "").toLowerCase().trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    role: u.role, roles: rolesOf(u),
    avatar: u.avatar, title: u.title,
    socialClients: brandIdsOf(u),   // null = every brand (admin); [] = none yet
    mustChangePassword: !!u.mustChangePassword,
    twoFactorEnabled: !!u.twoFactorEnabled,
    lastLoginAt: u.lastLoginAt || null,
  };
}

const isLocked = (u) => u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
const minutesLeft = (u) => Math.max(1, Math.ceil((new Date(u.lockedUntil).getTime() - Date.now()) / 60000));
function lockedReply(res, u) {
  const m = minutesLeft(u);
  return res.status(423).json({
    message: `Too many wrong attempts. This account is locked — try again in ${m} minute${m === 1 ? "" : "s"}, or ask an admin to unlock it.`,
    locked: true, minutesLeft: m, lockedUntil: u.lockedUntil,
  });
}

/* Count a wrong password / code. Returns true when this one locked the account. */
async function registerFailure(user, req, reason) {
  const now = Date.now();
  const start = user.firstFailedAt ? new Date(user.firstFailedAt).getTime() : 0;
  if (!start || now - start > FAIL_WINDOW_MS) { user.failedLogins = 1; user.firstFailedAt = new Date(now); }
  else user.failedLogins = (user.failedLogins || 0) + 1;
  let locked = false;
  if (user.failedLogins >= MAX_FAILS) {
    user.lockedUntil = new Date(now + LOCK_MS); user.failedLogins = 0; user.firstFailedAt = null; locked = true;
  }
  await user.save({ fields: ["failedLogins", "firstFailedAt", "lockedUntil"], silent: true });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: reason === "wrong_2fa_code" ? "2fa_failed" : "login_failed", meta: { reason } });
  if (locked) {
    sec.logEvent(req, { userId: user.id, email: user.email, type: "lockout", meta: { minutes: LOCK_MS / 60000 } });
    sec.tellUser(user, { title: "Your Finvera account was locked", body: `After ${MAX_FAILS} wrong sign-in attempts your account is locked for ${LOCK_MS / 60000} minutes.` });
  }
  return locked;
}

/* bcrypt against a throwaway hash so unknown emails take as long as real ones. */
let dummyHash = null;
const dummyCompare = async (pw) => { dummyHash = dummyHash || await bcrypt.hash(crypto.randomBytes(8).toString("hex"), 10); return bcrypt.compare(String(pw), dummyHash); };

/* Password (and 2FA, if on) passed — open a session and answer like /login always did. */
async function finishLogin(user, req, res, { method = "password", extra = {} } = {}) {
  const now = new Date();
  user.failedLogins = 0; user.firstFailedAt = null; user.lockedUntil = null;
  user.lastLoginAt = now; user.lastSeenAt = now;
  await user.save({ fields: ["failedLogins", "firstFailedAt", "lockedUntil", "lastLoginAt", "lastSeenAt"], silent: true });
  forgetUser(user.id);
  const { token, session, isNewDevice } = await sec.startSession(user, req);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "login_success", meta: { sessionId: session.id, method } });
  if (isNewDevice) {
    sec.logEvent(req, { userId: user.id, email: user.email, type: "new_device", meta: { sessionId: session.id } });
    sec.tellUser(user, {
      title: "New sign-in to your Finvera account",
      body: `Signed in from ${session.device}${session.ip ? ` (IP ${session.ip})` : ""} on ${now.toUTCString()}.`,
    });
  }
  res.json({ token, user: publicUser(user), mustChangePassword: !!user.mustChangePassword, sessionId: session.id, ...extra });
}

/* ── POST /auth/login {email, password} ── */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
  const addr = normEmail(email);
  const BAD = { message: "Invalid email or password." };

  const user = await User.findOne({ where: { email: addr } });
  if (!user) {
    await dummyCompare(password);
    sec.logEvent(req, { email: addr, type: "login_failed", meta: { reason: "unknown_email" } });
    return res.status(401).json(BAD);
  }
  if (!user.active) {
    await dummyCompare(password);
    sec.logEvent(req, { userId: user.id, email: addr, type: "login_failed", meta: { reason: "inactive" } });
    return res.status(401).json(BAD);
  }
  if (isLocked(user)) {
    sec.logEvent(req, { userId: user.id, email: addr, type: "login_failed", meta: { reason: "locked" } });
    return lockedReply(res, user);
  }

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) {
    const locked = await registerFailure(user, req, user.invitePending ? "invite_pending" : "wrong_password");
    return locked ? lockedReply(res, user) : res.status(401).json(BAD);
  }

  if (user.twoFactorEnabled) {
    const ticket = jwt.sign({ kind: "2fa", sub: user.id }, process.env.JWT_SECRET, { expiresIn: TICKET_TTL, jwtid: crypto.randomBytes(8).toString("hex") });
    return res.json({ twoFactorRequired: true, ticket, message: "Enter the 6-digit code from your authenticator app." });
  }
  return finishLogin(user, req, res);
});

/* Recently used TOTP steps per user (stops a code being replayed in its window). */
const usedSteps = new Map(); // userId → step
const usedTickets = new Map(); // jti → expiresAtMs
function spendTicket(jti, expSec) {
  const now = Date.now();
  if (usedTickets.size > 1000) for (const [k, t] of usedTickets) if (t < now) usedTickets.delete(k);
  if (usedTickets.has(jti)) return false;
  usedTickets.set(jti, expSec * 1000);
  return true;
}

/* Check a TOTP code or a backup code for this user. Returns "totp" | "backup" | null.
   A matched backup code is removed (caller saves the user). */
function checkSecondFactor(user, code) {
  const c = String(code || "").trim();
  if (/^\d{6}$/.test(c.replace(/\s/g, ""))) {
    const step = totp.verify(totp.open(user.twoFactorSecret), c);
    if (step == null || (usedSteps.get(user.id) || -1) >= step) return null;
    usedSteps.set(user.id, step);
    return "totp";
  }
  const h = totp.hashBackup(c);
  const list = asArr(user.twoFactorBackup);
  if (totp.normBackup(c).length === 8 && list.includes(h)) {
    user.twoFactorBackup = list.filter((x) => x !== h);
    return "backup";
  }
  return null;
}

/* ── POST /auth/login/2fa {ticket, code} ── */
const login2fa = asyncHandler(async (req, res) => {
  const { ticket, code } = req.body || {};
  let t;
  try { t = jwt.verify(String(ticket || ""), process.env.JWT_SECRET); } catch { t = null; }
  if (!t || t.kind !== "2fa") return res.status(401).json({ message: "Your sign-in step expired. Please enter your password again." });
  if (!code) return res.status(400).json({ message: "Enter the 6-digit code from your authenticator app, or a backup code." });

  const user = await User.findByPk(t.sub);
  if (!user || !user.active) return res.status(401).json({ message: "Invalid email or password." });
  if (isLocked(user)) return lockedReply(res, user);
  if (!user.twoFactorEnabled) return finishLogin(user, req, res); // turned off meanwhile — password already checked

  const how = checkSecondFactor(user, code);
  if (!how) {
    const locked = await registerFailure(user, req, "wrong_2fa_code");
    return locked ? lockedReply(res, user) : res.status(401).json({ message: "That code didn't work. Check your authenticator app and try the newest code." });
  }
  if (!spendTicket(t.jti, t.exp)) return res.status(401).json({ message: "Your sign-in step expired. Please enter your password again." });
  if (how === "backup") await user.save({ fields: ["twoFactorBackup"], silent: true });
  const extra = how === "backup" ? { usedBackupCode: true, backupCodesLeft: asArr(user.twoFactorBackup).length } : {};
  return finishLogin(user, req, res, { method: how === "backup" ? "backup_code" : "2fa", extra });
});

/* ── GET /auth/me ── */
const me = asyncHandler(async (req, res) => {
  const u = req.userRow || await User.findByPk(req.user.id); // requireAuth already loaded it
  if (!u || !u.active) return res.status(401).json({ message: "Invalid or inactive account." });
  res.json({ user: publicUser(u), mustChangePassword: !!u.mustChangePassword, sessionId: req.sessionId || null });
});

/* ── PUT /auth/me {name?, email?, avatar?, currentPassword?} ── */
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  const { name, email, avatar, currentPassword } = req.body || {};
  if (name !== undefined) {
    const n = String(name || "").trim();
    if (!n) return res.status(400).json({ message: "Name can't be empty.", field: "name" });
    user.name = n.slice(0, 120);
  }
  if (avatar !== undefined) user.avatar = avatar ? String(avatar).slice(0, 255) : null;
  let oldEmail = null;
  if (email !== undefined && normEmail(email) !== user.email) {
    const addr = normEmail(email);
    if (!EMAIL_RE.test(addr)) return res.status(400).json({ message: "Enter a valid email address.", field: "email" });
    if (!currentPassword) return res.status(400).json({ message: "Enter your current password to change your email.", field: "currentPassword" });
    if (!(await bcrypt.compare(String(currentPassword), user.password))) return res.status(400).json({ message: "Current password is incorrect.", field: "currentPassword" });
    if (await User.count({ where: { email: addr, id: { [Op.ne]: user.id } } })) return res.status(409).json({ message: "That email is already used by another account.", field: "email" });
    oldEmail = user.email; user.email = addr;
  }
  await user.save();
  forgetUser(user.id);
  if (oldEmail) {
    sec.logEvent(req, { userId: user.id, email: user.email, type: "email_changed", meta: { from: oldEmail, to: user.email } });
    sec.tellUser({ id: user.id, name: user.name, email: oldEmail }, { title: "Your Finvera sign-in email was changed", body: `Your account now signs in with ${user.email}.` });
  }
  res.json({ user: publicUser(user), message: "Profile saved." });
});

/* ── POST /auth/change-password {currentPassword, newPassword} ── */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const bad = checkPassword(newPassword);
  if (bad) return res.status(400).json(bad);
  const user = await User.findByPk(req.user.id);
  const ok = await bcrypt.compare(String(currentPassword || ""), user.password);
  if (!ok) return res.status(400).json({ message: "Current password is incorrect.", field: "currentPassword" });
  if (await bcrypt.compare(String(newPassword), user.password)) return res.status(400).json({ message: "Choose a password different from your current one.", field: "password" });
  user.password = await bcrypt.hash(String(newPassword), 10);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  await user.save();
  // Sign out every other device; an old-style token (no session) can't be told apart, so it's kept.
  const ended = await sec.revokeSessions(user.id, { exceptJti: req.jti, reason: "password_changed", cutLegacy: !!req.jti });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "password_changed", meta: { sessionsEnded: ended } });
  sec.tellUser(user, { title: "Your Finvera password was changed", body: `Your password was changed${ended ? ` and ${ended} other device${ended === 1 ? " was" : "s were"} signed out` : ""}.` });
  res.json({ message: "Password updated.", sessionsEnded: ended });
});

/* ── Sessions ── */
const sessions = asyncHandler(async (req, res) => {
  res.json({ sessions: await sec.listSessions(req.user.id, req.jti), currentSessionId: req.sessionId || null });
});

const revokeSession = asyncHandler(async (req, res) => {
  const s = await UserSession.findOne({ where: { id: Number(req.params.id) || 0, userId: req.user.id } });
  if (!s || s.revokedAt) return res.status(404).json({ message: "Session not found." });
  await sec.revokeOne(s, "signed_out_remotely");
  sec.logEvent(req, { userId: req.user.id, email: req.user.email, type: "session_revoked", meta: { sessionId: s.id, device: s.device } });
  res.json({ message: "Signed out of that device.", id: s.id, current: s.jti === req.jti });
});

const logout = asyncHandler(async (req, res) => {
  if (req.jti) {
    const s = await UserSession.findOne({ where: { jti: req.jti } });
    if (s) await sec.revokeOne(s, "logout");
  }
  sec.logEvent(req, { userId: req.user.id, email: req.user.email, type: "logout", meta: { sessionId: req.sessionId } });
  res.json({ message: "Signed out." });
});

const logoutAll = asyncHandler(async (req, res) => {
  const includeCurrent = req.body?.includeCurrent === true || req.query.includeCurrent === "true";
  const count = await sec.revokeSessions(req.user.id, {
    exceptJti: includeCurrent ? null : req.jti, reason: "logout_all", cutLegacy: includeCurrent || !!req.jti,
  });
  sec.logEvent(req, { userId: req.user.id, email: req.user.email, type: "logout_all", meta: { count, includeCurrent } });
  res.json({ message: includeCurrent ? "Signed out everywhere." : "Signed out of all other devices.", count });
});

/* ── Security log (shared by "mine", admin per-user and the admin log) ── */
async function pagedEvents(where, q = {}) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 25));
  if (q.type) where.type = String(q.type).includes(",") ? String(q.type).split(",").map((s) => s.trim()) : String(q.type);
  const range = {};
  if (q.from && !isNaN(Date.parse(q.from))) range[Op.gte] = new Date(q.from);
  if (q.to && !isNaN(Date.parse(q.to))) { const d = new Date(q.to); if (/^\d{4}-\d{2}-\d{2}$/.test(q.to)) d.setUTCHours(23, 59, 59, 999); range[Op.lte] = d; }
  if (Object.getOwnPropertySymbols(range).length) where.createdAt = range;
  const { rows, count } = await SecurityEvent.findAndCountAll({ where, order: [["createdAt", "DESC"], ["id", "DESC"]], limit, offset: (page - 1) * limit, raw: true });
  const ids = [...new Set(rows.flatMap((r) => [r.userId, r.actorId]).filter(Boolean))];
  const people = ids.length ? await User.findAll({ where: { id: ids }, attributes: ["id", "name", "email", "avatar"], raw: true }) : [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const items = rows.map((r) => {
    let meta = r.meta;
    if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = null; } }
    const u = r.userId ? byId.get(r.userId) : null;
    const a = r.actorId ? byId.get(r.actorId) : null;
    return {
      id: r.id, type: r.type, createdAt: r.createdAt, ip: r.ip, device: r.device, email: r.email, meta: meta || {},
      user: u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : (r.userId ? { id: r.userId, name: null, email: r.email } : null),
      actor: a ? { id: a.id, name: a.name } : null,
    };
  });
  return { items, total: count, page, limit, pages: Math.max(1, Math.ceil(count / limit)), types: sec.EVENT_TYPES };
}

const activity = asyncHandler(async (req, res) => {
  res.json(await pagedEvents({ userId: req.user.id }, req.query));
});

/* ── Forgot / reset ── */
const FORGOT_OK = { message: "If that email belongs to an active account, a reset link is on its way. Check your inbox (and spam)." };

const forgot = asyncHandler(async (req, res) => {
  const addr = normEmail(req.body?.email);
  res.json(FORGOT_OK); // same answer, same timing, whatever happens next
  if (!EMAIL_RE.test(addr)) return;
  setImmediate(async () => {
    try {
      const user = await User.findOne({ where: { email: addr } });
      if (!user || !user.active) { sec.logEvent(req, { email: addr, userId: user?.id || null, type: "reset_requested", meta: { found: !!user, sent: false } }); return; }
      if (!sec.mailConfigured()) {
        console.warn(`forgot-password: email is not configured (SMTP_HOST) — no reset link sent to ${addr}. An admin can create one from Users.`);
        sec.logEvent(req, { userId: user.id, email: addr, type: "reset_requested", meta: { sent: false, reason: "mail-not-configured" } });
        return;
      }
      const { link } = await sec.issueLink(user.id, "reset", sec.RESET_TTL_MS);
      const r = await sec.mailResetLink(user, link, sec.RESET_TTL_MS);
      if (!r.sent) console.warn(`forgot-password: mail to ${addr} failed — ${r.reason}`);
      sec.logEvent(req, { userId: user.id, email: addr, type: "reset_requested", meta: { sent: !!r.sent } });
    } catch (e) { console.warn("forgot-password:", e.message); }
  });
});

const BAD_LINK = { valid: false, message: "This link is invalid or has expired. Ask for a new one." };

/* GET /auth/reset-info?token= — lets the page say "Set your password" vs "Reset". */
const resetInfo = asyncHandler(async (req, res) => {
  const hit = await sec.findLink(String(req.query.token || ""));
  if (!hit) return res.status(400).json(BAD_LINK);
  res.json({ valid: true, kind: hit.row.kind, email: hit.user.email, name: hit.user.name, expiresAt: hit.row.expiresAt });
});

/* POST /auth/reset {token, password} — also accepts an invite. */
const reset = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  const hit = await sec.findLink(String(token || ""));
  if (!hit) return res.status(400).json(BAD_LINK);
  const bad = checkPassword(password);
  if (bad) return res.status(400).json(bad);
  const { row, user } = hit;
  // Claim the link first so two submits can't both use it.
  const [claimed] = await row.constructor.update({ usedAt: new Date() }, { where: { id: row.id, usedAt: null } });
  if (!claimed) return res.status(400).json(BAD_LINK);
  const wasInvite = row.kind === "invite" || user.invitePending;
  user.password = await bcrypt.hash(String(password), 10);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false; user.invitePending = false;
  user.failedLogins = 0; user.firstFailedAt = null; user.lockedUntil = null;
  await user.save();
  const ended = await sec.revokeSessions(user.id, { reason: "password_reset" });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: wasInvite ? "invite_accepted" : "password_reset", meta: { sessionsEnded: ended, via: row.kind } });
  if (wasInvite) {
    if (row.createdBy) require("../utils/notify").notifyUsers([row.createdBy], { type: "info", title: `${user.name} joined Finvera`, body: "They accepted the invite and set a password.", link: "/dashboard/users" }).catch(() => {});
  } else {
    sec.tellUser(user, { title: "Your Finvera password was reset", body: "Your password was reset with an email link and every device was signed out." });
  }
  res.json({ message: wasInvite ? "Password set. You can sign in now." : "Password reset. You can sign in with your new password.", email: user.email });
});

/* ── Two-step login (TOTP) ── */
const twoFactorSetup = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) return res.status(400).json({ message: "Two-step login is already on. Turn it off first to set it up again." });
  const secret = totp.generateSecret();
  user.twoFactorSecret = totp.seal(secret);
  await user.save({ fields: ["twoFactorSecret"] });
  forgetUser(user.id);
  res.json({ secret, otpauthUrl: totp.otpauthUrl(secret, user.email), issuer: "Finvera", account: user.email });
});

const twoFactorEnable = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (user.twoFactorEnabled) return res.status(400).json({ message: "Two-step login is already on." });
  const secret = totp.open(user.twoFactorSecret);
  if (!secret) return res.status(400).json({ message: "Start the setup first (scan the QR code)." });
  const step = totp.verify(secret, req.body?.code);
  if (step == null) return res.status(400).json({ message: "That code didn't work. Check the time on your phone is automatic and try the newest code.", field: "code" });
  usedSteps.set(user.id, step);
  const { codes, hashes } = totp.makeBackupCodes(8);
  user.twoFactorEnabled = true; user.twoFactorBackup = hashes;
  await user.save({ fields: ["twoFactorEnabled", "twoFactorBackup"] });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "2fa_enabled" });
  res.json({ message: "Two-step login is on.", backupCodes: codes });
});

const twoFactorDisable = asyncHandler(async (req, res) => {
  const { password, code } = req.body || {};
  const user = await User.findByPk(req.user.id);
  if (!user.twoFactorEnabled) return res.status(400).json({ message: "Two-step login is already off." });
  if (!(await bcrypt.compare(String(password || ""), user.password))) return res.status(400).json({ message: "Current password is incorrect.", field: "password" });
  if (!checkSecondFactor(user, code)) return res.status(400).json({ message: "That code didn't work. Enter a code from your authenticator app or a backup code.", field: "code" });
  user.twoFactorEnabled = false; user.twoFactorSecret = null; user.twoFactorBackup = null;
  await user.save({ fields: ["twoFactorEnabled", "twoFactorSecret", "twoFactorBackup"] });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "2fa_disabled" });
  sec.tellUser(user, { title: "Two-step login was turned off", body: "Two-step login (authenticator app) was turned off for your Finvera account." });
  res.json({ message: "Two-step login is off." });
});

/* POST /auth/2fa/backup-codes {code} — fresh set of 8 (old ones stop working). */
const twoFactorBackupCodes = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id);
  if (!user.twoFactorEnabled) return res.status(400).json({ message: "Two-step login is off." });
  const step = totp.verify(totp.open(user.twoFactorSecret), req.body?.code);
  if (step == null) return res.status(400).json({ message: "That code didn't work. Enter the newest code from your authenticator app.", field: "code" });
  const { codes, hashes } = totp.makeBackupCodes(8);
  user.twoFactorBackup = hashes;
  await user.save({ fields: ["twoFactorBackup"] });
  sec.logEvent(req, { userId: user.id, email: user.email, type: "2fa_enabled", meta: { backupCodesRenewed: true } });
  res.json({ message: "New backup codes made. The old ones no longer work.", backupCodes: codes });
});

module.exports = {
  login, login2fa, me, updateMe, changePassword,
  sessions, revokeSession, logout, logoutAll, activity, pagedEvents,
  forgot, resetInfo, reset,
  twoFactorSetup, twoFactorEnable, twoFactorDisable, twoFactorBackupCodes,
  publicUser,
};
