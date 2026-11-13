const { contentHash } = require("./socialContent");
const { transition } = require("./socialPostMachine");
const { array } = require("./socialPreflight");
const asJSON = (value) => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return value; } };

// Publication is an orthogonal state that overrides the ordinary review stage.
function stateOf(post, jobs = []) {
  if (jobs.some((job) => job.status === "publishing")) return "publishing";
  if (post.status === "posted" || jobs.some((job) => ["published", "check"].includes(job.status) || asJSON(job.checkpoint)?.publishCalled)) return "live";
  return post.status === "ready" ? "approved" : post.status === "approval" ? "review" : "draft";
}
function canCorrectInstagramTags(post, incoming, jobs) {
  // Tags never reach Facebook, so a definitely unpublished Instagram result
  // can be corrected even after Facebook has succeeded. Nothing else changes.
  const withoutTags = (value) => ({ ...value, tags: null, media: array(value.media).map((item) => {
    if (!item || typeof item !== "object") return item;
    const { userTags, ...rest } = item; return rest;
  }) });
  const instagram = jobs.filter((job) => job.platform === "instagram");
  return post.status !== "posted" && jobs.some((job) => job.platform === "facebook" && job.status === "published") &&
    jobs.filter((job) => job.status === "published").every((job) => job.platform === "facebook") &&
    !jobs.some((job) => job.status === "check" || asJSON(job.checkpoint)?.publishCalled && job.status !== "published") &&
    instagram.length > 0 && instagram.every((job) => ["failed", "cancelled", "missed", "scheduled"].includes(job.status)) &&
    contentHash(withoutTags(post)) === contentHash(withoutTags({ ...post, ...incoming }));
}
function revokeApproval(post) {
  const status = transition(post.status, "REVOKE_APPROVAL");
  if (!status) throw Object.assign(new Error("Only approved work can return to review."), { status: 409 });
  return { status, step: null, assigneeId: (asJSON(post.team) || {}).social || post.assigneeId || null };
}
module.exports = { stateOf, canCorrectInstagramTags, revokeApproval };
