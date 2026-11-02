/* Once a post is live, its uploaded image / video files are deleted from
   our server (they live on Instagram / Facebook now). Only files Finvera
   stored itself under uploads/social are touched; outside links stay. */
const fs = require("fs");
const path = require("path");
const { UPLOAD_DIR } = require("../middleware/upload");

const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

async function purgeMedia(post) {
  const media = asArr(post.media).filter((m) => m && m.url);
  const ours = media.filter((m) => /\/uploads\/social\/[^/?#]+/.test(m.url));
  if (!ours.length) return 0;
  let removed = 0;
  for (const m of ours) {
    const name = path.basename(new URL(m.url, "http://x").pathname); // never follows ../
    const file = path.join(UPLOAD_DIR, "social", name);
    try { await fs.promises.unlink(file); removed++; } catch (e) { if (e.code !== "ENOENT") console.warn("purge media:", e.message); }
  }
  // Keep links to files hosted elsewhere; drop the ones we deleted.
  await post.update({ media: media.filter((m) => !ours.includes(m)) });
  return removed;
}

module.exports = { purgeMedia };
