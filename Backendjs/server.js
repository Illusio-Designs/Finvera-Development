require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const seed = require("./src/utils/seed");
const ensureColumns = require("./src/utils/ensureColumns");
const ensureIndexes = require("./src/utils/ensureIndexes");

const PORT = Number(process.env.PORT || 5000);

// Keep the worker alive on stray async errors instead of dying and forcing
// Passenger to respawn (respawn storms were exhausting the account's nproc).
process.on("unhandledRejection", (reason) => {
  console.error("\x1b[33m⚠ Unhandled promise rejection (kept alive):\x1b[0m", reason && reason.message ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("\x1b[33m⚠ Uncaught exception (kept alive):\x1b[0m", err && err.message ? err.message : err);
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("\x1b[32m✔ MySQL connected\x1b[0m");

    // Schema provisioning.
    //   Default boot  → sequelize.sync() : only CREATEs missing tables. Cheap,
    //                   no ALTER scan, so Passenger workers boot fast and don't
    //                   pile up (avoids nproc exhaustion on shared hosting).
    //   DB_SYNC_ALTER=true → sequelize.sync({ alter: true }) : reconciles columns
    //                   (run this for ONE restart after a schema change, then
    //                   remove the flag).
    //   SKIP_DB_SYNC=true → skip entirely.
    if (String(process.env.SKIP_DB_SYNC).toLowerCase() !== "true") {
      const alter = String(process.env.DB_SYNC_ALTER).toLowerCase() === "true";
      try {
        // Cold-start shortcut: a full sync() runs CREATE TABLE IF NOT EXISTS +
        // SHOW INDEX for all ~30 models (~60 queries before the first request
        // is answered). One information_schema read tells us whether any table
        // is missing; only then does the full sync run. Models that declare
        // their own indexes are still synced so those indexes self-heal.
        let models = null; // null → full sync
        if (!alter) {
          const [rows] = await sequelize.query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
          const have = new Set(rows.map((r) => String(r.t).toLowerCase()));
          const all = Object.values(sequelize.models);
          if (all.every((m) => have.has(String(m.getTableName()).toLowerCase()))) models = all.filter((m) => (m.options.indexes || []).length);
        }
        if (models) for (const m of models) await m.sync();
        else await sequelize.sync(alter ? { alter: true } : undefined);
        console.log(`\x1b[32m✔ Schema synced (${alter ? "ALTER — columns reconciled" : models ? `all tables present; ${models.length} indexed models checked` : "create-missing only"})\x1b[0m`);
      } catch (e) {
        console.warn("\x1b[33m⚠ Schema sync warning (continuing):\x1b[0m", e.message);
      }
    }

    // Self-heal newly added columns (e.g. tasks.startDate, users.roles) without
    // a full ALTER scan or manual SQL — adds only what's missing.
    try { await ensureColumns(sequelize); } catch (e) { console.warn("\x1b[33m⚠ ensureColumns skipped:\x1b[0m", e.message); }
    // Same idea for indexes on existing tables (CREATE INDEX only if missing).
    try { await ensureIndexes(sequelize); } catch (e) { console.warn("\x1b[33m⚠ ensureIndexes skipped:\x1b[0m", e.message); }

    // Seeding must never take the API down — a schema mismatch or seed bug
    // here previously threw to the outer catch → process.exit(1) → Passenger
    // respawn loop → nproc exhaustion. Isolate it so the server still listens.
    try {
      await seed(); // create admin + sample content if empty
    } catch (e) {
      console.warn("\x1b[33m⚠ Seed skipped (continuing):\x1b[0m", e.message);
    }

    app.listen(PORT, () => {
      console.log(`\x1b[36m✔ Finvera API running on http://localhost:${PORT}\x1b[0m`);
    });

    // Daily reminders (10:15 AM India time) — checked every 5 minutes while
    // the app is awake; claimed once per day so restarts never resend.
    const { maybeRunDaily } = require("./src/utils/dailyReminders");
    setInterval(() => { maybeRunDaily().catch(() => {}); }, 5 * 60 * 1000).unref();

    // Daily database backup (after 02:30 IST) + Meta connection check (after
    // 09:00 IST): each claimed once per day in the DB, so only one process
    // runs it; also kicked by /api/cron/*.
    const ops = require("./src/controllers/ops.controller");
    setTimeout(() => ops.runDailyOps(), 60 * 1000).unref();
    setInterval(() => ops.runDailyOps(), 5 * 60 * 1000).unref();

    // Auto-publishing: check every minute for posts due to go live.
    const autoPublish = require("./src/utils/autoPublish");
    setInterval(() => { autoPublish.runDue().catch(() => {}); }, 60 * 1000).unref();

    // Social calendar upkeep (unassigned-post sweep, default deadlines, the
    // one-time uploaded→Planned fix) — once now, then every 5 minutes. This
    // used to run on every GET /social-posts.
    const social = require("./src/controllers/social.controller");
    social.maintenance().catch(() => {});
    setInterval(() => { social.maintenance().catch(() => {}); }, 5 * 60 * 1000).unref();

    // Social studio numbers (followers, likes) from Meta: refresh hourly in
    // the background so the page always answers from fresh saved numbers.
    const studio = require("./src/controllers/studio.controller");
    setInterval(() => { studio.refreshAllStudio().catch(() => {}); }, 60 * 60 * 1000).unref();
  } catch (err) {
    // Only genuine start failures (e.g. DB unreachable) reach here.
    console.error("\x1b[31m✘ Failed to start server:\x1b[0m", err.message);
    console.error("  Check your MySQL credentials in .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
    process.exit(1);
  }
}

start();
