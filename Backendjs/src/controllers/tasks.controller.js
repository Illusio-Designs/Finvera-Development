const { Task, Comment, User } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { notifyUsers } = require("../utils/notify");

const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

const authorSafe = (u) => (u ? { id: u.id, name: u.name, avatar: u.avatar } : null);

/* List cards, optionally scoped to a board via ?boardId= */
const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.boardId) where.boardId = req.query.boardId;
  const tasks = await Task.findAll({ where, order: [["position", "ASC"], ["createdAt", "ASC"]] });
  res.json(tasks);
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

module.exports = { list, listComments, addComment, deleteComment };
