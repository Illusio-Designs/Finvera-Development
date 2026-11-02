/* Account security helpers shared by auth + users controllers:
   device summary, security log, sessions, single-use email links, and the
   "something changed on your account" notices. Nothing here throws into the
   caller for logging / notifying; session + token writes do throw. */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { UserSession, SecurityEvent, AuthToken, User } = require("../models");
const { forgetUser, forgetSession, forgetUserSessions } = require("../middleware/auth");
const { notifyUsers } = require("./notify");
const mailer = require("./mailer");
const frontendUrl = require("./frontendUrl");

/* ── Device summary from the User-Agent: "Chrome on Windows" ── */
function deviceOf(ua) {
  const s = String(ua || "");
  if (!s) return "Unknown device";
  let browser = "Browser";
  if (/Edg(e|A|iOS)?\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/SamsungBrowser\//.test(s)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS\//.test(s)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  else if (/curl\//i.test(s)) browser = "curl";
  else if (/PostmanRuntime/i.test(s)) browser = "Postman";
  else if (/node|axios|undici/i.test(s)) browser = "Script";
  let os = "";
  if (/iPhone|iPad|iPod/.test(s)) os = "iOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Windows/.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/Linux/.test(s)) os = "Linux";
  return os ? `${browser} on ${os}` : browser;
}

const clientIp = (req) => String((req && (req.ip || req.socket?.remoteAddress)) || "").replace(/^::ffff:/, "").slice(0, 64) || null;
const clientInfo = (req) => {
  const ua = String(req?.headers?.["user-agent"] || "").slice(0, 255);
  return { ip: clientIp(req), userAgent: ua || null, device: deviceOf(ua) };
};

/* ── Security log ── (fire-and-forget; never throws) */
const EVENT_TYPES = [
  "login_success", "login_failed", "lockout", "unlocked", "logout", "logout_all", "session_revoked",
  "password_changed", "password_reset", "password_set_by_admin", "reset_requested", "reset_link_created",
  "invite_sent", "invite_accepted", "2fa_enabled", "2fa_disabled", "2fa_failed",
  "role_changed", "deactivated", "reactivated", "email_changed", "must_change_password",
  "user_created", "user_deleted", "new_device",
];
function logEvent(req, { userId = null, email = null, type, actorId = null, meta = null }) {
  const { ip, device } = clientInfo(req);
  return SecurityEvent.create({ userId, email: email ? String(email).slice(0, 255) : null, type, actorId, ip, device, meta })
    .catch((e) => console.warn("security log:", e.message));
}

/* ── Sessions ── */
const jwtTtl = () => process.env.JWT_EXPIRES_IN || "7d";

/* Create a session row + its access token. Returns { token, session, isNewDevice }. */
async function startSession(user, req) {
  const { ip, userAgent, device } = clientInfo(req);
  const jti = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: jwtTtl(), jwtid: jti });
  const { exp } = jwt.decode(token);
  // A device family never used by this account before (only once it has any history).
  const [seenBefore, anyBefore] = await Promise.all([
    UserSession.count({ where: { userId: user.id, device } }),
    UserSession.count({ where: { userId: user.id } }),
  ]);
  const now = new Date();
  const session = await UserSession.create({ userId: user.id, jti, device, userAgent, ip, lastSeenAt: now, expiresAt: new Date(exp * 1000) });
  if (Math.random() < 0.05) prune().catch(() => {});
  return { token, session, isNewDevice: anyBefore > 0 && seenBefore === 0 };
}

/* Revoke a user's live sessions (optionally keeping one jti). When nothing is
   kept, old-style session-less tokens are cut off too (tokensValidAfter). */
async function revokeSessions(userId, { exceptJti = null, reason = "revoked", cutLegacy = true } = {}) {
  const where = { userId, revokedAt: null };
  if (exceptJti) where.jti = { [Op.ne]: exceptJti };
  const [count] = await UserSession.update({ revokedAt: new Date(), revokedReason: reason }, { where });
  if (cutLegacy) {
    // Legacy tokens have no jti; anything issued before now stops working.
    await User.update({ tokensValidAfter: new Date() }, { where: { id: userId }, silent: true, hooks: false });
    forgetUser(userId);
  }
  forgetUserSessions(userId);
  return count;
}

async function revokeOne(sessionRow, reason = "revoked") {
  if (!sessionRow.revokedAt) await sessionRow.update({ revokedAt: new Date(), revokedReason: reason });
  forgetSession(sessionRow.jti);
}

const publicSession = (s, currentJti) => ({
  id: s.id, device: s.device, userAgent: s.userAgent, ip: s.ip,
  createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt,
  current: !!currentJti && s.jti === currentJti,
});

