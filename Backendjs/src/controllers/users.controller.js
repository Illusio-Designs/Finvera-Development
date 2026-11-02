const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { User, SocialClient, UserSession } = require("../models");
const { notifyUsers } = require("../utils/notify");
const { asyncHandler } = require("../utils/crud");
const { ACCEPTED_ROLES, rolesOf } = require("../utils/permissions");
const { forgetUser } = require("../middleware/auth");
const { forgetScopes } = require("./social.controller");
const { checkPassword } = require("../utils/password");
const sec = require("../utils/security");
const { pagedEvents } = require("./auth.controller");

/* Accept either a single `role` or a `roles` array; return a clean, de-duped
   array of valid roles. Empty means none were chosen — callers refuse that
   rather than quietly making the user an admin. */
function normRoles(roles, role) {
  let list = Array.isArray(roles) ? roles : (role != null ? [role] : []);
  return [...new Set(list.filter((r) => ACCEPTED_ROLES.includes(r)))];
}
const NO_ROLE = { message: "Choose at least one role for this user." };

/* Social media brand ids (as strings, matching the multiselect); [] = all brands.
   Accepts an array or a JSON string (MySQL can hand JSON back as text). */
function normBrands(v) {
  let a = v;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { a = []; } }
  return Array.isArray(a) ? [...new Set(a.map(String).filter((x) => /^\d+$/.test(x)))] : [];
}

/* Tell someone which social brands they were just given. */
async function announceBrands(user, before, actorId) {
  try {
    const added = normBrands(user.socialClients).filter((id) => !before.includes(id));
    if (!added.length) return;
    const names = (await SocialClient.findAll({ where: { id: added.map(Number) } })).map((b) => b.name);
    if (!names.length) return;
    await notifyUsers([user.id], {
      type: "info",
      title: names.length === 1 ? `You now have access to ${names[0]}` : `You now have access to ${names.length} brands`,
      body: names.length === 1 ? "Its content calendar is in Social media → Content calendar." : names.join(", "),
      link: "/dashboard/social",
    }, actorId);
  } catch (e) { console.warn("announceBrands:", e.message); }
}

/* New roles / brands may make someone the right person for waiting posts. */
async function sweepSocial() {
  try { await require("./social.controller").assignUnassigned({ force: true }); }
  catch (e) { console.warn("social sweep:", e.message); }
}

/* invited → never set a password; locked → too many wrong passwords right now. */
function statusOf(u) {
  if (!u.active) return "deactivated";
  if (u.invitePending) return "invited";
  if (u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now()) return "locked";
  return "active";
}

const safe = (u) => ({
  id: u.id, name: u.name, email: u.email,
  role: rolesOf(u)[0] || u.role,
  roles: rolesOf(u),
  active: u.active, avatar: u.avatar, title: u.title, createdAt: u.createdAt,
  socialClients: normBrands(u.socialClients),
  status: statusOf(u),
  lastLoginAt: u.lastLoginAt || null,
  lastSeenAt: u.lastSeenAt || null,
  twoFactorEnabled: !!u.twoFactorEnabled,
  mustChangePassword: !!u.mustChangePassword,
  invitedAt: u.invitedAt || null,
  lockedUntil: statusOf(u) === "locked" ? u.lockedUntil : null,
});

const sameRoles = (a, b) => a.length === b.length && a.every((r) => b.includes(r));

const list = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ order: [["createdAt", "ASC"]] });
  res.json(users.map(safe));
});

/* Minimal directory for member pickers (kanban assignees, etc.). Any signed-in
   user may read it; exposes only id/name/avatar/title — no emails or roles. */
