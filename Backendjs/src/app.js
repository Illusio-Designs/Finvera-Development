const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();
app.set("trust proxy", 1);

/* Security + parsing */
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

/* CORS — allow configured frontend origins */
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.includes("*") || origins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));

/* Static uploads */
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* Health check (top-level, for load balancers / cPanel / uptime monitors) */
const { health } = require("./controllers/health.controller");
app.get(["/health", "/healthz"], health);

/* API */
app.get("/", (_req, res) => res.json({ name: "Finvera API", version: "1.0.0", health: "/health", docs: "/api/health" }));
app.use("/api", routes);

/* Errors */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
