const { Op } = require("sequelize");
const { sequelize, SocialPost, SocialPublishJob, SocialPostEvent, User, SocialClient } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesOf } = require("../utils/permissions");
const social = require("./social.controller");
const { notifyUsers } = require("../utils/notify");

const reassignPending = asyncHandler(async (req, res) => {
  const { fromId, toId, brand = "", role = "", preview = false, postIds } = req.body || {};
  const from = Number(fromId), to = Number(toId);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from <= 0 || to <= 0 || from === to)
    return res.status(400).json({ message: "Choose two different people." });
  if (role && !["graphic", "video", "social"].includes(role)) return res.status(400).json({ message: "Choose a valid work type." });
  const target = await User.findByPk(to);
  if (!target || !target.active) return res.status(400).json({ message: "Choose an active replacement." });
  const allowedRoles = rolesOf(target);
  const matches = (p) => (!role || social.stageRole(p.status, p.format, p.step) === role) && allowedRoles.includes(social.stageRole(p.status, p.format, p.step));
  const where = { assigneeId: from, status: { [Op.ne]: "posted" }, ...(brand ? { client: String(brand) } : {}) };
  if (preview) {
    const posts = await SocialPost.findAll({ where, order: [["id", "ASC"]], limit: 1001 });
    if (posts.length > 1000) return res.status(400).json({ message: "More than 1,000 pending posts. Narrow by brand." });
    const publishing = new Set((await SocialPublishJob.findAll({ attributes: ["postId"], where: { postId: posts.map((p) => p.id), status: "publishing" }, raw: true })).map((j) => Number(j.postId)));
    const eligible = posts.filter((p) => matches(p) && !publishing.has(p.id));
    return res.json({ posts: eligible.map((p) => ({ id: p.id, theme: p.theme, client: p.client, status: p.status })), skipped: posts.length - eligible.length });
  }
  if (!Array.isArray(postIds) || !postIds.length || postIds.length > 1000 || postIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(postIds).size !== postIds.length)
    return res.status(400).json({ message: "Preview the pending posts before transferring them." });
  const changed = await sequelize.transaction(async (transaction) => {
    const posts = await SocialPost.findAll({ where: { ...where, id: postIds }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const jobs = await SocialPublishJob.findAll({ where: { postId: postIds }, transaction, lock: transaction.LOCK.UPDATE });
    if (posts.length !== postIds.length || posts.some((p) => !matches(p)) || jobs.some((j) => j.status === "publishing")) return null;
    // Retain brand access and other role assignments; change only the current role.
    const brands = await SocialClient.findAll({ where: { name: [...new Set(posts.map((p) => p.client))] }, transaction });
    const lockedTarget = await User.findByPk(to, { transaction, lock: transaction.LOCK.UPDATE });
    if (!lockedTarget?.active || posts.some((p) => !rolesOf(lockedTarget).includes(social.stageRole(p.status, p.format, p.step)))) return null;
    const access = social.brandIdsOf(lockedTarget);
    if (access) await lockedTarget.update({ socialClients: [...new Set([...access, ...brands.map((b) => String(b.id))])] }, { transaction });
    const events = [];
    for (const p of posts) {
      await p.update({ assigneeId: to, team: { ...social.teamOf(p), [social.stageRole(p.status, p.format, p.step)]: to } }, { transaction });
      events.push(social.eventOf(p, { from: p.status, fromAssigneeId: from, byUserId: req.user.id }));
    }
    await SocialPostEvent.bulkCreate(events, { transaction });
    return posts.length;
  });
  if (changed == null) return res.status(409).json({ message: "Some posts or permissions changed, or publishing started. Preview again; nothing was transferred." });
  require("../middleware/auth").forgetUser(to);
  require("./kpi.controller").bumpKpiCache();
  // A notification failure must not make a successful transaction look failed.
  try { await notifyUsers([to], { type: "assigned", title: `${changed} pending social posts assigned to you`, body: "Your existing files, stage and go-live dates are retained.", link: "/dashboard/social" }, req.user.id); } catch (e) { console.warn("Bulk reassignment notification:", e.message); }
  res.json({ transferred: changed });
});

module.exports = { reassignPending };
