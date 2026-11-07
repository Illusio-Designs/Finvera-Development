const { Op } = require("sequelize");
const { Seo, Setting, sequelize } = require("../models");
const NOT_SYSTEM = { [Op.or]: [{ group: null }, { group: { [Op.ne]: "system" } }] };
const { asyncHandler } = require("../utils/crud");
const pubCache = require("../utils/publicCache");

/* ── SEO (per page) ──────────────────────────────────── */
/* SEO rows are public and the same for every visitor, so signed-out reads
   come from the shared public cache; upsertSeo clears it. Signed-in (admin)
   reads always hit the database. */
const seoListBody = () => pubCache.get("seo:list", () => Seo.findAll({ order: [["page", "ASC"]] }));
// { page: row } for /public/bootstrap — built from the cached list.
const publicSeoMapBody = () => pubCache.get("seo:map", async () => {
  const rows = JSON.parse(await seoListBody());
  return Object.fromEntries(rows.map((r) => [r.page, r]));
});

const listSeo = asyncHandler(async (req, res) => {
  if (req.user) return res.json(await Seo.findAll({ order: [["page", "ASC"]] })); // admin: always fresh
  pubCache.sendPublic(res, await seoListBody());
});

const getSeo = asyncHandler(async (req, res) => {
  if (req.user) {
    const row = await Seo.findOne({ where: { page: req.params.page } });
    if (!row) return res.status(404).json({ message: "No SEO config for that page." });
    return res.json(row);
  }
  const body = await pubCache.get(`seo:one:${req.params.page}`, () => Seo.findOne({ where: { page: req.params.page } }));
  if (body === "null") return res.status(404).json({ message: "No SEO config for that page." });
  pubCache.sendPublic(res, body);
});

/* Upsert SEO for a page (admin) */
const upsertSeo = asyncHandler(async (req, res) => {
  const row = await require("./seo.controller").save(req);
  pubCache.clear();
  res.json(row);
});

/* ── Settings (key/value: analytics, pixels, brand) ──── */
/* The flat map is read by every page of the public site (pixels) and rarely
   changes. The public map lives in the shared public cache (~60 s, also used
   by /public/bootstrap); the signed-in map is kept per process for a minute.
   Saving settings here clears both (another app process catches up within
   the minute). */
const SETTINGS_TTL_MS = 60 * 1000;
const flatCache = { all: null };
const clearSettingsCache = () => { flatCache.all = null; pubCache.clear(); };

async function loadFlat(signedIn) {
  // Signed-in users get every non-internal setting; the "system" group (seed
  // version, push keys, migration markers) is never returned.
  const where = signedIn ? NOT_SYSTEM : { isPublic: true, ...NOT_SYSTEM };
  const rows = await Setting.findAll({ where, attributes: ["key", "value"], raw: true });
  // return as a flat object { key: value }
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
}
const publicSettingsBody = () => pubCache.get("settings:public", () => loadFlat(false));

const getSettings = asyncHandler(async (req, res) => {
  if (!req.user) return pubCache.sendPublic(res, await publicSettingsBody());
  const hit = flatCache.all;
  if (hit && Date.now() - hit.at < SETTINGS_TTL_MS) return res.json(hit.map);
  const map = await loadFlat(true);
  flatCache.all = { at: Date.now(), map };
  res.json(map);
});

const getSettingsDetailed = asyncHandler(async (_req, res) => {
  res.json(await Setting.findAll({ where: NOT_SYSTEM, order: [["group", "ASC"], ["key", "ASC"]] }));
});

