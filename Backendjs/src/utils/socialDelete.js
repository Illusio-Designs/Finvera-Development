const { sequelize, SocialPost, SocialPublishJob } = require("../models");
const { Op } = require("sequelize");
function deletionProblem(posts, jobs) {
  if (posts.some((post) => post.status === "posted") || jobs.some((job) => {
    let checkpoint = job.checkpoint || {}; if (typeof checkpoint === "string") { try { checkpoint = JSON.parse(checkpoint); } catch { checkpoint = {}; } }
    return ["published", "publishing", "check"].includes(job.status) || checkpoint.publishCalled;
  })) return "This selection includes live, publishing or uncertain posts. Keep their history and resolve platform results before deleting unfinished work.";
  return null;
}
async function deletePosts(where, scope) {
  return sequelize.transaction(async (transaction) => {
    const posts = await SocialPost.findAll({ where, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    if (scope && posts.some((post) => !scope.has(post.client))) throw Object.assign(new Error("Post not found."), { status: 404 });
    const ids = posts.map((post) => post.id);
    if (!ids.length) return 0;
    const jobs = await SocialPublishJob.findAll({ where: { postId: { [Op.in]: ids } }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const problem = deletionProblem(posts, jobs);
    if (problem) throw Object.assign(new Error(problem), { status: 409 });
    await SocialPublishJob.destroy({ where: { postId: { [Op.in]: ids } }, transaction });
    return SocialPost.destroy({ where: { id: { [Op.in]: ids } }, transaction });
  });
}
module.exports = { deletePosts, deletionProblem };
