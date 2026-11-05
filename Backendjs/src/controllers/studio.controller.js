/* Social studio: one call returns everything the page needs for the brands
   the caller can see — channels (with follower numbers), publishing jobs
   (with likes / comments read back from Instagram and Facebook) and the
   posts behind them. The page filters by the selected brand itself.

   Numbers from Meta are cached in the database: profiles for an hour, post
   metrics for an hour. The page always answers straight from those saved
   numbers; stale ones are refreshed in the background (one refresh at a
   time per process), on page views and hourly (server.js + /api/cron/tick). */

const { Op } = require("sequelize");
const { sequelize, SocialAccount, SocialPublishJob, SocialPost, SocialClient, SocialStat } = require("../models");
const { asyncHandler } = require("../utils/crud");
const meta = require("../utils/meta");
const auto = require("../utils/autoPublish");

const HOUR = 3600 * 1000;
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));
const asObj = (v) => (v && typeof v === "object" ? v : (() => { try { return JSON.parse(v || "{}"); } catch { return {}; } })());
const todayIst = () => new Date(Date.now() + 5.5 * HOUR).toISOString().slice(0, 10);

/* Run async jobs a few at a time. */
async function pool(items, n, fn) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) { const it = queue.shift(); try { await fn(it); } catch { /* one failure doesn't stop the rest */ } }
  }));
}

async function refreshProfiles(accounts) {
  const stale = accounts.filter((a) => a.status === "connected" && (!a.statsAt || Date.now() - new Date(a.statsAt).getTime() > HOUR));
  if (!meta.configured()) return;
  await pool(stale, 4, async (a) => {
    const stats = await meta.fetchProfile(a);
    if (!Object.keys(stats).length) return;
    await a.update({ stats, statsAt: new Date() });
    const day = todayIst();
    for (const platform of Object.keys(stats)) {
      const followers = stats[platform]?.followers;
      if (followers == null) continue;
      const [row, made] = await SocialStat.findOrCreate({ where: { client: a.client, platform, day }, defaults: { client: a.client, platform, day, followers } });
      if (!made && row.followers !== followers) await row.update({ followers });
    }
  });
}

async function refreshMetrics(jobs, accounts, max = 30) {
  if (!meta.configured()) return;
  const accBy = new Map(accounts.map((a) => [a.client, a]));
  const since = Date.now() - 45 * 24 * HOUR;
  const stale = jobs
    .filter((j) => j.status === "published" && j.remoteId && j.publishedAt && new Date(j.publishedAt).getTime() > since
      && (!j.metricsAt || Date.now() - new Date(j.metricsAt).getTime() > HOUR) && accBy.get(j.client)?.status === "connected")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, max);
  await pool(stale, 4, async (j) => {
    const metrics = await meta.fetchPostMetrics(accBy.get(j.client), j.platform, j.remoteId);
    // A denied or failed read returns no data; retain the last successful snapshot.
    if (metrics && Object.keys(metrics).length) await j.update({ metrics, metricsAt: new Date() });
  });
}

/* Background refresh of every brand's numbers. Only one runs at a time;
   page views start one at most once a minute (items that are still fresh are
   skipped anyway, so a run with nothing stale costs two DB reads). */
const MIN_GAP = 60 * 1000;
const RUN_CAP = 3 * 60 * 1000; // a run never holds the guard longer than this
let refreshing = null, lastStart = 0, lastDone = null;

function refreshAllStudio({ force = false } = {}) {
  if (refreshing) return refreshing;
  if (!meta.configured()) return Promise.resolve();
  if (!force && Date.now() - lastStart < MIN_GAP) return Promise.resolve();
  lastStart = Date.now();
  const work = (async () => {
    const accounts = await SocialAccount.findAll({ where: { status: "connected" } });
    if (!accounts.length) return;
    const since = new Date(Date.now() - 45 * 24 * HOUR);
    const jobs = await SocialPublishJob.findAll({
      where: { client: { [Op.in]: accounts.map((a) => a.client) }, status: "published", publishedAt: { [Op.gte]: since } },
      order: [["publishedAt", "DESC"]], limit: 1500,
    });
    await Promise.all([refreshProfiles(accounts), refreshMetrics(jobs, accounts, 60)]);
  })().catch((e) => console.warn("studio refresh:", e.message));
  refreshing = Promise.race([work, new Promise((r) => setTimeout(r, RUN_CAP).unref())])
    .finally(() => { refreshing = null; lastDone = new Date(); });
  return refreshing;
}

const latest = (dates) => dates.filter(Boolean).map((d) => new Date(d).getTime()).reduce((a, b) => Math.max(a, b), 0) || null;

