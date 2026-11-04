const fs = require("fs/promises");
const path = require("path");
const { UPLOAD_DIR } = require("../middleware/upload");

// No outbound requests: inspect only this app's own files. Public/Meta access
// remains unverified, even when a file exists on disk.
async function inspectMedia(media, { publicUrl = process.env.PUBLIC_URL, uploadDir = UPLOAD_DIR } = {}) {
  const files = [];
  if (typeof media === "string") { try { media = JSON.parse(media); } catch { media = []; } }
  let origin = null;
  try { origin = new URL(publicUrl).origin; } catch { /* deployment URL not configured */ }
  for (const item of Array.isArray(media) ? media : []) {
    const result = { name: item.name || "Artwork", url: item.url, localStatus: "not_checked", jpeg: null, bytes: null, problems: [], publicAccess: "not_verified" };
    let url;
    try { url = new URL(item.url); } catch { result.problems.push("The media URL is invalid. Upload the artwork again."); files.push(result); continue; }
    if (url.protocol !== "https:") result.problems.push("Use a publicly accessible HTTPS artwork URL for publishing in Finvera. Check PUBLIC_URL and upload the artwork again.");
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) result.problems.push("This artwork URL points to localhost; Instagram cannot fetch it.");
    const match = url.origin === origin && /^\/uploads\/social\/([^/]+)$/.exec(url.pathname);
    if (match) {
      let name;
      try { name = decodeURIComponent(match[1]); } catch { name = ""; }
      if (!name || path.basename(name) !== name || name.includes("\\") || name === "." || name === "..") {
        result.problems.push("The artwork filename is invalid.");
      } else {
        let handle;
        try {
          handle = await fs.open(path.join(uploadDir, "social", name), "r");
          const stat = await handle.stat();
          if (!stat.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
          result.localStatus = "available"; result.bytes = stat.size;
          if (!stat.size) result.problems.push("The artwork file is empty. Upload it again.");
          if (item.type !== "video" && !/\.(mp4|mov|m4v)$/i.test(name)) {
            const head = Buffer.alloc(3); await handle.read(head, 0, 3, 0);
            result.jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
          }
        } catch (error) {
          result.localStatus = error.code === "ENOENT" ? "missing" : "unreadable";
          result.problems.push(error.code === "ENOENT" ? "This uploaded file is missing from the server. Re-upload the final artwork before retrying." : "The server cannot read this artwork file. Check upload-folder permissions.");
        } finally { await handle?.close(); }
      }
    }
    files.push(result);
  }
  return { checkedAt: new Date().toISOString(), files, publicAccess: "not_verified", note: "Local file availability does not prove that Meta can download it. Open the media without signing in and check hosting redirects, hotlink protection, firewall rules and TLS if Meta still cannot fetch it." };
}

async function mediaProblem(post, platform) {
  const result = await inspectMedia(post.media);
  for (const file of result.files) {
    if (file.problems.length) return file.problems[0];
    if (platform === "instagram" && file.jpeg === false) return "Instagram requires JPEG images. Re-upload this image so it can be converted, then review and retry.";
  }
  return null;
}
module.exports = { inspectMedia, mediaProblem };
