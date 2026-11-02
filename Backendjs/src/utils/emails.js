/* Email alerts on top of mailer.js — who gets what, per-user preferences,
   and a cross-process throttle.

   Every user has emailPrefs (JSON column on users), default all on:
     { contact, renewals, calendar, publishing, security, system }
   (system = server error alerts and failed backups — admins only).
   An email is only sent to an active user with an address whose pref for
   that kind isn't false. Everything here is fire-and-forget: it never throws
   and never makes the caller wait for SMTP. */

const { Op } = require("sequelize");
const { User, Setting, sequelize } = require("../models");
const { rolesOf } = require("./permissions");
const mailer = require("./mailer");

const PREF_KINDS = ["contact", "renewals", "calendar", "publishing", "security", "system"];
const DEFAULT_PREFS = Object.freeze(Object.fromEntries(PREF_KINDS.map((k) => [k, true])));

function prefsOf(user) {
  let p = user && user.emailPrefs;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = null; } }
  const out = { ...DEFAULT_PREFS };
  if (p && typeof p === "object") for (const k of PREF_KINDS) if (typeof p[k] === "boolean") out[k] = p[k];
  return out;
}

/* Only known keys, only booleans. */
function cleanPrefs(input) {
  const out = {};
  if (input && typeof input === "object") for (const k of PREF_KINDS) if (input[k] !== undefined) out[k] = !!input[k];
  return out;
}

const wants = (user, kind) => !!(user && user.active !== false && user.email && prefsOf(user)[kind] !== false);

/* Active users holding any of `roles` (admins always). */
async function usersWithRoles(roles = []) {
  const targets = ["admin", ...roles];
  const users = await User.findAll({ where: { active: true } });
  return users.filter((u) => rolesOf(u).some((r) => targets.includes(r)));
}

/* Base URL of the admin dashboard for links in emails. */
function dashboardUrl(path = "/dashboard") {
  const fromCors = String(process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).find((o) => /^https:\/\//.test(o) && !/localhost/.test(o));
  const base = (process.env.ADMIN_URL || process.env.FRONTEND_URL || fromCors || "https://www.finvera.solutions").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : `/${path}`);
}

/* Send one message to each user (separately, so addresses aren't shared).
   `build(user)` may return a per-user { subject, html, text, replyTo } or
   null to skip that user. Runs after the current request; never throws. */
function emailUsers(users, kind, build) {
  if (!mailer.configured()) return;
  const list = (users || []).filter((u) => wants(u, kind));
  if (!list.length) return;
  setImmediate(async () => {
    const seen = new Set();
    for (const u of list) {
      const addr = String(u.email).trim().toLowerCase();
      if (seen.has(addr)) continue;
      seen.add(addr);
      try {
        const msg = typeof build === "function" ? build(u) : build;
        if (!msg) continue;
        await mailer.sendMail({ to: u.email, ...msg });
      } catch (e) { console.warn(`email (${kind}):`, e.message); }
    }
  });
}

/* Cross-process "at most once per window": a settings row holds the epoch ms
   of the last time; one UPDATE claims it atomically. Returns true for the
   single caller that won. Fails closed (false) on DB errors. */
async function claimOnce(key, windowMs) {
  const k = `throttle.${key}`.slice(0, 250);
  const now = Date.now();
  try {
    await Setting.findOrCreate({ where: { key: k }, defaults: { key: k, value: "0", group: "system", isPublic: false } });
    const [n] = await Setting.update({ value: String(now) }, {
      where: {
        key: k,
        [Op.or]: [
          { value: null }, { value: "" },
          sequelize.where(sequelize.cast(sequelize.col("value"), "UNSIGNED"), Op.lt, now - windowMs),
        ],
      },
    });
    return n > 0;
  } catch (e) {
    console.warn("claimOnce:", e.message);
    return false;
  }
}

/* Small HTML helpers for list-style emails. */
const esc = mailer.esc;
const ul = (items) => `<ul style="padding-left:18px;margin:8px 0">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join("")}</ul>`;

/* In-app notification + email to admins (and `roles`), at most once per
   `windowMs` across all app processes (keyed by `key`). Never throws.
   payload: { type, title, body, link, meta }; mail: { subject, html, text }. */
async function alertTeam({ key, windowMs, roles = [], kind, payload, mail }) {
  try {
    if (key && !(await claimOnce(key, windowMs))) return false;
    const { notifyRoles } = require("./notify");
    await notifyRoles(roles, payload);
    if (mail) emailUsers(await usersWithRoles(roles), kind, mail);
    return true;
  } catch (e) { console.warn("alertTeam:", e.message); return false; }
}

module.exports = { alertTeam, PREF_KINDS, DEFAULT_PREFS, prefsOf, cleanPrefs, wants, usersWithRoles, dashboardUrl, emailUsers, claimOnce, esc, ul, layout: mailer.layout };
