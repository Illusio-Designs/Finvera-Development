/* 404 handler */
function notFound(req, res, _next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/* ── 5xx tracking + admin alerts ──────────────────────────
   Every response with a 5xx status is counted (per process). Admins get one
   in-app notification + email at most every 30 minutes (claimed in the DB, so
   several app processes still send one), with the count, the last error
   message and the route. Never the request body, query string, headers or
   anything that looks like a token. */
const ALERT_WINDOW_MS = 30 * 60 * 1000;
const KEEP_MS = 24 * 3600 * 1000;
const recent = [];            // { at, status, route, message }
let lastError = null;
let alertPending = false;

function scrub(msg) {
  return String(msg || "")
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer [redacted]")
    .replace(/((?:access_)?token|secret|password|passwd|pass|api[_-]?key|authorization)(["'\s:=]+)[^\s,"'&]+/gi, "$1$2[redacted]")
    .replace(/[A-Za-z0-9_\-+/=]{32,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}
/* Route without query string; ids collapsed so routes group. */
const routeOf = (req) => `${req.method} ${String(req.originalUrl || req.url || "").split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id").slice(0, 160)}`;

function prune(now = Date.now()) {
  while (recent.length && now - recent[0].at > KEEP_MS) recent.shift();
  if (recent.length > 5000) recent.splice(0, recent.length - 5000);
}

function record(req, status, message) {
  const now = Date.now();
  const e = { at: now, status, route: routeOf(req), message: scrub(message || `HTTP ${status}`) };
  recent.push(e);
  lastError = e;
  prune(now);
  if (!alertPending) {
    alertPending = true;
    setTimeout(() => { alertPending = false; sendAlert().catch(() => {}); }, 2000).unref(); // a burst becomes one alert
  }
}

async function sendAlert() {
  const now = Date.now();
  const count = recent.filter((e) => now - e.at <= ALERT_WINDOW_MS).length;
  if (!count || !lastError) return;
  const { alertTeam, layout, esc, dashboardUrl } = require("../utils/emails");
  const e = lastError;
  await alertTeam({
    key: "server-errors", windowMs: ALERT_WINDOW_MS, kind: "system",
    payload: {
      type: "due", title: `Server errors: ${count} in the last 30 min`,
      body: `${e.route} — ${e.message}`.slice(0, 250), link: "/dashboard/system",
    },
    mail: {
      subject: `Finvera API: ${count} server error${count === 1 ? "" : "s"} in the last 30 minutes`,
      html: layout({
        title: "The API is returning errors",
        body: `<p><b>${count}</b> request${count === 1 ? "" : "s"} failed with a server error in the last 30 minutes (this app process).</p>
<p><b>Last error</b><br>${esc(e.route)} → ${e.status}<br><code>${esc(e.message)}</code><br><span style="color:#8a93aa">${new Date(e.at).toISOString()}</span></p>
<p>You'll get at most one of these every 30 minutes.</p>`,
        button: { label: "Open System status", url: dashboardUrl("/dashboard/system") },
      }),
      text: `${count} server errors in the last 30 minutes. Last: ${e.route} -> ${e.status}: ${e.message}`,
    },
  });
}

/* App-level: count every 5xx response (also ones a handler sent itself). */
function trackErrors(req, res, next) {
  res.on("finish", () => {
    if (res.statusCode < 500) return;
    const p = String(req.originalUrl || "");
    if (/^\/(api\/)?health/.test(p)) return; // the health check reports DB down itself
    try { record(req, res.statusCode, res.locals.errorMessage); } catch { /* never break a response */ }
  });
  next();
}

function errorStats() {
  const now = Date.now();
  prune(now);
  return {
    last30m: recent.filter((e) => now - e.at <= ALERT_WINDOW_MS).length,
    last24h: recent.length,
    last: lastError ? { at: new Date(lastError.at).toISOString(), status: lastError.status, route: lastError.route, message: lastError.message } : null,
    scope: "this app process",
  };
}

/* Central error handler */
function errorHandler(err, _req, res, _next) {
  // Sequelize validation / unique errors
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ message: "That record already exists.", fields: err.fields });
  }
  if (err.name === "SequelizeValidationError") {
    return res.status(422).json({ message: "Validation failed.", errors: err.errors.map((e) => e.message) });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large." });
  }
  const status = err.status || 500;
  if (status >= 500) {
    console.error("\x1b[31m[error]\x1b[0m", err);
    res.locals.errorMessage = `${err.name && err.name !== "Error" ? err.name + ": " : ""}${err.message || ""}`;
  }
  res.status(status).json({ message: err.message || "Something went wrong." });
}

module.exports = { notFound, errorHandler, trackErrors, errorStats, _scrub: scrub };
