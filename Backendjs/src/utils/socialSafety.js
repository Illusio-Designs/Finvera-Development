const crypto = require("crypto");
const { rolesOf } = require("./permissions");
const PAYLOAD = ["client", "format", "caption", "media", "tags", "keywords", "keywordHashtags", "publishTo", "postDate", "postTime"];
const asJSON = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function payload(post) {
  return Object.fromEntries(PAYLOAD.map((k) => {
    let v = post[k];
    if (["media", "publishTo"].includes(k)) v = asJSON(v);
    if (k === "media") v = v || [];
    else if (k === "keywordHashtags") v = v !== false && v !== 0;
    else if (v == null || v === "") v = null;
    return [k, stable(v)];
  }));
}
const contentHash = (post) => crypto.createHash("sha256").update(JSON.stringify(payload(post))).digest("hex");
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const canApprove = (post, user) => rolesOf(user).includes("admin") || (rolesOf(user).includes("social") && Number(post.assigneeId) === Number(user.id));
function liveLink(url, platform) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    if (platform === "instagram") return /(^|\.)instagram\.com$/i.test(u.hostname) && /^\/(p|reel|tv|stories)\/[^/]+/.test(u.pathname);
    return /(^|\.)(facebook\.com|fb\.watch)$/i.test(u.hostname) && u.pathname !== "/";
  } catch { return false; }
}

function prepareUpdate(post, incoming, user, jobs = [], reviewPlatforms = null) {
  const data = { ...incoming };
  const expected = data._expectedUpdatedAt;
  delete data._expectedUpdatedAt;
  const manual = data._manualPosted === true;
  delete data._manualPosted;
  delete data.id;
  if (expected && +new Date(expected) !== +new Date(post.updatedAt)) fail(409, "This post changed since you opened it. Reload before saving.");
  if (data.status && !["planned", "client", "production", "approval", "ready", "posted"].includes(data.status)) fail(400, "Choose a valid workflow stage.");
  if (post.status === "posted" && data.status && data.status !== "posted") fail(409, "Create a new post for revised work after publication.");
  if (data.media != null) {
    if (!Array.isArray(data.media) || data.media.length > 10) fail(400, "Use up to 10 artwork files per post.");
    for (const media of data.media) {
      let url; try { url = new URL(media?.url); } catch { fail(400, "Use a valid artwork URL."); }
      if (!["http:", "https:"].includes(url.protocol)) fail(400, "Artwork URLs must use HTTP or HTTPS.");
      if (media.coverUrl != null) { let cover; try { cover = new URL(media.coverUrl); } catch { fail(400, "Use a valid Reel cover URL."); } if (cover.protocol !== "https:" || cover.username || cover.password) fail(400, "Reel covers need a public HTTPS URL."); }
      try { require("./instagramTags").imageTags(media); } catch (error) { fail(400, error.message); }
    }
  }
  if (data.tags != null) { try { require("./instagramTags").profileNames(data.tags); } catch (error) { fail(400, error.message); } }
  const changed = contentHash(post) !== contentHash({ ...post, ...data });
  if (jobs.some((j) => j.status === "publishing")) fail(409, "Publishing is in progress. Wait for the platform result before changing this post.");
  // Instagram tags are never sent to Facebook. They may be corrected after
  // Facebook succeeds, provided Instagram has definitely not published.
  const withoutInstagramTags = (value) => ({ ...value, tags: null, media: require("./socialPreflight").array(value.media).map((item) => { if (!item || typeof item !== "object") return item; const { userTags, ...rest } = item; return rest; }) });
  const instagramJobs = jobs.filter((j) => j.platform === "instagram");
  const safeTagCorrection = post.status !== "posted" && jobs.some((j) => j.platform === "facebook" && j.status === "published") &&
    jobs.filter((j) => j.status === "published").every((j) => j.platform === "facebook") &&
    !jobs.some((j) => j.status === "check" || asJSON(j.checkpoint)?.publishCalled && j.status !== "published") &&
    instagramJobs.length > 0 && instagramJobs.every((j) => ["failed", "cancelled", "missed", "scheduled"].includes(j.status)) &&
    contentHash(withoutInstagramTags(post)) === contentHash(withoutInstagramTags({ ...post, ...data }));
  if (changed && (post.status === "posted" || jobs.some((j) => ["published", "check"].includes(j.status) || asJSON(j.checkpoint)?.publishCalled)) && !safeTagCorrection) fail(409, "This post may already be live on a platform. After Facebook publishes, only Instagram profile tags can be corrected here; other content changes require a revised post.");
  if (data.status && data.status !== post.status && !["ready", "posted"].includes(data.status)) {
    const allowed = { planned: ["client", "production"], client: ["planned", "production"], production: ["planned", "client", "approval"], approval: ["production"], ready: ["approval"], posted: [] };
    if (!(allowed[post.status] || []).includes(data.status)) fail(409, "Use Start work, Upload, Review and Schedule in order. This stage cannot be skipped.");
    const next = { ...post, ...data };
    if (["production", "approval"].includes(data.status) && !next.assigneeId) fail(400, "Choose the person responsible before moving this work.");
    if (data.status === "approval" && !require("./socialPreflight").array(next.media).length) fail(400, "Upload the finished work before sending for review.");
  }
  if (data.status === "ready" && post.status !== "ready") {
    if (post.status !== "approval" || !canApprove(post, user)) fail(403, "Only the assigned social reviewer or an admin can approve a post in Pending approval.");
    const reviewContentChanged = contentHash({ ...post, postDate: null, postTime: null }) !== contentHash({ ...post, ...data, postDate: null, postTime: null });
    if (reviewContentChanged) fail(409, "Save content changes first, then review and approve the saved version.");
    const next = { ...post, ...data };
    const targets = reviewPlatforms || (next.publishTo == null ? ["instagram", "facebook"] : require("./socialPreflight").array(next.publishTo));
    const remaining = targets.filter((platform) => !jobs.some((job) => job.platform === platform && job.status === "published"));
    const issues = require("./socialPreflight").preflight(next, remaining);
    if (issues.length) fail(400, issues.map((issue) => issue.message).join(" "));
  }
  if (data.status === "client" && post.status !== "client" && !String(data.clientRequest || post.clientRequest || "").trim()) fail(400, "Describe what is needed from the client.");
  if (data.clientFollowUpDate && (!/^\d{4}-\d{2}-\d{2}$/.test(data.clientFollowUpDate) || !Number.isFinite(Date.parse(data.clientFollowUpDate)))) fail(400, "Choose a valid client follow-up date.");
  if (data.status === "posted" && post.status !== "posted") {
    const links = String(data.channels || "").match(/https:\/\/[^\s]+/g) || [];
    const intended = [...new Set(jobs.filter((j) => j.status !== "cancelled").map((j) => j.platform))];
    if (intended.some((platform) => !links.some((url) => liveLink(url, platform)))) fail(400, "Provide the live link for every intended platform before confirming Posted.");
    if (!manual || post.status !== "ready" || !canApprove(post, user) || !links.length || links.some((u) => !liveLink(u, "instagram") && !liveLink(u, "facebook"))) fail(400, "Confirm the live Instagram/Facebook post links from Ready to post, or use a publishing job’s verification action.");
  }
  if (changed && post.status === "ready") {
    data.status = "approval";
    data.step = null;
    let team = asJSON(post.team) || {};
    data.assigneeId = team.social || post.assigneeId || null;
  }
  return data;
}

module.exports = { prepareUpdate, contentHash, canApprove, liveLink };
