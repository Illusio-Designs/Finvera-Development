/* Notification helpers — create in-app notifications for the right recipients
   and push them to every device each recipient enabled.
   All helpers swallow their own errors so a notification failure can never
   break the underlying action (creating a lead, posting a comment, etc.). */

const { Op } = require("sequelize");
const { Notification, User, PushSubscription, SocialClient } = require("../models");
const { rolesOf } = require("./permissions");
const webpush = require("./webpush");

const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

/* Push one message to all of a user's devices; drop subscriptions the push
   service says are gone (app removed, permission revoked). */
async function pushToUser(userId, message) {
  const subs = await PushSubscription.findAll({ where: { userId } });
  if (!subs.length) return { sent: 0, devices: 0 };
  const unread = await Notification.count({ where: { userId, isRead: false } });
  let sent = 0;
  for (const s of subs) {
    const status = await webpush.send(s, { ...message, badge: unread });
    if (status >= 200 && status < 300) { sent++; s.update({ lastSuccessAt: new Date() }).catch(() => {}); }
    else if (status === 404 || status === 410) await s.destroy().catch(() => {});
    else if (status) console.warn(`push ${status} for user ${userId}`);
  }
  return { sent, devices: subs.length };
}

function pushLater(rows) {
  if (!rows.length) return;
  setImmediate(async () => {
    for (const n of rows) {
      try {
        await pushToUser(n.userId, { title: n.title, body: n.body || "", url: n.link || "/dashboard", tag: n.tag || `n${n.id}`, type: n.type });
      } catch (e) { console.warn("push:", e.message); }
    }
  });
}

/* payload: { type, title, body, link, meta, tag }
   opts.merge = { key, minutes }: if this user already has an UNREAD
   notification with the same merge key from the last few minutes, update it
   in place (no second push) — keeps a burst of quick edits to one alert. */
async function createFor(userIds, payload, opts = {}) {
  const ids = [...new Set((userIds || []).filter((id) => id != null).map(Number))];
  if (!ids.length) return;
  const fresh = [];
  const merge = opts.merge;
  for (const userId of ids) {
    if (merge?.key) {
      const since = new Date(Date.now() - (merge.minutes || 15) * 60000);
      const recent = await Notification.findAll({ where: { userId, isRead: false, type: payload.type || "info", createdAt: { [Op.gte]: since } }, order: [["createdAt", "DESC"]], limit: 20 });
      const hit = recent.find((n) => {
        const m = typeof n.meta === "string" ? (() => { try { return JSON.parse(n.meta); } catch { return {}; } })() : (n.meta || {});
        return m.mergeKey === merge.key;
      });
      if (hit) {
        // Combine the change notes of both alerts and re-render the body.
        const m = typeof hit.meta === "string" ? (() => { try { return JSON.parse(hit.meta); } catch { return {}; } })() : (hit.meta || {});
        const notes = [...new Set([...(m.notes || []), ...(merge.notes || [])])];
        await hit.update({ title: payload.title, body: merge.render ? merge.render(notes) : payload.body, meta: { ...m, notes } });
        continue;
      }
    }
    fresh.push({
      userId,
      type: payload.type || "info",
      title: String(payload.title).slice(0, 250),
      body: payload.body || null,
      link: payload.link || null,
      meta: merge?.key ? { ...(payload.meta || {}), mergeKey: merge.key, notes: merge.notes || [] } : (payload.meta || null),
    });
  }
  if (!fresh.length) return;
  const rows = await Notification.bulkCreate(fresh);
  pushLater(rows.map((r) => ({ ...r.toJSON(), tag: payload.tag })));
}

/* Notify every active user whose role set intersects `roles` (admins always). */
async function notifyRoles(roles, payload, exceptUserId, opts) {
  try {
    const users = await User.findAll({ where: { active: true } });
    const targets = ["admin", ...(roles || [])];
    const ids = users
      .filter((u) => rolesOf(u).some((r) => targets.includes(r)))
      .map((u) => u.id)
      .filter((id) => id !== exceptUserId);
    await createFor(ids, payload, opts);
  } catch (e) { console.warn("notifyRoles:", e.message); }
}

/* Admins only. */
const notifyAdmins = (payload, exceptUserId, opts) => notifyRoles([], payload, exceptUserId, opts);

/* Notify specific user ids. */
async function notifyUsers(userIds, payload, exceptUserId, opts) {
  try {
    await createFor((userIds || []).filter((id) => id != null && Number(id) !== Number(exceptUserId)), payload, opts);
  } catch (e) { console.warn("notifyUsers:", e.message); }
}

/* Notify a user matched by display name (leads store the owner's name). */
async function notifyByName(name, payload, exceptUserId, opts) {
  try {
    if (!name) return;
    const u = await User.findOne({ where: { name } });
    if (u && u.id !== exceptUserId) await createFor([u.id], payload, opts);
  } catch (e) { console.warn("notifyByName:", e.message); }
}

/* Active non-admin users who were given this social brand (by name) by an
   admin. Users store brand ids, so resolve the name first. */
async function brandUserIds(brandName) {
  const brand = await SocialClient.findOne({ where: { name: brandName } });
  if (!brand) return [];
  const id = String(brand.id);
  const users = await User.findAll({ where: { active: true } });
  return users
    .filter((u) => !rolesOf(u).includes("admin") && asArr(u.socialClients).map(String).includes(id))
    .map((u) => u.id);
}

/* Write already-built notification rows (e.g. daily reminders) and push them. */
async function createRows(rows) {
  if (!rows.length) return;
  const saved = await Notification.bulkCreate(rows);
  pushLater(saved.map((r) => r.toJSON()));
}

module.exports = { notifyRoles, notifyAdmins, notifyUsers, notifyByName, brandUserIds, createRows, pushToUser };
