function goLiveAt(post) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.postDate || ""))) return null;
  const time = post.postTime || "10:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const date = new Date(`${post.postDate}T${time}:00+05:30`);
  return Number.isFinite(+date) ? date : null;
}
const isOverdue = (post, now = new Date()) => post.status !== "posted" && !!goLiveAt(post) && +goLiveAt(post) < +now;
module.exports = { goLiveAt, isOverdue };
