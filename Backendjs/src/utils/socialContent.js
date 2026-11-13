const crypto = require("crypto");
const PAYLOAD = ["client", "format", "caption", "media", "tags", "keywords", "keywordHashtags", "publishTo", "postDate", "postTime"];
const asJSON = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function payload(post) {
  return Object.fromEntries(PAYLOAD.map((k) => {
    let v = post[k];
    if (["media", "publishTo"].includes(k)) v = asJSON(v);
    if (k === "media") v = v || [];
    else if (k === "keywordHashtags") v = v !== false && v !== 0;
    else if (v == null || v === "") v = null;
    return [k, stable(v)];
  }));
}
const contentHash = (post) => crypto.createHash("sha256").update(JSON.stringify(payload(post))).digest("hex");

module.exports = { contentHash };
