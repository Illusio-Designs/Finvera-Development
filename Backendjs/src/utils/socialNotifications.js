const { roleFor } = require("./socialPostMachine");
const { notifyUsers } = require("./notify");

const postLink = (id) => `/dashboard/social?post=${encodeURIComponent(id)}`;
const taskName = (post) => {
  if (post.status === "approval") return "Approval needed";
  if (post.status === "ready") return "Publishing task assigned";
  return roleFor(post.status, post.format) === "video" ? "Video task assigned" : "Design task assigned";
};

async function notifyAssignments(posts, actorId) {
  const tasks = new Map();
  for (const post of posts) {
    if (!post.assigneeId || post.status === "posted") continue;
    const title = taskName(post);
    const key = JSON.stringify([post.assigneeId, title]);
    if (!tasks.has(key)) tasks.set(key, []);
    tasks.get(key).push(post);
  }
  for (const rows of tasks.values()) {
    const post = rows[0];
    const single = rows.length === 1;
    await notifyUsers([post.assigneeId], {
      type: "assigned",
      title: single ? `${taskName(post)}: ${post.theme}` : `${taskName(post)}: ${rows.length} posts`,
      body: [...new Set(rows.map(row => row.client))].join(" · "),
      link: single ? postLink(post.id) : "/dashboard/social?assigned=me",
      ...(single ? { meta: { socialPostId: post.id } } : {}),
    }, actorId);
  }
}

module.exports = { notifyAssignments, postLink };