const assignable = asyncHandler(async (_req, res) => {
  const users = await User.findAll({ where: { active: true }, order: [["name", "ASC"]] });
  // roles let the content calendar list who can take each step (picked by hand)
  res.json(users.map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, title: u.title, roles: rolesOf(u) })));
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, role, roles, active, avatar, title, socialClients } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  const list = normRoles(roles, role);
  if (!list.length) return res.status(400).json(NO_ROLE);
  const bad = checkPassword(password);
  if (bad) return res.status(400).json(bad);
  const user = await User.create({
    name, email: String(email).toLowerCase().trim(),
    password: await bcrypt.hash(password, 10),
    role: list[0], roles: list,
    active: active !== false,
    avatar: avatar || null,
    title: title || null,
    socialClients: normBrands(socialClients),
    mustChangePassword: req.body.mustChangePassword === true,
    passwordChangedAt: new Date(),
  });
  sec.logEvent(req, { userId: user.id, email: user.email, type: "user_created", actorId: req.user?.id, meta: { roles: list } });
  await announceBrands(user, [], req.user?.id);
  await sweepSocial();
  res.status(201).json(safe(user));
});

const update = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { name, email, password, role, roles, active, avatar, title, socialClients, mustChangePassword } = req.body;
  const brandsBefore = normBrands(user.socialClients);
  const rolesBefore = rolesOf(user), wasActive = !!user.active, emailBefore = user.email;
  const self = Number(user.id) === Number(req.user.id);
  if (password) { const bad = checkPassword(password); if (bad) return res.status(400).json(bad); }
  if (self && active === false) return res.status(400).json({ message: "You can't deactivate your own account." });
  if (name != null) user.name = name;
  if (email != null) user.email = String(email).toLowerCase().trim();
  if (roles != null || role != null) {
    const l = normRoles(roles, role);
    if (!l.length) return res.status(400).json(NO_ROLE);
    user.roles = l; user.role = l[0];
  }
  if (active != null) user.active = !!active;
  if (avatar !== undefined) user.avatar = avatar || null;
  if (title !== undefined) user.title = title || null;
  if (socialClients !== undefined) user.socialClients = normBrands(socialClients);
  if (mustChangePassword != null) user.mustChangePassword = !!mustChangePassword;
  if (password) {
    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date(); user.invitePending = false;
    user.failedLogins = 0; user.firstFailedAt = null; user.lockedUntil = null;
  }
  await user.save();
  forgetUser(user.id); forgetScopes();
  const actorId = req.user.id, ev = (type, meta) => sec.logEvent(req, { userId: user.id, email: user.email, type, actorId, meta });
  if (!sameRoles(rolesBefore, rolesOf(user))) ev("role_changed", { from: rolesBefore, to: rolesOf(user) });
  if (wasActive && !user.active) { const n = await sec.revokeSessions(user.id, { reason: "deactivated" }); ev("deactivated", { sessionsEnded: n }); }
  if (!wasActive && user.active) ev("reactivated");
  if (emailBefore !== user.email) ev("email_changed", { from: emailBefore, to: user.email });
  if (password) {
    const n = self ? 0 : await sec.revokeSessions(user.id, { reason: "password_set_by_admin" });
    ev("password_set_by_admin", { sessionsEnded: n });
  }
  if (mustChangePassword != null) ev("must_change_password", { required: !!mustChangePassword });
  await announceBrands(user, brandsBefore, req.user?.id);
  await sweepSocial();
  res.json(safe(user));
});

const remove = asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: "You can't delete your own account." });
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  await sec.revokeSessions(user.id, { reason: "deleted" }).catch(() => {});
  await user.destroy();
  forgetUser(user.id); forgetScopes();
  sec.logEvent(req, { userId: user.id, email: user.email, type: "user_deleted", actorId: req.user.id, meta: { name: user.name } });
  res.json({ message: "Deleted.", id: Number(req.params.id) });
});

/* ── Account security actions (admin) ── */
const NOT_FOUND = { message: "User not found." };
const findUser = async (req, res) => {
  const u = await User.findByPk(Number(req.params.id) || 0);
  if (!u) res.status(404).json(NOT_FOUND);
  return u;
};