const overview = asyncHandler(async (req, res) => {
  const scope = req.socialScope; // null = every brand
  const brands = scope ? [...scope] : (await SocialClient.findAll({ order: [["position", "ASC"], ["name", "ASC"]] })).map((c) => c.name);
  const inBrands = { client: { [Op.in]: brands } };
  const accounts = brands.length ? await SocialAccount.findAll({ where: inBrands }) : [];
  const since = new Date(Date.now() - 70 * 24 * HOUR);
  const jobs = brands.length ? await SocialPublishJob.findAll({
    where: { ...inBrands, status: { [Op.ne]: "cancelled" }, [Op.or]: [{ runAt: { [Op.gte]: since } }, { publishedAt: { [Op.gte]: since } }, { status: { [Op.in]: ["scheduled", "failed", "check", "missed", "publishing"] } }] },
    order: [["runAt", "ASC"]], limit: 1500,
  }) : [];

  // Answer from the saved numbers; fetch fresh ones from Meta in the background.
  refreshAllStudio();
  const savedAt = latest([...accounts.map((a) => a.statsAt), ...jobs.map((j) => j.metricsAt)]);

  const ids = [...new Set(jobs.map((j) => j.postId))];
  const posts = ids.length ? await SocialPost.findAll({ where: { id: ids }, attributes: ["id", "client", "theme", "format", "status", "postDate", "postTime", "media", "assigneeId"] }) : [];
  const weekAgo = new Date(Date.now() + 5.5 * HOUR - 7 * 24 * HOUR).toISOString().slice(0, 10);
  const stats = brands.length ? await SocialStat.findAll({ where: { ...inBrands, day: { [Op.gte]: new Date(Date.now() - 40 * 24 * HOUR).toISOString().slice(0, 10) } }, order: [["day", "ASC"]] }) : [];

  res.json({
    brands,
    accounts: accounts.map((a) => ({
      client: a.client, pageId: a.pageId, pageName: a.pageName, igUsername: a.igUsername, igAvatar: a.igAvatar,
      status: a.status, lastError: a.status === "connected" ? null : a.lastError, paused: asArr(a.paused), stats: asObj(a.stats), connectedAt: a.createdAt,
    })),
    // followers per day per channel (for "new followers"); the page compares today with ~7 days ago
    followers: stats.map((s) => ({ client: s.client, platform: s.platform, day: s.day, followers: s.followers })),
    weekAgo,
    jobs: jobs.map((j) => ({
      id: j.id, postId: j.postId, client: j.client, platform: j.platform, status: j.status, runAt: j.runAt, publishedAt: j.publishedAt,
      url: j.url, error: j.status === "published" ? null : j.error, metrics: asObj(j.metrics),
    })),
    posts: posts.map((p) => ({ id: p.id, client: p.client, theme: p.theme, format: p.format, status: p.status, postDate: p.postDate, postTime: p.postTime, assigneeId: p.assigneeId, picture: asArr(p.media)[0] || null })),
    metaConfigured: meta.configured(),
    // When Meta numbers were last saved for these brands (ISO) and whether a
    // background refresh is running now — "Updated 12 min ago · refreshing…".
    refreshedAt: savedAt ? new Date(savedAt).toISOString() : null,
    refreshing: !!refreshing,
    lastRefreshRun: lastDone ? lastDone.toISOString() : null,
  });
});

/* Pause or resume one platform of a brand. Paused platforms get no new
   publishing jobs; open ones are cancelled and come back on resume. */
const pause = asyncHandler(async (req, res) => {
  const platform = String(req.body?.platform || "");
  if (!["instagram", "facebook"].includes(platform)) return res.status(400).json({ message: "Pick Instagram or Facebook." });
  if (typeof req.body?.paused !== "boolean") return res.status(400).json({ message: "Choose whether publishing is paused." });
  const saved = await sequelize.transaction(async (transaction) => {
    const acc = await SocialAccount.findOne({ where: { client: req.params.client }, transaction, lock: transaction.LOCK.UPDATE });
    if (!acc) return null;
    const set = new Set(asArr(acc.paused));
    if (req.body.paused) set.add(platform); else set.delete(platform);
    await acc.update({ paused: [...set] }, { transaction });
    return { client: acc.client, paused: [...set] };
  });
  if (!saved) return res.status(404).json({ message: "This brand isn't connected." });
  await auto.syncBrand(saved.client);
  res.json({ ok: true, paused: saved.paused });
});

/* Profile panel: read a channel's profile; edit a Facebook Page's details. */
const profile = asyncHandler(async (req, res) => {
  const acc = await SocialAccount.findOne({ where: { client: req.params.client } });
  if (!acc || (req.socialScope && !req.socialScope.has(acc.client))) return res.status(404).json({ message: "This brand isn't connected." });
  try { res.json(await meta.profileDetails(acc, req.query.platform === "instagram" ? "instagram" : "facebook")); }
  catch (e) { res.status(502).json({ message: e.message }); }
});
const updateProfile = asyncHandler(async (req, res) => {
  const acc = await SocialAccount.findOne({ where: { client: req.params.client } });
  if (!acc) return res.status(404).json({ message: "This brand isn't connected." });
  const b = req.body || {};
  if (b.website && !/^https?:\/\//i.test(b.website)) return res.status(400).json({ message: "The website must start with https://" });
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ message: "That email doesn't look right." });
  try {
    await meta.updatePage(acc, b);
    await acc.update({ statsAt: null }); // refresh cached numbers next time
    res.json(await meta.profileDetails(acc, "facebook"));
  } catch (e) {
    const perm = [200, 10, 3].includes(Number(e.meta?.code)) || /permission/i.test(e.message);
    res.status(perm ? 403 : 502).json({ message: perm
      ? "Meta denied this Page update. Check Readiness & actions for granted permissions and verify the current endpoint and field requirements in the Meta dashboard; reconnect after changing permissions."
      : e.message });
  }
});

const capabilities = asyncHandler(async (req, res) => {
  const acc = await SocialAccount.findOne({ where: { client: req.params.client } });
  if (!acc || (req.socialScope && !req.socialScope.has(acc.client))) return res.status(404).json({ message: "This brand isn't connected." });
  const platform = req.query.platform === "instagram" ? "instagram" : "facebook";
  res.json(await require("../utils/metaCapabilities").checkCapabilities(acc, platform));
});

module.exports = { overview, pause, profile, updateProfile, capabilities, refreshAllStudio };
