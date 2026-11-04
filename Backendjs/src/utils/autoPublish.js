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
const { sequelize, SocialPost, SocialAccount, SocialPublishJob, User } = require("../models");
const meta = require("./meta");
const { contentHash } = require("./socialSafety");
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
  const paused = asArr(acc.paused);
  const connected = ["facebook", ...(acc.igUserId ? ["instagram"] : [])].filter((pl) => !paused.includes(pl));
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
      const prev = j ? j.status : null;
      if (!j) {
        await SocialPublishJob.create({ postId: p.id, client: p.client, platform: pl, status: late ? "missed" : "scheduled", runAt, checkpoint: { approvedHash: contentHash(p) } });
      } else if (["cancelled", "missed", "scheduled"].includes(j.status)) {
        const status = late ? "missed" : "scheduled";
        if (j.status !== status || +new Date(j.runAt) !== +runAt) await j.update({ status, runAt, error: null, checkpoint: { ...asObj(j.checkpoint), approvedHash: contentHash(p) } });
      }
      if (late && (!j || ["cancelled", "scheduled"].includes(prev))) emailPublishProblem(p, { title: `Missed go-live: ${p.theme}`, detail: `${NAMES[pl]}: the post became Ready more than 6 hours after its go-live time, so it was not posted automatically. Use Publish now if it should still go out.` });
    }
  } catch (e) { console.warn("autoPublish sync:", e.message); }
}

const isRetryable = (e) => !!(e.meta?.is_transient || [1, 2, 4, 17, 32, 341, 613, -1, -2].includes(Number(e.meta?.code))
  || /timeout|ECONN|socket|did not answer|EAI_AGAIN|ENOTFOUND/i.test(e.message || ""));

/* Problems we can spot before calling Meta, worded for the team. */
function precheck(p, platform) {
  const media = asArr(p.media).filter((m) => m && m.url);
  if (platform === "facebook" && media.some(meta.isVideo) && media.length > 1) return "Facebook video posts must contain one video. Split mixed or multiple-video artwork into separate posts.";
  if (!media.length && platform === "instagram") return "Add the image or video to the post — Instagram needs media.";
  if (platform === "instagram") {
    const bad = media.filter((m) => !meta.isVideo(m) && !/\.(jpe?g)(\?|$)/i.test(m.url) && /\.(png|webp|gif|avif|svg)(\?|$)/i.test(m.url));
    if (bad.length) return `Instagram only accepts JPG images (${bad.length} of ${media.length} ${bad.length === 1 ? "is" : "are"} not JPG).`;
    if (/reel/i.test(p.format || "") && !media.some(meta.isVideo)) return "This is a Reel — add the video.";
    if (media.length > 10) return "Instagram carousels take at most 10 items.";
  }
  return null;
}

/* Email admins + the social team about a publishing problem — at most one
   email per brand account per 6 hours (the in-app alerts are unchanged). */
function emailPublishProblem(p, { title, detail }) {
  (async () => {
    const { claimOnce, usersWithRoles, emailUsers, layout, esc, dashboardUrl } = require("./emails");
    if (!require("./mailer").configured() || !(await claimOnce(`publish:${p.client}`, 6 * 3600000))) return;
    emailUsers(await usersWithRoles(["social"]), "publishing", {
      subject: `Finvera: ${title}`,
      html: layout({
        title,
        body: `<p><b>${esc(p.client)}</b> · ${esc(p.theme || "")}</p><p>${esc(detail)}</p><p style="color:#8a93aa">Further problems with ${esc(p.client)} in the next 6 hours show up in the dashboard only.</p>`,
        button: { label: "Open the content calendar", url: dashboardUrl("/dashboard/social") },
      }),
      text: `${title}\n${p.client} · ${p.theme || ""}\n${detail}`,
    });
  })().catch((e) => console.warn("publish email:", e.message));
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
  // Retain uploaded assets so the published version remains reviewable.
  try {
    const social = require("../controllers/social.controller");
    await social.recordEvents([social.eventOf(p, { from: before.status, fromAssigneeId: before.assigneeId })]);
  } catch (e) { console.warn("autoPublish history:", e.message); }
  try { require("../controllers/kpi.controller").bumpKpiCache(); } catch { /* cache only */ } // new stage → fresh KPIs
  await notifyUsers(await teamFor(p), {
    type: "done", title: `Published: ${p.theme}`,
    body: `${p.client} · ${jobs.map((j) => NAMES[j.platform]).join(", ")}`, link: "/dashboard/social", meta: { socialPostId: p.id },
  });
}

async function runJob(job) {
  const token = crypto.randomBytes(12).toString("hex");
  const claimed = await sequelize.transaction(async (transaction) => {
    const post = await SocialPost.findByPk(job.postId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!post) return false;
    const current = await SocialPublishJob.findByPk(job.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || current.status !== "scheduled") return false;
    const checkpoint = asObj(current.checkpoint);
    if (post.status !== "ready" || (checkpoint.approvedHash && checkpoint.approvedHash !== contentHash(post))) {
      await current.update({ status: "cancelled", error: "Content changed or approval was removed. Review the current post before scheduling." }, { transaction });
      return false;
    }
    await current.update({ status: "publishing", leaseToken: token, leaseUntil: new Date(Date.now() + LEASE_MS), attempts: (current.attempts || 0) + 1 }, { transaction });
    return true;
  });
  if (!claimed) return;
  const j = await SocialPublishJob.findByPk(job.id);
  const p = await SocialPost.findByPk(j.postId);
  const cp = asObj(j.checkpoint);
  const finish = (fields) => SocialPublishJob.update({ ...fields, leaseToken: null, leaseUntil: null }, { where: { id: j.id, leaseToken: token } });
  const problem = precheck(p, j.platform);
  const acc = await SocialAccount.findOne({ where: { client: p.client } });
  const fail = async (status, error) => {
    await finish({ status, error });
    await notifyUsers(await teamFor(p), {
      type: "due", title: status === "check" ? `Check ${NAMES[j.platform]}: ${p.theme}` : `Auto-post failed: ${p.theme}`,
      body: `${p.client} · ${NAMES[j.platform]}: ${error}`, link: "/dashboard/social", meta: { socialPostId: p.id },
    });
    emailPublishProblem(p, { title: status === "check" ? `Check ${NAMES[j.platform]}: ${p.theme}` : `Auto-post failed: ${p.theme}`, detail: `${NAMES[j.platform]}: ${error}` });
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
    try { await afterPublished(await SocialPost.findByPk(p.id)); } catch (e) { console.warn("Post-publish settlement:", e.message); }
  } catch (e) {
    const msg = e.message || "Meta returned an error.";
    if (/token|session|OAuthException|permission/i.test(`${e.meta?.type || ""} ${msg}`) && [190, 102, 10, 200].includes(Number(e.meta?.code))) {
      const was = acc.status;
      await acc.update({ status: "reconnect", lastError: msg }).catch(() => {});
      if (was === "connected") require("./metaHealth").alertReconnect(acc, msg).catch(() => {});
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