async function listSessions(userId, currentJti) {
  const rows = await UserSession.findAll({
    where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [["lastSeenAt", "DESC"], ["id", "DESC"]], limit: 100,
  });
  return rows.map((s) => publicSession(s, currentJti));
}

/* Housekeeping: drop sessions long expired and used/expired links. */
async function prune() {
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  await UserSession.destroy({ where: { expiresAt: { [Op.lt]: monthAgo } } });
  await AuthToken.destroy({ where: { expiresAt: { [Op.lt]: monthAgo } } });
}

/* ── Single-use links (reset / invite) ── */
const RESET_TTL_MS = 30 * 60 * 1000;          // self-service "forgot password"
const ADMIN_RESET_TTL_MS = 24 * 60 * 60 * 1000; // link an admin copies / shares
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

/* Kill earlier unused links of that kind, mint a new one, return the raw link. */
async function issueLink(userId, kind, ttlMs, createdBy = null) {
  const now = new Date();
  await AuthToken.update({ usedAt: now }, { where: { userId, kind, usedAt: null } });
  const raw = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await AuthToken.create({ userId, kind, tokenHash: sha256(raw), expiresAt, createdBy });
  // One page for both: GET /auth/reset-info tells it whether this is an invite.
  const extra = kind === "invite" ? "&invite=1" : "";
  return { token: raw, link: `${frontendUrl()}/reset-password?token=${encodeURIComponent(raw)}${extra}`, expiresAt };
}

/* Look up a raw token. Returns { row, user } when usable, else null. */
async function findLink(raw) {
  if (!raw || typeof raw !== "string" || raw.length > 200) return null;
  const row = await AuthToken.findOne({ where: { tokenHash: sha256(raw) } });
  if (!row || row.usedAt || new Date(row.expiresAt) < new Date()) return null;
  const user = await User.findByPk(row.userId);
  if (!user || !user.active) return null;
  return { row, user };
}

/* ── Mail + in-app notices ── */
const fmtExpiry = (ms) => (ms >= 86400000 ? `${Math.round(ms / 3600000)} hours` : `${Math.round(ms / 60000)} minutes`);

function mailResetLink(user, link, ttlMs) {
  return mailer.sendMail({
    to: user.email,
    subject: "Reset your Finvera password",
    html: mailer.layout({
      title: "Reset your password",
      body: `<p>Hi ${mailer.esc(user.name)},</p><p>Someone (hopefully you) asked to reset the password for your Finvera account. The link works once and expires in ${fmtExpiry(ttlMs)}.</p><p>If you didn't ask for this, you can ignore this email — your password stays the same.</p>`,
      button: { label: "Choose a new password", url: link },
    }),
    text: `Reset your Finvera password (expires in ${fmtExpiry(ttlMs)}): ${link}`,
  });
}

function mailInvite(user, link, inviter) {
  return mailer.sendMail({
    to: user.email,
    subject: "You're invited to Finvera",
    html: mailer.layout({
      title: "You're invited to Finvera",
      body: `<p>Hi ${mailer.esc(user.name)},</p><p>${mailer.esc(inviter || "An admin")} added you to the Finvera team dashboard. Set your password to sign in — the link expires in ${fmtExpiry(INVITE_TTL_MS)}.</p><p>Your sign-in email is <b>${mailer.esc(user.email)}</b>.</p>`,
      button: { label: "Set my password", url: link },
    }),
    text: `You're invited to Finvera. Set your password (expires in 72 hours): ${link}`,
  });
}

/* In-app notification + email (if configured) about the user's own account. */
function tellUser(user, { title, body, link = "/dashboard/account" }) {
  notifyUsers([user.id], { type: "security", title, body, link }).catch(() => {});
  mailer.sendMail({
    to: user.email,
    subject: title,
    html: mailer.layout({
      title,
      body: `<p>Hi ${mailer.esc(user.name)},</p><p>${mailer.esc(body)}</p><p>If this wasn't you, reset your password now and tell your admin.</p>`,
      button: { label: "Open my account", url: `${frontendUrl()}${link}` },
    }),
    text: `${title}\n\n${body}\n\nIf this wasn't you, reset your password now and tell your admin.`,
  }).catch(() => {});
}

module.exports = {
  deviceOf, clientInfo, clientIp, logEvent, EVENT_TYPES,
  startSession, revokeSessions, revokeOne, listSessions, publicSession,
  issueLink, findLink, sha256, RESET_TTL_MS, ADMIN_RESET_TTL_MS, INVITE_TTL_MS,
  mailResetLink, mailInvite, tellUser, mailConfigured: mailer.configured,
};
