const { Notification } = require("../models");
const { asyncHandler } = require("../utils/crud");

/* The current user's notifications (newest first) + unread count. */
const list = asyncHandler(async (req, res) => {
  const items = await Notification.findAll({
    where: { userId: req.user.id },
    order: [["createdAt", "DESC"]],
    limit: 40,
  });
  const unread = items.filter((n) => !n.isRead).length;
  res.json({ items, unread });
});

const read = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!n) return res.status(404).json({ message: "Not found." });
  n.isRead = true; await n.save();
  res.json({ id: n.id, isRead: true });
});

const readAll = asyncHandler(async (req, res) => {
  await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
  res.json({ ok: true });
});

const clear = asyncHandler(async (req, res) => {
  await Notification.destroy({ where: { userId: req.user.id } });
  res.json({ ok: true });
});

module.exports = { list, read, readAll, clear };
