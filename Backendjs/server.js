require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const seed = require("./src/utils/seed");

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
    //                   (run this for ONE restart after a schema change, e.g. the
    //                   new user `roles` column, then remove the flag).
    //   SKIP_DB_SYNC=true → skip entirely.
    if (String(process.env.SKIP_DB_SYNC).toLowerCase() !== "true") {
      const alter = String(process.env.DB_SYNC_ALTER).toLowerCase() === "true";
      try {
        await sequelize.sync(alter ? { alter: true } : undefined);
        console.log(`\x1b[32m✔ Schema synced (${alter ? "ALTER — columns reconciled" : "create-missing only"})\x1b[0m`);
      } catch (e) {
        console.warn("\x1b[33m⚠ Schema sync warning (continuing):\x1b[0m", e.message);
      }
    }

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
  } catch (err) {
    // Only genuine start failures (e.g. DB unreachable) reach here.
    console.error("\x1b[31m✘ Failed to start server:\x1b[0m", err.message);
    console.error("  Check your MySQL credentials in .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
    process.exit(1);
  }
}

start();
