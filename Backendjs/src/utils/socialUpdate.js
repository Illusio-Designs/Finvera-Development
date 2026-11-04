const { sequelize, SocialPost, SocialPublishJob, User } = require("../models");
const { prepareUpdate, contentHash } = require("./socialSafety");

async function updateRecord(req) {
  return sequelize.transaction(async (transaction) => {
    // The publisher claims work in the same post → jobs lock order.
    const item = await SocialPost.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw Object.assign(new Error("Post not found."), { status: 404 });
    if (req.socialScope && !req.socialScope.has(item.client)) throw Object.assign(new Error("Post not found."), { status: 404 });
    if (req.body.client && req.socialScope && !req.socialScope.has(req.body.client)) throw Object.assign(new Error("This brand is outside your access."), { status: 403 });
    const jobs = await SocialPublishJob.findAll({ where: { postId: item.id }, transaction, lock: transaction.LOCK.UPDATE });
    const before = item.toJSON();
    const data = prepareUpdate(before, req.body, req.userRow || req.user, jobs);
    if (data.clientContactOwnerId != null) {
      const contact = await User.findByPk(data.clientContactOwnerId, { transaction });
      if (!contact?.active) throw Object.assign(new Error("Choose an active client follow-up owner."), { status: 400 });
    }
    await item.update(data, { transaction });
    // Return the timestamp actually persisted by MySQL (its precision can
    // differ from Sequelize’s in-memory timestamp used during update).
    await item.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (item.status !== "ready") for (const job of jobs) if (["scheduled", "missed", "failed", "cancelled"].includes(job.status)) await job.update({ status: "cancelled", ...(contentHash(before) !== contentHash(item.toJSON()) ? { checkpoint: {} } : {}) }, { transaction });
    return { item, before };
  });
}
module.exports = { updateRecord };
