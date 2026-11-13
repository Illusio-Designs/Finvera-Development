const { sequelize, SocialPost, SocialPublishJob, SocialAccount, User } = require("../models");
const { prepareUpdate, contentHash } = require("./socialSafety");
const jobMachine = require("./publishJobMachine");

async function updateRecord(req) {
  return sequelize.transaction(async (transaction) => {
    // The publisher claims work in the same post → jobs lock order.
    const item = await SocialPost.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw Object.assign(new Error("Post not found."), { status: 404 });
    if (req.socialScope && !req.socialScope.has(item.client)) throw Object.assign(new Error("Post not found."), { status: 404 });
    if (req.body.client && req.socialScope && !req.socialScope.has(req.body.client)) throw Object.assign(new Error("This brand is outside your access."), { status: 403 });
    const jobs = await SocialPublishJob.findAll({ where: { postId: item.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (req.body._importPlanningOnly && !["planned", "client"].includes(item.status)) throw Object.assign(new Error("Work started after the import preview. This row was preserved."), { status: 409 });
    const incoming = { ...req.body }; delete incoming._importPlanningOnly;
    const before = item.toJSON();
    let reviewPlatforms = null;
    if (incoming.status === "ready") {
      const account = await SocialAccount.findOne({ where: { client: item.client }, transaction });
      reviewPlatforms = require("./autoPublish").targetsFor({ ...before, ...incoming }, account);
    }
    const data = prepareUpdate(before, incoming, req.userRow || req.user, jobs, reviewPlatforms);
    if (data.assigneeId != null && Number(data.assigneeId) !== Number(before.assigneeId)) {
      const owner = await User.findByPk(data.assigneeId, { transaction });
      const needed = ["approval", "ready"].includes(data.status || before.status) ? "social" : /reel|video/i.test(data.format || before.format || "") ? "video" : "graphic";
      if (!owner?.active || !require("./permissions").rolesOf(owner).some((role) => role === needed || role === "admin")) throw Object.assign(new Error(`Choose an active ${needed === "social" ? "social reviewer" : needed === "video" ? "video editor" : "graphic designer"}.`), { status: 400 });
    }
    if (incoming.status === "ready") for (const platform of reviewPlatforms || []) {
      if (jobs.some((job) => job.platform === platform && job.status === "published")) continue;
      const problem = await require("./socialMediaHealth").mediaProblem({ ...before, ...data }, platform);
      if (problem) throw Object.assign(new Error(problem), { status: 400 });
    }
    if (data.clientContactOwnerId != null) {
      const contact = await User.findByPk(data.clientContactOwnerId, { transaction });
      if (!contact?.active) throw Object.assign(new Error("Choose an active client follow-up owner."), { status: 400 });
    }
    await item.update(data, { transaction });
    // Return the timestamp actually persisted by MySQL (its precision can
    // differ from Sequelize’s in-memory timestamp used during update).
    await item.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (item.status !== "ready") for (const job of jobs) if (["scheduled", "missed", "failed", "cancelled"].includes(job.status)) await job.update({ status: jobMachine.transition(job.status, "CANCEL"), ...(contentHash(before) !== contentHash(item.toJSON()) ? { checkpoint: {} } : {}) }, { transaction });
    return { item, before };
  });
}
module.exports = { updateRecord };
