/* Notification helpers — create in-app notifications for the right recipients.
   All helpers swallow their own errors so a notification failure can never
   break the underlying action (creating a lead, posting a comment, etc.). */

const { Notification, User } = require("../models");

const rolesOf = (u) => (Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []));

async function createFor(userIds, payload) {
  const ids = [...new Set((userIds || []).filter((id) => id != null))];
  if (!ids.length) return;
  await Notification.bulkCreate(ids.map((userId) => ({
    userId,
    type: payload.type || "info",
    title: payload.title,
    body: payload.body || null,
    link: payload.link || null,
    meta: payload.meta || null,
  })));
}

/* Notify every active user whose role set intersects `roles` (admins always). */
async function notifyRoles(roles, payload, exceptUserId) {
  try {
    const users = await User.findAll({ where: { active: true } });
    const targets = ["admin", ...(roles || [])];
    const ids = users
      .filter((u) => rolesOf(u).some((r) => targets.includes(r)))
      .map((u) => u.id)
      .filter((id) => id !== exceptUserId);
    await createFor(ids, payload);
  } catch (e) { console.warn("notifyRoles:", e.message); }
}

/* Notify specific user ids. */
async function notifyUsers(userIds, payload, exceptUserId) {
  try {
    await createFor((userIds || []).filter((id) => id !== exceptUserId), payload);
  } catch (e) { console.warn("notifyUsers:", e.message); }
}

/* Notify a user matched by display name (leads store the owner's name). */
async function notifyByName(name, payload, exceptUserId) {
  try {
    if (!name) return;
    const u = await User.findOne({ where: { name } });
    if (u && u.id !== exceptUserId) await createFor([u.id], payload);
  } catch (e) { console.warn("notifyByName:", e.message); }
}

module.exports = { notifyRoles, notifyUsers, notifyByName };
