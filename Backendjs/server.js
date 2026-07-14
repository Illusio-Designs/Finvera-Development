require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const seed = require("./src/utils/seed");

const PORT = Number(process.env.PORT || 5000);

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

    await seed(); // create admin + sample content if empty

    app.listen(PORT, () => {
      console.log(`\x1b[36m✔ Finvera API running on http://localhost:${PORT}\x1b[0m`);
    });
  } catch (err) {
    console.error("\x1b[31m✘ Failed to start server:\x1b[0m", err.message);
    console.error("  Check your MySQL credentials in .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).");
    process.exit(1);
  }
}

start();
