const { Seo, Setting } = require("../models");
const { asyncHandler } = require("../utils/crud");

/* ── SEO (per page) ──────────────────────────────────── */
const listSeo = asyncHandler(async (_req, res) => {
  res.json(await Seo.findAll({ order: [["page", "ASC"]] }));
});

const getSeo = asyncHandler(async (req, res) => {
  const row = await Seo.findOne({ where: { page: req.params.page } });
  if (!row) return res.status(404).json({ message: "No SEO config for that page." });
  res.json(row);
});

/* Upsert SEO for a page (admin) */
const upsertSeo = asyncHandler(async (req, res) => {
  const page = req.params.page || req.body.page;
  if (!page) return res.status(400).json({ message: "page is required." });
  const [row] = await Seo.findOrCreate({ where: { page }, defaults: { page } });
  await row.update({ ...req.body, page });
  res.json(row);
});

/* ── Settings (key/value: analytics, pixels, brand) ──── */
const getSettings = asyncHandler(async (req, res) => {
  const where = req.user ? {} : { isPublic: true };
  const rows = await Setting.findAll({ where });
  // return as a flat object { key: value } plus grouped meta
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  res.json(map);
});

const getSettingsDetailed = asyncHandler(async (_req, res) => {
  res.json(await Setting.findAll({ order: [["group", "ASC"], ["key", "ASC"]] }));
});

/* Bulk upsert settings (admin): body = { key: value, ... } or [{key,value,group,isPublic}] */
const updateSettings = asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body)
    ? req.body
    : Object.entries(req.body).map(([key, value]) => ({ key, value }));
  const results = [];
  for (const e of entries) {
    if (!e.key) continue;
    const [row] = await Setting.findOrCreate({ where: { key: e.key }, defaults: { key: e.key } });
    await row.update({
      value: e.value != null ? String(e.value) : row.value,
      group: e.group || row.group,
      isPublic: e.isPublic != null ? e.isPublic : row.isPublic,
    });
    results.push(row);
  }
  res.json(results);
});

module.exports = { listSeo, getSeo, upsertSeo, getSettings, getSettingsDetailed, updateSettings };