/* POST /users/:id/reset-link — emails a reset link AND returns it to copy/share. */
const resetLink = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  if (!user.active) return res.status(400).json({ message: "This account is deactivated. Reactivate it first." });
  const kind = user.invitePending ? "invite" : "reset";
  const ttl = kind === "invite" ? sec.INVITE_TTL_MS : sec.ADMIN_RESET_TTL_MS;
  const { link, expiresAt } = await sec.issueLink(user.id, kind, ttl, req.user.id);
  const mail = req.body?.sendEmail === false ? { sent: false, reason: "skipped" }
    : kind === "invite" ? await sec.mailInvite(user, link, req.user.name) : await sec.mailResetLink(user, link, ttl);
  sec.logEvent(req, { userId: user.id, email: user.email, type: kind === "invite" ? "invite_sent" : "reset_link_created", actorId: req.user.id, meta: { emailed: !!mail.sent } });
  res.json({
    link, expiresAt, kind, emailed: !!mail.sent,
    message: mail.sent ? `Reset link emailed to ${user.email}. You can also copy it below.` : "Email isn't set up, so nothing was sent — copy the link and share it with them.",
  });
});

/* POST /users/:id/require-password-change {required = true} */
const requirePasswordChange = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  const required = req.body?.required !== false;
  user.mustChangePassword = required;
  await user.save({ fields: ["mustChangePassword"] });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "must_change_password", actorId: req.user.id, meta: { required } });
  res.json({ message: required ? "They'll be asked to choose a new password next time they sign in." : "Password change no longer required.", user: safe(user) });
});

/* POST /users/invite {name, email, role|roles, title?, socialClients|brands?} */
const invite = asyncHandler(async (req, res) => {
  const { name, email, role, roles, title, avatar } = req.body || {};
  const addr = String(email || "").toLowerCase().trim();
  if (!name || !String(name).trim() || !addr) return res.status(400).json({ message: "Name and email are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return res.status(400).json({ message: "Enter a valid email address.", field: "email" });
  const list = normRoles(roles, role);
  if (!list.length) return res.status(400).json(NO_ROLE);
  if (await User.count({ where: { email: addr } })) return res.status(409).json({ message: "A user with that email already exists.", field: "email" });
  const user = await User.create({
    name: String(name).trim(), email: addr,
    // Unusable until they set one through the link.
    password: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
    role: list[0], roles: list, active: true,
    title: title || null, avatar: avatar || null,
    socialClients: normBrands(req.body.socialClients ?? req.body.brands),
    invitePending: true, invitedAt: new Date(),
  });
  const { link, expiresAt } = await sec.issueLink(user.id, "invite", sec.INVITE_TTL_MS, req.user.id);
  const mail = req.body.sendEmail === false ? { sent: false } : await sec.mailInvite(user, link, req.user.name);
  sec.logEvent(req, { userId: user.id, email: addr, type: "invite_sent", actorId: req.user.id, meta: { roles: list, emailed: !!mail.sent } });
  await announceBrands(user, [], req.user.id);
  await sweepSocial();
  res.status(201).json({
    user: safe(user), link, expiresAt, emailed: !!mail.sent,
    message: mail.sent ? `Invite emailed to ${addr}.` : "Email isn't set up, so nothing was sent — copy the invite link and share it with them.",
  });
});

/* POST /users/:id/resend-invite — new 72 h link (the old one stops working). */
const resendInvite = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  if (!user.invitePending) return res.status(400).json({ message: "This user has already set a password. Send a reset link instead." });
  if (!user.active) return res.status(400).json({ message: "This account is deactivated. Reactivate it first." });
  const { link, expiresAt } = await sec.issueLink(user.id, "invite", sec.INVITE_TTL_MS, req.user.id);
  const mail = req.body?.sendEmail === false ? { sent: false } : await sec.mailInvite(user, link, req.user.name);
  user.invitedAt = new Date(); await user.save({ fields: ["invitedAt"] });
  sec.logEvent(req, { userId: user.id, email: user.email, type: "invite_sent", actorId: req.user.id, meta: { resend: true, emailed: !!mail.sent } });
  res.json({
    user: safe(user), link, expiresAt, emailed: !!mail.sent,
    message: mail.sent ? `Invite emailed again to ${user.email}.` : "Email isn't set up, so nothing was sent — copy the invite link and share it with them.",
  });
});

