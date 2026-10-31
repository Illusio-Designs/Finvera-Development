/* Auto-publishing for the content calendar.

   When a post is in Ready to post, it gets one job per platform its brand is
   connected to (Instagram / Facebook, or the ones ticked on the post), due at
   the post's go-live date and time (India time; 10:00 AM when no time is set).
   Changing the date moves the job; leaving Ready cancels it. At the due time
   the runner publishes with the post's media and caption (+ keywords as
   hashtags), saves the live links, and moves the post to Posted once every
   platform is out.

   Safety (design learned from SocialSync, own implementation):
     • a lease per job so two app processes never publish the same job
     • temporary errors retry with growing waits (up to 5 tries)
     • a failure after the "publish" call is unclear → status "check": look on
       the platform before retrying, never auto-retried (no duplicate posts)
     • a platform that already went out is never sent again
     • a post that becomes Ready more than 6 hours after its go-live time is
       not posted late on its own ("missed" — use Publish now) */

const crypto = require("crypto");
const { Op } = require("sequelize");
const { SocialPost, SocialAccount, SocialPublishJob, User } = require("../models");
const meta = require("./meta");
const { notifyUsers } = require("./notify");
const { rolesOf } = require("./permissions");

const PLATFORMS = ["instagram", "facebook"];
const NAMES = { instagram: "Instagram", facebook: "Facebook" };
const LATE_LIMIT_MS = 6 * 3600 * 1000;
const LEASE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};
const asObj = (v) => (v && typeof v === "object" ? v : (() => { try { return JSON.parse(v || "{}"); } catch { return {}; } })());

/* Go-live as a Date: the post's date + time in India time. */
function goLiveAt(p) {
  const d = p.postDate ? String(p.postDate).slice(0, 10) : null;
  if (!d) return null;
  const t = /^\d{1,2}:\d{2}/.test(String(p.postTime || "")) ? String(p.postTime).slice(0, 5).padStart(5, "0") : "10:00";
  return new Date(`${d}T${t}:00+05:30`);
}

/* Caption + hashtags: the post's caption (which may already hold hashtags),
   then its keywords turned into hashtags, without duplicates, at most 30
   hashtags in total, and within Instagram's 2,200 characters. */
