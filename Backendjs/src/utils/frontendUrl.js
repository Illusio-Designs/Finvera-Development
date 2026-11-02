/* Public base URL of the admin/marketing frontend (no trailing slash).
   FRONTEND_URL wins; else the first https, non-localhost CORS origin. */
module.exports = function frontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  const fromCors = String(process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).find((o) => /^https:\/\//.test(o) && !/localhost/.test(o));
  return (fromCors || "https://www.finvera.solutions").replace(/\/$/, "");
};