/* POST /users/:id/unlock */
const unlock = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  user.failedLogins = 0; user.firstFailedAt = null; user.lockedUntil = null;
  await user.save({ fields: ["failedLogins", "firstFailedAt", "lockedUntil"] });
  forgetUser(user.id);
  sec.logEvent(req, { userId: user.id, email: user.email, type: "unlocked", actorId: req.user.id });
  res.json({ message: "Account unlocked.", user: safe(user) });
});

/* POST /users/:id/2fa/reset — turn off someone's two-step login (lost phone). */
const resetTwoFactor = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  const was = !!user.twoFactorEnabled;
  user.twoFactorEnabled = false; user.twoFactorSecret = null; user.twoFactorBackup = null;
  await user.save({ fields: ["twoFactorEnabled", "twoFactorSecret", "twoFactorBackup"] });
  forgetUser(user.id);
  if (was) {
    sec.logEvent(req, { userId: user.id, email: user.email, type: "2fa_disabled", actorId: req.user.id, meta: { byAdmin: true } });
    sec.tellUser(user, { title: "Two-step login was turned off", body: `${req.user.name || "An admin"} turned off two-step login for your Finvera account. You can turn it on again from your account page.` });
  }
  res.json({ message: was ? "Two-step login turned off for this user." : "Two-step login was already off.", user: safe(user) });
});

/* GET /users/:id/sessions */
const userSessions = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  res.json({ sessions: await sec.listSessions(user.id, req.jti) });
});

/* POST /users/:id/logout-all */
const userLogoutAll = asyncHandler(async (req, res) => {
  const user = await findUser(req, res); if (!user) return;
  const self = Number(user.id) === Number(req.user.id);
  const count = await sec.revokeSessions(user.id, { exceptJti: self ? req.jti : null, reason: "admin_logout_all", cutLegacy: !self || !!req.jti });
  sec.logEvent(req, { userId: user.id, email: user.email, type: "logout_all", actorId: req.user.id, meta: { count, byAdmin: true } });
  res.json({ message: `Signed ${user.name} out of ${count} device${count === 1 ? "" : "s"}.`, count });
});

/* DELETE /users/:id/sessions/:sid */
const userRevokeSession = asyncHandler(async (req, res) => {
  const s = await UserSession.findOne({ where: { id: Number(req.params.sid) || 0, userId: Number(req.params.id) || 0 } });
  if (!s || s.revokedAt) return res.status(404).json({ message: "Session not found." });
  await sec.revokeOne(s, "admin_revoked");
  sec.logEvent(req, { userId: s.userId, type: "session_revoked", actorId: req.user.id, meta: { sessionId: s.id, device: s.device, byAdmin: true } });
  res.json({ message: "Signed out of that device.", id: s.id });
});

/* GET /users/:id/activity?page&limit&type */
const userActivity = asyncHandler(async (req, res) => {
  res.json(await pagedEvents({ userId: Number(req.params.id) || 0 }, req.query));
});

/* GET /security/log?userId&type&from&to&page&limit&q (q = email contains) */
const securityLog = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.userId) where.userId = Number(req.query.userId) || 0;
  if (req.query.q) where.email = { [Op.like]: `%${String(req.query.q).replace(/[%_\\]/g, "\\$&")}%` };
  res.json(await pagedEvents(where, req.query));
});

module.exports = {
  list, assignable, create, update, remove,
  resetLink, requirePasswordChange, invite, resendInvite, unlock, resetTwoFactor,
  userSessions, userLogoutAll, userRevokeSession, userActivity, securityLog,
};
