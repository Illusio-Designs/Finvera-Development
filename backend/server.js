require("dotenv").config();
const app = require("./src/app");
const { sequelize } = require("./src/models");
const seed = require("./src/utils/seed");

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    await sequelize.authenticate();
    console.log("\x1b[32m✔ MySQL connected\x1b[0m");

    if (String(process.env.DB_SYNC).toLowerCase() === "true") {
      await sequelize.sync({ alter: true });
      console.log("\x1b[32m✔ Models synced\x1b[0m");
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
