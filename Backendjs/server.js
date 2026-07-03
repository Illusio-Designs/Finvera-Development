require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const seed = require("./src/utils/seed");

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    await sequelize.authenticate();
    console.log("\x1b[32m✔ MySQL connected\x1b[0m");

    // Auto-provision schema (additive): creates any missing tables and columns
    // on boot so new features (Kanban boards, case-study fields, etc.) work
    // without a manual DB_SYNC step. Additive only — never drops data. Wrapped
    // so a sync hiccup can't take the API down. Set SKIP_DB_SYNC=true to opt out.
    if (String(process.env.SKIP_DB_SYNC).toLowerCase() !== "true") {
      try {
        await sequelize.sync({ alter: true });
        console.log("\x1b[32m✔ Schema synced (tables + columns up to date)\x1b[0m");
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
