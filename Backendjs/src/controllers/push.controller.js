const crypto = require("crypto");
const { PushSubscription } = require("../models");
const { asyncHandler } = require("../utils/crud");
const webpush = require("../utils/webpush");
const { pushToUser } = require("../utils/notify");

const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

/* The server's public VAPID key — the browser needs it to subscribe. */
const key = asyncHandler(async (_req, res) => {
  const k = await webpush.getKeys();
  res.json({ publicKey: k.publicKey });
});

/* Save (or move to this user) the device's push subscription. */
const subscribe = asyncHandler(async (req, res) => {
  const s = req.body?.subscription || req.body || {};
  const endpoint = String(s.endpoint || "");
  const p256dh = s.keys?.p256dh, auth = s.keys?.auth;
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return res.status(400).json({ message: "That isn't a valid push subscription." });
  const endpointHash = hash(endpoint);
  const data = { userId: req.user.id, endpoint, endpointHash, p256dh: String(p256dh), auth: String(auth), userAgent: String(req.get("user-agent") || "").slice(0, 250) };
  await PushSubscription.upsert(data);
  res.json({ ok: true, devices: await PushSubscription.count({ where: { userId: req.user.id } }) });
});

const unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (endpoint) await PushSubscription.destroy({ where: { endpointHash: hash(endpoint), userId: req.user.id } });
  res.json({ ok: true });
});

/* One test push to the subscription just enabled by the caller. */
const test = asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) return res.status(400).json({ message: "A device subscription is required." });
  const r = await pushToUser(req.user.id, {
    title: "Notifications are on",
    body: "You'll get assignments, updates and reminders here, even when Finvera is closed.",
    url: "/dashboard", tag: "push-test", type: "info",
  }, { endpointHash: hash(endpoint), topic: "push-test" });
  res.json(r);
});

module.exports = { key, subscribe, unsubscribe, test };
