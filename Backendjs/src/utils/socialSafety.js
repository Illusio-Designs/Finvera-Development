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
    if (platform === "instagram") return /(^|\.)instagram\.com$/i.test(u.hostname) && /^\/(p|reel|tv)\/[^/]+/.test(u.pathname);
    return /(^|\.)(facebook\.com|fb\.watch)$/i.test(u.hostname) && u.pathname !== "/";
  } catch { return false; }
}

function prepareUpdate(post, incoming, user, jobs = []) {
  const data = { ...incoming };
  const expected = data._expectedUpdatedAt;
  delete data._expectedUpdatedAt;
  const manual = data._manualPosted === true;
  delete data._manualPosted;
  delete data.id;
  if (expected && +new Date(expected) !== +new Date(post.updatedAt)) fail(409, "This post changed since you opened it. Reload before saving.");
  if (data.status && !["planned", "client", "production", "approval", "ready", "posted"].includes(data.status)) fail(400, "Choose a valid workflow stage.");
  if (post.status === "posted" && data.status && data.status !== "posted") fail(409, "Create a new post for revised work after publication.");
  const changed = contentHash(post) !== contentHash({ ...post, ...data });
  if (jobs.some((j) => j.status === "publishing")) fail(409, "Publishing is in progress. Wait for the platform result before changing this post.");
  if (changed && (post.status === "posted" || jobs.some((j) => ["published", "check"].includes(j.status)))) fail(409, "This post may already be live on a platform. Resolve its publishing result before creating a revised post.");
  if (data.status === "ready" && post.status !== "ready") {
    if (post.status !== "approval" || !canApprove(post, user)) fail(403, "Only the assigned social reviewer or an admin can approve a post in Pending approval.");
    const reviewContentChanged = contentHash({ ...post, postDate: null, postTime: null }) !== contentHash({ ...post, ...data, postDate: null, postTime: null });
    if (reviewContentChanged) fail(409, "Save content changes first, then review and approve the saved version.");
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
