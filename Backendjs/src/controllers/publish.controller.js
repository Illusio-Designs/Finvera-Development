/* Social accounts (connect a brand's Facebook Page + Instagram) and the
   auto-publishing queue. The connect flow follows Collabhype's OAuth
   controller: a signed state carries who started it through Facebook's
   redirect; the Pages found are kept briefly (encrypted, in settings so any
   app process can finish the flow) until an admin picks one. */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { Op } = require("sequelize");
const { sequelize, SocialAccount, SocialPublishJob, SocialPost, Setting } = require("../models");
const { asyncHandler } = require("../utils/crud");
const meta = require("../utils/meta");
const auto = require("../utils/autoPublish");
const { canApprove, liveLink, contentHash } = require("../utils/socialSafety");
const { rolesOf } = require("../utils/permissions");
const { UPLOAD_DIR } = require("../middleware/upload");

const checkpointOf = (value) => { if (value && typeof value === "object") return value; try { return JSON.parse(value || "{}"); } catch { return { publishCalled: true }; } };

const SEL_TTL_MS = 15 * 60 * 1000;
const frontendUrl = require("../utils/frontendUrl");
const inScope = (req, client) => !req.socialScope || req.socialScope.has(client);
const publicAccount = (a) => ({
  client: a.client, pageId: a.pageId, pageName: a.pageName, igUserId: a.igUserId, igUsername: a.igUsername,
  igAvatar: a.igAvatar, status: a.status, lastError: a.status === "connected" ? null : a.lastError, connectedAt: a.updatedAt,
  tokenExpiresAt: a.tokenExpiresAt || null, lastCheckedAt: a.lastCheckedAt || null,
});

/* ── Connect ── */
const status = asyncHandler(async (_req, res) => {
  res.json({ configured: meta.configured(), redirectUri: meta.redirectUri(), scopes: meta.SCOPES });
});

const start = asyncHandler(async (req, res) => {
  if (!meta.configured()) return res.status(400).json({ message: "Add META_APP_ID and META_APP_SECRET to the server settings first." });
  const brand = String(req.query.brand || "").trim();
  if (!brand) return res.status(400).json({ message: "Which brand?" });
  const state = jwt.sign({ kind: "meta-connect", sub: req.user.id, brand }, process.env.JWT_SECRET, { expiresIn: "10m" });
  res.json({ authUrl: meta.buildAuthUrl(state) });
});

const callback = async (req, res) => {
  const back = (params) => res.redirect(`${frontendUrl()}/dashboard/social-studio?${new URLSearchParams(params).toString()}`);
  const { code, state, error, error_description: desc } = req.query;
  if (error) return back({ metaError: desc || error });
  try {
    const s = jwt.verify(String(state || ""), process.env.JWT_SECRET);
    if (s.kind !== "meta-connect") throw new Error("Invalid sign-in link.");
    const token = await meta.exchangeCode(String(code || ""));
    const pages = await meta.listPages(token);
    if (!pages.length) return back({ metaError: "No Facebook Pages found on that account. Log in with the account that manages the brand's Page." });
    const id = crypto.randomBytes(16).toString("hex");
    await Setting.create({ key: `meta.sel.${id}`, group: "system", isPublic: false,
      value: meta.encrypt(JSON.stringify({ userId: s.sub, brand: s.brand, pages, exp: Date.now() + SEL_TTL_MS })) });
    back({ metaConnect: id, brand: s.brand });
  } catch (e) {
    console.warn("meta connect:", e.message);
    back({ metaError: `Couldn't connect: ${e.message}` });
  }
};

async function readSelection(id, userId) {
  if (!/^[a-f0-9]{32}$/.test(String(id || ""))) return null;
  const row = await Setting.findOne({ where: { key: `meta.sel.${id}` } });
  if (!row) return null;
  let sel = null;
  try { sel = JSON.parse(meta.decrypt(row.value)); } catch { sel = null; }
  if (!sel || sel.exp < Date.now() || sel.userId !== userId) return null;
  return { sel, row };
}

const pages = asyncHandler(async (req, res) => {
  const r = await readSelection(req.query.sel, req.user.id);
  if (!r) return res.status(404).json({ message: "This connection has expired — click Connect again." });
  res.json({ brand: r.sel.brand, pages: r.sel.pages.map(({ pageToken, ...p }) => p) });
});