function composeCaption(p) {
  const caption = String(p.caption || "").trim();
  const have = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.toLowerCase()));
  const extra = [];
  if (p.keywordHashtags !== false && p.keywordHashtags !== 0) {
    for (const raw of String(p.keywords || "").split(/[,\n;|]+/)) {
      const tag = "#" + raw.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]+/gu, "");
      if (tag.length < 2 || have.has(tag.toLowerCase())) continue;
      have.add(tag.toLowerCase()); extra.push(tag);
    }
  }
  const room = Math.max(0, 30 - ((caption.match(/#[\p{L}\p{N}_]+/gu) || []).length));
  const tags = extra.slice(0, room);
  return [caption, tags.join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
}

/* Platforms this post goes to: the brand's connected ones, narrowed by the
   post's own ticks if it has any. */
function targetsFor(p, acc) {
  if (!acc || acc.status !== "connected") return [];
  const connected = ["facebook", ...(acc.igUserId ? ["instagram"] : [])];
  const chosen = p.publishTo == null ? null : asArr(p.publishTo);
  return PLATFORMS.filter((pl) => connected.includes(pl) && (!chosen || chosen.includes(pl)));
}

/* Bring a post's jobs in line with its current state. Safe to call often. */
async function syncJobs(post) {
  try {
    const p = post.id ? post : await SocialPost.findByPk(post);
    if (!p) return;
    const jobs = await SocialPublishJob.findAll({ where: { postId: p.id } });
    const open = (j) => ["scheduled", "missed"].includes(j.status);
    if (p.status !== "ready") {
      for (const j of jobs.filter(open)) await j.update({ status: "cancelled" });
      return;
    }
    const acc = await SocialAccount.findOne({ where: { client: p.client } });
    const targets = targetsFor(p, acc);
    const runAt = goLiveAt(p);
    for (const j of jobs.filter((j) => open(j) && !targets.includes(j.platform))) await j.update({ status: "cancelled" });
    if (!runAt) return;
    const late = runAt.getTime() < Date.now() - LATE_LIMIT_MS;
    for (const pl of targets) {
      const j = jobs.find((x) => x.platform === pl);
      if (!j) {
        await SocialPublishJob.create({ postId: p.id, client: p.client, platform: pl, status: late ? "missed" : "scheduled", runAt, checkpoint: {} });
      } else if (["cancelled", "missed", "scheduled"].includes(j.status)) {
        const status = late ? "missed" : "scheduled";
        if (j.status !== status || +new Date(j.runAt) !== +runAt) await j.update({ status, runAt, error: null });
      }
    }
  } catch (e) { console.warn("autoPublish sync:", e.message); }
}

const isRetryable = (e) => !!(e.meta?.is_transient || [1, 2, 4, 17, 32, 341, 613, -1, -2].includes(Number(e.meta?.code))
  || /timeout|ECONN|socket|did not answer|EAI_AGAIN|ENOTFOUND/i.test(e.message || ""));

/* Problems we can spot before calling Meta, worded for the team. */
function precheck(p, platform) {
  const media = asArr(p.media).filter((m) => m && m.url);
  if (!media.length && platform === "instagram") return "Add the image or video to the post — Instagram needs media.";
  if (platform === "instagram") {
    const bad = media.filter((m) => !meta.isVideo(m) && !/\.(jpe?g)(\?|$)/i.test(m.url) && /\.(png|webp|gif|avif|svg)(\?|$)/i.test(m.url));
    if (bad.length) return `Instagram only accepts JPG images (${bad.length} of ${media.length} ${bad.length === 1 ? "is" : "are"} not JPG).`;
    if (/reel/i.test(p.format || "") && !media.some(meta.isVideo)) return "This is a Reel — add the video.";
    if (media.length > 10) return "Instagram carousels take at most 10 items.";
  }
  return null;
}

async function teamFor(p) {
  const users = await User.findAll({ where: { active: true } });
  const admins = users.filter((u) => rolesOf(u).includes("admin")).map((u) => u.id);
  return [...new Set([p.assigneeId, ...admins].filter(Boolean))];
}

/* Every platform for this post is out → Posted, with the live links. */
async function afterPublished(p) {
  const jobs = (await SocialPublishJob.findAll({ where: { postId: p.id } })).filter((j) => j.status !== "cancelled");
  if (!jobs.length || jobs.some((j) => j.status !== "published")) return;
  const links = jobs.map((j) => j.url).filter(Boolean);
  const channels = [...new Set([...String(p.channels || "").split(/\s*\n\s*|\s+(?=https?:)/).filter(Boolean), ...links])].join("\n");
  const before = { status: p.status, assigneeId: p.assigneeId };
  await p.update({ status: "posted", channels });
  try {
    const social = require("../controllers/social.controller");
    await social.recordEvents([social.eventOf(p, { from: before.status, fromAssigneeId: before.assigneeId })]);
  } catch (e) { console.warn("autoPublish history:", e.message); }
  await notifyUsers(await teamFor(p), {
    type: "done", title: `Published: ${p.theme}`,
    body: `${p.client} · ${jobs.map((j) => NAMES[j.platform]).join(", ")}`, link: "/dashboard/social", meta: { socialPostId: p.id },
  });
}

async function runJob(job) {
  const token = crypto.randomBytes(12).toString("hex");
  const [claimed] = await SocialPublishJob.update(
    { status: "publishing", leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS), attempts: (job.attempts || 0) + 1 },
    { where: { id: job.id, status: "scheduled" } },
  );
  if (!claimed) return;
  const j = await SocialPublishJob.findByPk(job.id);
  const p = await SocialPost.findByPk(j.postId);
  const cp = asObj(j.checkpoint);
  if (!p || (p.status !== "ready" && !cp.manual)) { await j.update({ status: "cancelled", leaseToken: null }); return; }
  const finish = (fields) => SocialPublishJob.update({ ...fields, leaseToken: null, leaseUntil: null }, { where: { id: j.id, leaseToken: token } });
  const problem = precheck(p, j.platform);
  const acc = await SocialAccount.findOne({ where: { client: p.client } });
  const fail = async (status, error) => {
    await finish({ status, error });
    await notifyUsers(await teamFor(p), {
      type: "due", title: status === "check" ? `Check ${NAMES[j.platform]}: ${p.theme}` : `Auto-post failed: ${p.theme}`,
      body: `${p.client} · ${NAMES[j.platform]}: ${error}`, link: "/dashboard/social", meta: { socialPostId: p.id },
    });
  };
  if (problem) return fail("failed", problem);
  if (!acc || acc.status !== "connected") return fail("failed", `${p.client} isn't connected to ${NAMES[j.platform]} any more — reconnect it in Team & uploads.`);
  const save = (c) => SocialPublishJob.update({ checkpoint: c, leaseUntil: new Date(Date.now() + LEASE_MS) }, { where: { id: j.id, leaseToken: token } });
  try {
    const media = asArr(p.media).filter((m) => m && m.url);
    const caption = composeCaption(p);
    const res = j.platform === "instagram"
      ? await meta.publishInstagram(acc, media, caption, cp, save)
      : await meta.publishFacebook(acc, media, caption, cp, save);
    await finish({ status: "published", remoteId: res.id, url: res.url, error: null, publishedAt: new Date() });
    await afterPublished(await SocialPost.findByPk(p.id));
  } catch (e) {
    const msg = e.message || "Meta returned an error.";
    if (/token|session|OAuthException|permission/i.test(`${e.meta?.type || ""} ${msg}`) && [190, 102, 10, 200].includes(Number(e.meta?.code))) {
      await acc.update({ status: "reconnect", lastError: msg }).catch(() => {});
    }
    if (cp.publishCalled) return fail("check", `No clear answer from ${NAMES[j.platform]} after publishing started (${msg}). Check the account before retrying.`);
    if (isRetryable(e) && j.attempts < MAX_ATTEMPTS) {
      await finish({ status: "scheduled", error: msg, runAt: new Date(Date.now() + Math.min(15 * 60000, 30000 * 2 ** j.attempts)) });
      return;
    }
    return fail("failed", msg);
  }
}

/* Jobs whose lease ran out while publishing (the process died mid-way). */
async function recoverStale() {
  const stale = await SocialPublishJob.findAll({ where: { status: "publishing", leaseUntil: { [Op.lt]: new Date() } } });
  for (const j of stale) {
    const cp = asObj(j.checkpoint);
    if (cp.publishCalled) await j.update({ status: "check", error: "Publishing was interrupted after it started. Check the account before retrying.", leaseToken: null });
    else await j.update({ status: "scheduled", runAt: new Date(), leaseToken: null });
  }
}

let running = false, lastRun = 0;
async function runDue({ force = false } = {}) {
  if (running || (!force && Date.now() - lastRun < 20000)) return;
  running = true; lastRun = Date.now();
  try {
    if (!meta.configured()) return;
    await recoverStale();
    const due = await SocialPublishJob.findAll({ where: { status: "scheduled", runAt: { [Op.lte]: new Date() } }, order: [["runAt", "ASC"]], limit: 10 });
    for (const j of due) await runJob(j);
  } catch (e) { console.warn("autoPublish run:", e.message); }
  finally { running = false; }
}

/* Every ready post of a brand (after connecting or disconnecting it). */
async function syncBrand(client) {
  const posts = await SocialPost.findAll({ where: { client, status: "ready" } });
  for (const p of posts) await syncJobs(p);
}

module.exports = { syncJobs, syncBrand, runDue, runJob, composeCaption, goLiveAt, targetsFor, afterPublished, PLATFORMS };
