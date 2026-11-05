function goLiveAt(post) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.postDate || ""))) return null;
  const time = post.postTime || "10:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const date = new Date(`${post.postDate}T${time}:00+05:30`);
  return Number.isFinite(+date) ? date : null;
}
const isOverdue = (post, now = new Date()) => post.status !== "posted" && !!goLiveAt(post) && +goLiveAt(post) < +now;
module.exports = { goLiveAt, isOverdue };

// COUNT-query equivalent of isOverdue, preserving brand/owner filters at callers.
function overdueWhere(now = new Date()) {
  const { Op } = require('sequelize');
  const local = new Date(+now + 330 * 60000).toISOString();
  const date = local.slice(0, 10), time = local.slice(11, 16);
  const before = local.slice(17, 23) === '00.000' ? Op.lt : Op.lte;
  return { status: { [Op.ne]: 'posted' }, [Op.or]: [
    { postDate: { [Op.lt]: date } },
    { postDate: date, postTime: { [before]: time, [Op.ne]: '' } },
    ...(time > '10:00' || time === '10:00' && before === Op.lte ? [{ postDate: date, [Op.or]: [{ postTime: null }, { postTime: '' }] }] : []),
  ] };
}
module.exports.overdueWhere = overdueWhere;