const choose = asyncHandler(async (req, res) => {
  const r = await readSelection(req.body?.sel, req.user.id);
  if (!r) return res.status(404).json({ message: "This connection has expired — click Connect again." });
  const page = r.sel.pages.find((p) => p.pageId === String(req.body?.pageId));
  if (!page) return res.status(400).json({ message: "Pick one of the Pages listed." });
  const data = {
    client: r.sel.brand, pageId: page.pageId, pageName: page.pageName, pageToken: meta.encrypt(page.pageToken),
    igUserId: page.igUserId, igUsername: page.igUsername, igAvatar: page.igAvatar, connectedBy: req.user.id, status: "connected", lastError: null,
  };
  const existing = await SocialAccount.findOne({ where: { client: data.client } });
  const acc = existing ? await existing.update(data) : await SocialAccount.create(data);
  await r.row.destroy();
  await auto.syncBrand(acc.client);
  res.json(publicAccount(acc));
});

const accounts = asyncHandler(async (req, res) => {
  const rows = await SocialAccount.findAll({ order: [["client", "ASC"]] });
  res.json(rows.filter((a) => inScope(req, a.client)).map(publicAccount));
});

const disconnect = asyncHandler(async (req, res) => {
  const acc = await SocialAccount.findOne({ where: { client: req.params.client } });
  if (acc) { await acc.destroy(); await auto.syncBrand(req.params.client); }
  res.json({ ok: true });
});

/* ── Queue ── */
const jobs = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.postId) where.postId = Number(req.query.postId);
  else where[Op.or] = [{ status: { [Op.in]: ["scheduled", "publishing", "failed", "check", "missed"] } }, { updatedAt: { [Op.gte]: new Date(Date.now() - 14 * 86400000) } }];
  const rows = (await SocialPublishJob.findAll({ where, order: [["runAt", "ASC"]], limit: 300 })).filter((j) => inScope(req, j.client) && j.status !== "cancelled");
  const posts = await SocialPost.findAll({ where: { id: [...new Set(rows.map((j) => j.postId))] }, attributes: ["id", "theme", "format", "client", "status", "postDate", "postTime"] });
  const accs = await SocialAccount.findAll();
  const byId = new Map(posts.map((p) => [p.id, p]));
  res.json(rows.map((j) => {
    const p = byId.get(j.postId), a = accs.find((x) => x.client === j.client);
    return {
      id: j.id, postId: j.postId, client: j.client, platform: j.platform, status: j.status, runAt: j.runAt, attempts: j.attempts,
      error: j.error, url: j.url, publishedAt: j.publishedAt,
      account: j.platform === "instagram" ? (a?.igUsername ? `@${a.igUsername}` : null) : a?.pageName || null,
      theme: p?.theme || "(deleted post)", format: p?.format || null, postStatus: p?.status || null,
    };
  }));
});

async function jobInScope(req, res) {
  const j = await SocialPublishJob.findByPk(req.params.id);
  if (!j || !inScope(req, j.client)) { res.status(404).json({ message: "Not found." }); return null; }
  return j;
}

/* Failed / needs checking / missed → try again now. */
const retry = asyncHandler(async (req, res) => {
  const original = await jobInScope(req, res); if (!original) return;
  const outcome = await sequelize.transaction(async (transaction) => {
    const post = await SocialPost.findByPk(original.postId, { transaction, lock: transaction.LOCK.UPDATE });
    const job = await SocialPublishJob.findByPk(original.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!post || !job || post.status !== "ready" || !canApprove(post, req.userRow || req.user)) return { status: 403, message: "The approved post must be Ready and assigned to you, or you must be an admin." };
    if (!["failed", "check", "missed"].includes(job.status)) return { status: 400, message: "Only failed, missed or uncertain jobs can be retried." };
    let checkpoint = checkpointOf(job.checkpoint);
    const uncertain = job.status === "check" || checkpoint.publishCalled;
    if (uncertain) {
      if (!rolesOf(req.userRow || req.user).includes("admin") || req.body?.confirmedAbsent !== true) return { status: 409, message: "The post may already be live. An admin must check the platform and explicitly confirm it is absent before retrying." };
      checkpoint = { absenceConfirmedBy: req.user.id, absenceConfirmedAt: new Date().toISOString(), approvedHash: contentHash(post) };
    }
    await job.update({ status: "scheduled", runAt: new Date(), error: null, attempts: 0, checkpoint }, { transaction });
    return { ok: true };
  });
  if (outcome.status) return res.status(outcome.status).json({ message: outcome.message });
  if (req.body?.confirmedAbsent) require("../utils/audit").record(req, { action: "other", entity: "social-post", entityId: original.postId, summary: "Admin confirmed uncertain post absent and authorized a retry" });
  setImmediate(() => auto.runDue({ force: true }));
  res.json(outcome);
});

