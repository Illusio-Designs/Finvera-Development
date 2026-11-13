// Existing content is never guessed or removed. Only definitely unpublished,
// invalid scheduled work is returned to review, under the publisher's locks.
const { sequelize, SocialPost, SocialPublishJob, SocialAccount } = require("../models");
const { preflight } = require("./socialPreflight");
const jobMachine = require("./publishJobMachine");
const reviewMachine = require("./socialReviewMachine");
async function reconcile({ postIds } = {}) {
  const candidates = await SocialPost.findAll({ where: { status: "ready", ...(postIds ? { id: postIds } : {}) }, attributes: ["id"], raw: true });
  let paused = 0;
  for (const row of candidates) await sequelize.transaction(async (transaction) => {
    const post = await SocialPost.findByPk(row.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!post || post.status !== "ready") return;
    const jobs = await SocialPublishJob.findAll({ where: { postId: post.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (jobs.some((job) => {
      let cp = job.checkpoint || {}; if (typeof cp === "string") { try { cp = JSON.parse(cp); } catch { cp = {}; } }
      return ["publishing", "check"].includes(job.status) || (job.status !== "published" && cp.publishCalled);
    })) return;
    const account = await SocialAccount.findOne({ where: { client: post.client }, transaction });
    const platforms = require("./autoPublish").targetsFor(post, account).filter((platform) => !jobs.some((job) => job.platform === platform && job.status === "published"));
    const issues = preflight(post, platforms);
    if (!issues.length) return;
    const before = post.toJSON();
    const { status, assigneeId } = reviewMachine.revokeApproval(post);
    await post.update({ status, assigneeId }, { transaction });
    for (const job of jobs) if (["scheduled", "missed", "failed", "cancelled"].includes(job.status)) await job.update({ status: jobMachine.transition(job.status, "CANCEL"), error: `Needs review: ${issues.map((issue) => issue.message).join(" ")}`, checkpoint: {} }, { transaction });
    const { SocialPostEvent } = require("../models");
    await SocialPostEvent.create(require("../controllers/social.controller").eventOf(post, { from: before.status, fromAssigneeId: before.assigneeId }), { transaction });
    paused++;
  });
  if (paused) require("../controllers/kpi.controller").bumpKpiCache();
  return { checked: candidates.length, paused };
}
module.exports = { reconcile };