/* Values of these keys are written into every public page — the tracking IDs
   straight into inline <script> tags, the links into href attributes — so
   they are checked before anything is saved. The rules are deliberately
   loose (the admin page checks the exact formats); they only refuse values
   that could break out of the script or link. Empty always clears. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SETTING_RULES = {
  google_analytics_id: [ID_RE, "Google Analytics ID can only use letters, numbers and dashes, like G-7QK2M4X9TL."],
  google_tag_manager_id: [ID_RE, "Google Tag Manager ID can only use letters, numbers and dashes, like GTM-ABC123."],
  facebook_pixel_id: [ID_RE, "Facebook Pixel ID should be the number from Events Manager."],
  google_site_verification: [/^[A-Za-z0-9_\-+=/.]{1,200}$/, "Paste only the content value from Search Console, not the whole tag."],
  contact_email: [/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/, "That doesn't look like an email address."],
  social_x: [/^https?:\/\/[^\s<>"']+$/i, "Use a full link that starts with https://"],
  social_linkedin: [/^https?:\/\/[^\s<>"']+$/i, "Use a full link that starts with https://"],
  social_github: [/^https?:\/\/[^\s<>"']+$/i, "Use a full link that starts with https://"],
  social_instagram: [/^https?:\/\/[^\s<>"']+$/i, "Use a full link that starts with https://"],
};
function checkSetting(key, value) {
  const rule = SETTING_RULES[key];
  if (!rule || value == null) return { ok: true, value };
  const v = String(value).trim();
  if (v === "" || rule[0].test(v)) return { ok: true, value: v };
  return { ok: false, message: rule[1] };
}

/* Bulk upsert settings (admin): body = { key: value, ... } or [{key,value,group,isPublic}] */
const updateSettings = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== "object") return res.status(400).json({ message: "Send setting values as an object or array." });
  const entries = Array.isArray(req.body) ? req.body : Object.entries(req.body).map(([key, value]) => ({ key, value }));
  if (entries.length > 200) return res.status(400).json({ message: "Save at most 200 settings at once." });
  const keys = new Set();
  for (const e of entries) {
    if (!e || typeof e !== "object" || typeof e.key !== "string" || !/^[A-Za-z0-9_.-]{1,255}$/.test(e.key) || keys.has(e.key)) return res.status(400).json({ message: "Each setting needs a unique, valid key." });
    keys.add(e.key);
    if ((e.value != null && !["string", "number", "boolean"].includes(typeof e.value)) || String(e.value ?? "").length > 60000 || (e.group != null && (typeof e.group !== "string" || e.group.length > 255)) || (e.isPublic != null && typeof e.isPublic !== "boolean") || (e.expectedValue != null && typeof e.expectedValue !== "string")) return res.status(400).json({ message: "That setting value or metadata is invalid.", field: e.key });
    const c = checkSetting(e.key, e.value);
    if (!c.ok) return res.status(400).json({ message: c.message, field: e.key });
    e.value = c.value;
  }
  const skipped = [];
  const results = await sequelize.transaction(async transaction => {
    const out = [];
    // Stable lock order keeps simultaneous bulk edits from deadlocking.
    for (const e of [...entries].sort((a, b) => a.key.localeCompare(b.key))) {
      const existing = await Setting.findOne({ where: { key: e.key }, transaction, lock: transaction.LOCK.UPDATE });
      if ((existing && existing.group === "system") || e.group === "system") { skipped.push(e.key); continue; }
      if (Object.prototype.hasOwnProperty.call(e, "expectedValue") && String(existing?.value ?? "") !== String(e.expectedValue ?? "")) throw Object.assign(new Error("Settings changed since you opened this page. Reload saved values before saving; your edits have been kept."), { status: 409 });
      const row = existing || await Setting.create({ key: e.key }, { transaction });
      await row.update({ value: e.value != null ? String(e.value) : row.value, group: e.group || row.group, isPublic: e.isPublic != null ? e.isPublic : row.isPublic }, { transaction });
      out.push(row);
    }
    return out;
  });
  clearSettingsCache();
  if (skipped.length) res.set("X-Settings-Skipped", skipped.join(","));
  res.json(results);
});

module.exports = { listSeo, getSeo, upsertSeo, getSettings, getSettingsDetailed, updateSettings, publicSettingsBody, publicSeoMapBody };