/* Operator confirmation requires a platform-specific live permalink. */
const markPosted = asyncHandler(async (req, res) => {
  const original = await jobInScope(req, res); if (!original) return;
  const url = String(req.body?.url || "").trim();
  if (!liveLink(url, original.platform)) return res.status(400).json({ message: "Paste a valid HTTPS live post link for this platform." });
  const outcome = await sequelize.transaction(async (transaction) => {
    const post = await SocialPost.findByPk(original.postId, { transaction, lock: transaction.LOCK.UPDATE });
    const job = await SocialPublishJob.findByPk(original.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!post || !job || !canApprove(post, req.userRow || req.user)) return false;
    if (job.status === "publishing") return false;
    await job.update({ status: "published", url, error: null, publishedAt: new Date(), leaseToken: null, leaseUntil: null }, { transaction });
    return true;
  });
  if (!outcome) return res.status(409).json({ message: "Only the reviewer or admin can confirm a live result, and publishing must have finished." });
  require("../utils/audit").record(req, { action: "other", entity: "social-post", entityId: original.postId, summary: `Confirmed live ${original.platform} post: ${url}` });
  await auto.afterPublished(await SocialPost.findByPk(original.postId));
  res.json({ ok: true });
});

/* Publish now changes the time; it never bypasses approval or an uncertain result. */
const publishNow = asyncHandler(async (req, res) => {
  const outcome = await sequelize.transaction(async (transaction) => {
    const post = await SocialPost.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!post) return { status: 404, message: "Post not found." };
    if (post.status !== "ready" || !canApprove(post, req.userRow || req.user)) return { status: 403, message: "Only an approved Ready post can be published by its reviewer or an admin." };
    const jobs = await SocialPublishJob.findAll({ where: { postId: post.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (jobs.some((j) => j.status === "check" || (j.status !== "published" && checkpointOf(j.checkpoint).publishCalled))) return { status: 409, message: "Check the uncertain platform result before publishing again." };
    const acc = await SocialAccount.findOne({ where: { client: post.client }, transaction });
    const targets = auto.targetsFor(post, acc);
    if (!targets.length) return { status: 400, message: "Connect and enable the brand’s Instagram / Facebook channels first." };
    for (const platform of targets) {
      const job = jobs.find((j) => j.platform === platform);
      if (job && ["published", "publishing"].includes(job.status)) continue;
      const fields = { status: "scheduled", runAt: new Date(), error: null, attempts: 0, checkpoint: { approvedHash: contentHash(post) } };
      if (job) await job.update(fields, { transaction });
      else await SocialPublishJob.create({ postId: post.id, client: post.client, platform, ...fields }, { transaction });
    }
    return { ok: true, platforms: targets };
  });
  if (outcome.status) return res.status(outcome.status).json({ message: outcome.message });
  setImmediate(() => auto.runDue({ force: true }));
  res.json(outcome);
});

/* ── Media for posts (images and videos, larger than ordinary uploads) ── */
const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => { const d = path.join(UPLOAD_DIR, "social"); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${path.basename(file.originalname, ext).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpe?g|png|webp|mp4|mov|m4v)$/i.test(file.originalname) && /^(image|video)\//.test(file.mimetype);
    cb(ok ? null : new Error("Upload JPG/PNG images or MP4/MOV videos."), ok);
  },
  limits: { fileSize: Number(process.env.SOCIAL_UPLOAD_MB || 100) * 1024 * 1024, files: 10 },
});
const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ message: "No files uploaded." });
  // Images → JPEG (Instagram publishing needs JPEG), max 2000 px, + a thumbnail;
  // videos are stored untouched. Without sharp on the host: stored as uploaded.
  const { describe } = require("./upload.controller");
  const items = [];
  for (const f of req.files) {
    const video = /^video\//.test(f.mimetype);
    const d = video ? null : await describe(req, f, { mode: "social", sub: "social" });
    const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    items.push(d
      ? { url: d.url, type: "image", name: f.originalname, size: d.size, thumbUrl: d.thumbUrl, width: d.width, height: d.height, bytes: d.bytes, originalBytes: d.originalBytes }
      : { url: `${base}/uploads/social/${f.filename}`, type: video ? "video" : "image", name: f.originalname, size: f.size });
  }
  res.status(201).json({ items });
});

module.exports = { status, start, callback, pages, choose, accounts, disconnect, jobs, retry, markPosted, publishNow, mediaUpload, uploadMedia };
