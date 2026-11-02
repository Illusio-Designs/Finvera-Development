/* Operations endpoints: database backups, system status, email settings /
   preferences, and the Meta connection check. */

const fs = require("fs");
const crypto = require("crypto");
const { sequelize, User, Setting } = require("../models");
const { asyncHandler } = require("../utils/crud");
const backup = require("../utils/backup");
const mailer = require("../utils/mailer");
const emails = require("../utils/emails");

/* ── Backups ─────────────────────────────────────────── */
const listBackups = asyncHandler(async (_req, res) => {
  const items = await backup.listBackups();
  res.json({ items, keep: backup.KEEP, running: backup.isRunning(), lastResult: await backup.getResult() });
});

const createBackup = asyncHandler(async (_req, res) => {
  try {
    const info = await backup.createBackup({ kind: "manual" });
    res.status(201).json(info);
  } catch (e) {
    res.status(500).json({ message: `Backup failed: ${e.message}` });
  }
});

function streamFile(res, name) {
  const full = backup.fileFor(name);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ message: "Backup not found." });
  const size = fs.statSync(full).size;
  res.set({
    "Content-Type": "application/gzip",
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const s = fs.createReadStream(full);
  s.on("error", () => res.destroy());
  s.pipe(res);
}

const downloadBackup = (req, res) => {
  if (!backup.isValidName(req.params.name)) return res.status(400).json({ message: "Invalid backup name." });
  streamFile(res, req.params.name);
};

const deleteBackup = asyncHandler(async (req, res) => {
  if (!backup.isValidName(req.params.name)) return res.status(400).json({ message: "Invalid backup name." });
  const ok = await backup.removeBackup(req.params.name);
  if (!ok) return res.status(404).json({ message: "Backup not found." });
  res.json({ ok: true, name: req.params.name });
});

const verifyBackup = asyncHandler(async (req, res) => {
  if (!backup.isValidName(req.params.name)) return res.status(400).json({ message: "Invalid backup name." });
  const r = await backup.verifyBackup(req.params.name);
  if (!r) return res.status(404).json({ message: "Backup not found." });
  res.json(r);
});

/* Off-server copy: GET /api/backups/latest with the BACKUP_TOKEN (header
   X-Backup-Token, or ?token=). Makes today's backup first if it's due. */
function tokenOk(given) {
  const want = process.env.BACKUP_TOKEN || "";
  if (!want || !given) return false;
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
const latestBackup = asyncHandler(async (req, res) => {
  if (!process.env.BACKUP_TOKEN) return res.status(404).json({ message: "Not enabled." });
  if (!tokenOk(req.get("x-backup-token") || req.query.token)) return res.status(401).json({ message: "Invalid token." });
  await backup.maybeRunDailyBackup();
  let items = await backup.listBackups();
  if (!items.length) { await backup.createBackup({ kind: "auto" }).catch(() => {}); items = await backup.listBackups(); }
  if (!items.length) return res.status(503).json({ message: "No backup available." });
  res.set("X-Backup-Created-At", items[0].createdAt);
  streamFile(res, items[0].name);
});

/* ── Email ───────────────────────────────────────────── */
const emailStatus = (_req, res) => {
  res.json({
    configured: mailer.configured(),
    from: process.env.MAIL_FROM || process.env.SMTP_USER || null,
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_HOST ? Number(process.env.SMTP_PORT || 465) : null,
    user: process.env.SMTP_USER || null,
  });
};

const testEmail = asyncHandler(async (req, res) => {
  const to = String(req.body?.to || req.userRow?.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ ok: false, message: "Enter a valid email address to send the test to." });
  if (!mailer.configured()) return res.status(400).json({ ok: false, message: "Email isn't set up on the server (SMTP_HOST is empty)." });
  const r = await mailer.sendMail({
    to, subject: "Finvera test email",
    html: mailer.layout({ title: "Email works", body: `<p>This is a test email from the Finvera admin, sent by ${mailer.esc(req.user?.name || "an admin")} at ${new Date().toUTCString()}.</p>` }),
    text: "Email works — test from the Finvera admin.",
  });
  if (r.sent) return res.json({ ok: true, message: `Test email sent to ${to}.`, id: r.id || null });
  const why = r.reason === "nodemailer-missing" ? "The server is missing the nodemailer package — run NPM Install in cPanel." : r.reason;
  res.status(422).json({ ok: false, message: `Couldn't send: ${why}`, error: why });
});

const getEmailPrefs = asyncHandler(async (req, res) => {
  const u = await User.findByPk(req.user.id, { attributes: ["id", "email", "emailPrefs"] });
  if (!u) return res.status(404).json({ message: "User not found." });
  res.json({ prefs: emails.prefsOf(u), kinds: emails.PREF_KINDS, email: u.email, mailConfigured: mailer.configured() });
});

const putEmailPrefs = asyncHandler(async (req, res) => {
  const u = await User.findByPk(req.user.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  const body = req.body?.prefs && typeof req.body.prefs === "object" ? req.body.prefs : req.body;
  const prefs = { ...emails.prefsOf(u), ...emails.cleanPrefs(body) };
  await u.update({ emailPrefs: prefs });
  try { require("../middleware/auth").forgetUser(u.id); } catch { /* cache only */ }
  res.json({ prefs, kinds: emails.PREF_KINDS, email: u.email, mailConfigured: mailer.configured() });
});

/* ── Meta connection check ───────────────────────────── */
const checkSocialAccounts = asyncHandler(async (_req, res) => {
  const meta = require("../utils/meta");
  const r = await require("../utils/metaHealth").checkAll();
  res.json({ metaConfigured: meta.configured(), ...r });
});

/* ── System status ───────────────────────────────────── */
const settingValue = async (key) => (await Setting.findOne({ where: { key }, attributes: ["value", "updatedAt"], raw: true })) || null;

const systemStatus = asyncHandler(async (_req, res) => {
  const t0 = process.hrtime.bigint();
  let db = { ok: true, pingMs: null, error: null };
  try { await sequelize.query("SELECT 1"); db.pingMs = Number(process.hrtime.bigint() - t0) / 1e6; } catch (e) { db = { ok: false, pingMs: null, error: e.message }; }
  if (db.pingMs != null) db.pingMs = Math.round(db.pingMs * 10) / 10;

  const [backups, lastBackupResult, reminders, cronTick, metaRun, backupRun] = await Promise.all([
    backup.listBackups().catch(() => []),
    backup.getResult(),
    settingValue("reminders.lastRun").catch(() => null),
    settingValue("cron.lastTick").catch(() => null),
    settingValue("metaHealth.lastRun").catch(() => null),
    settingValue("backup.lastRun").catch(() => null),
  ]);
  const mem = process.memoryUsage();
  const mb = (n) => Math.round((n / 1048576) * 10) / 10;
  const pool = sequelize.connectionManager?.pool;
  const cfg = sequelize.config?.pool || sequelize.options?.pool || {};
  let accounts = null;
  try {
    const { SocialAccount } = require("../models");
    const rows = await SocialAccount.findAll({ attributes: ["client", "status", "tokenExpiresAt", "lastCheckedAt"], raw: true });
    accounts = { total: rows.length, needReconnect: rows.filter((a) => a.status !== "connected").map((a) => a.client), expiringSoon: rows.filter((a) => a.tokenExpiresAt && new Date(a.tokenExpiresAt) - Date.now() < 7 * 86400000).map((a) => a.client) };
  } catch { /* table missing */ }

  res.json({
    now: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    node: process.version,
    pid: process.pid,
    env: process.env.NODE_ENV || "development",
    memory: { rssMb: mb(mem.rss), heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal), externalMb: mb(mem.external) },
    db: { ...db, name: sequelize.config?.database || null, dialect: sequelize.getDialect() },
    pool: {
      max: cfg.max ?? null, min: cfg.min ?? null, idleMs: cfg.idle ?? null, acquireMs: cfg.acquire ?? null,
      size: pool?.size ?? null, available: pool?.available ?? null, using: pool?.using ?? null, waiting: pool?.waiting ?? null,
    },
    backups: {
      count: backups.length, keep: backup.KEEP, latest: backups[0] || null, lastResult: lastBackupResult,
      lastDailyRun: backupRun?.value || null, running: backup.isRunning(), offsiteEnabled: !!process.env.BACKUP_TOKEN,
    },
    reminders: { lastRun: reminders?.value || null, at: reminders?.updatedAt || null },
    cron: { lastTick: cronTick?.value || null },
    metaCheck: { lastRun: metaRun?.value || null, accounts },
    mail: { configured: mailer.configured(), from: process.env.MAIL_FROM || process.env.SMTP_USER || null, host: process.env.SMTP_HOST || null },
    errors: require("../middleware/error").errorStats(),
    spamGuard: { turnstile: !!process.env.TURNSTILE_SECRET },
  });
});

/* Cron hook: remember the tick, then (in the background) the daily backup
   and the daily Meta check — each runs once a day across all processes. */
async function onCronTick() {
  try {
    const key = "cron.lastTick", value = new Date().toISOString();
    const [row, made] = await Setting.findOrCreate({ where: { key }, defaults: { key, value, group: "system", isPublic: false } });
    if (!made) await row.update({ value });
  } catch { /* status only */ }
  runDailyOps();
}
function runDailyOps() {
  backup.maybeRunDailyBackup().catch(() => {});
  require("../utils/metaHealth").maybeRunDailyCheck().catch(() => {});
}

module.exports = {
  listBackups, createBackup, downloadBackup, deleteBackup, verifyBackup, latestBackup,
  emailStatus, testEmail, getEmailPrefs, putEmailPrefs, checkSocialAccounts, systemStatus, onCronTick, runDailyOps,
};
