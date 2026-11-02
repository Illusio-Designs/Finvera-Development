const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "finvera",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? (msg) => console.log("\x1b[90m%s\x1b[0m", msg) : false,
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    },
    // Shared hosting caps connections per MySQL user (often ~15–25) and
    // Passenger can run several app processes, each with its own pool —
    // tune with DB_POOL_MAX. Idle connections are kept 30 s (was 10 s) so an
    // admin clicking around doesn't pay a fresh MySQL connect on most requests.
    pool: {
      max: Number(process.env.DB_POOL_MAX || 10),
      min: 0,
      acquire: 30000,
      idle: Number(process.env.DB_POOL_IDLE_MS || 30000),
    },
  }
);

module.exports = sequelize;
