const { Task, Comment, User } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { notifyUsers } = require("../utils/notify");

const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

const authorSafe = (u) => (u ? { id: u.id, name: u.name, avatar: u.avatar } : null);

/* List cards, optionally scoped to a board via ?boardId= */
/* ?fields=summary → only { id, boardId, column, completed, memberIds } — what
   the boards overview needs for its counts and member avatars, without every
   card's description / checklist / attachments. */
const SUMMARY = ["id", "boardId", "column", "completed", "memberIds"];
const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.boardId) where.boardId = req.query.boardId;
  const summary = req.query.fields === "summary";
  const tasks = await Task.findAll({
    where, order: [["position", "ASC"], ["createdAt", "ASC"]],
    ...(summary ? { attributes: SUMMARY, raw: true } : {}),
  });
  if (summary) for (const t of tasks) t.completed = !!t.completed;
  res.json(tasks);
});

/* POST /tasks/reorder { column, ids: [taskId, …] } — one column's new card
   order after a drag, in a single UPDATE (it used to be one PATCH per card).
   Only position (and column, so a card dropped here is placed in it) is
   written; the moved card's own PATCH carries notifications as before. */
const reorder = asyncHandler(async (req, res) => {
  const column = String(req.body?.column || "");
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 2000);
  if (!column || !ids.length) return res.status(400).json({ message: "Send the column and the card ids in order." });
  const { sequelize } = require("../models");
  const cases = ids.map((id, i) => `WHEN ${id} THEN ${i}`).join(" ");
  await sequelize.query(
    `UPDATE \`tasks\` SET \`position\` = CASE \`id\` ${cases} END, \`column\` = ?, \`updatedAt\` = NOW() WHERE \`id\` IN (${ids.join(",")})`,
    { replacements: [column] },
  );
  res.json({ ok: true, column, count: ids.length });
});

/* Comments for a card (newest last), with author name + avatar */
const listComments = asyncHandler(async (req, res) => {
  const comments = await Comment.findAll({
    where: { taskId: req.params.taskId },
    include: [{ model: User, as: "author" }],
    order: [["createdAt", "ASC"]],
  });
  res.json(comments.map((c) => ({ id: c.id, taskId: c.taskId, body: c.body, createdAt: c.createdAt, author: authorSafe(c.author) })));
});

const addComment = asyncHandler(async (req, res) => {
  const body = String(req.body.body || "").trim();
  if (!body) return res.status(400).json({ message: "Comment can't be empty." });
  const c = await Comment.create({ taskId: req.params.taskId, userId: req.user.id, body });
  const task = await Task.findByPk(req.params.taskId);
  if (task) {
    await notifyUsers(asArr(task.memberIds), {
      type: "comment",
      title: `New comment on "${task.title}"`,
      body: body.slice(0, 120),
      link: "/dashboard/kanban",
      meta: { taskId: task.id },
    }, req.user.id);
  }
  res.status(201).json({ id: c.id, taskId: c.taskId, body: c.body, createdAt: c.createdAt, author: authorSafe(req.user) });
});

const deleteComment = asyncHandler(async (req, res) => {
  const c = await Comment.findByPk(req.params.id);
  if (!c) return res.status(404).json({ message: "Comment not found." });
  await c.destroy();
  res.json({ message: "Deleted.", id: Number(req.params.id) });
});

module.exports = { list, reorder, listComments, addComment, deleteComment };
