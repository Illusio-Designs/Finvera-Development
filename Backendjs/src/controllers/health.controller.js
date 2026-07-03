const { sequelize } = require("../models");

/* Liveness + readiness check. Verifies the DB connection; returns 503 if it's down. */
async function health(_req, res) {
  let db = "up";
  try {
    await sequelize.authenticate();
  } catch (_) {
    db = "down";
  }
  const ok = db === "up";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    db,
    uptime: Math.round(process.uptime()),
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
}

module.exports = { health };
