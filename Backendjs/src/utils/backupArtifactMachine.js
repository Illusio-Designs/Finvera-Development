const NAME_RE = /^finvera-\d{8}-\d{6}-(auto|manual)(-\d{1,3})?\.sql\.gz$/;
function artifactState(name) {
  if (typeof name !== "string") return "other";
  if (name.length < 80 && NAME_RE.test(name)) return "archive";
  if (name.endsWith(".partial") && artifactState(name.slice(0, -8)) === "archive") return "partial";
  return "other";
}
module.exports = { artifactState };
