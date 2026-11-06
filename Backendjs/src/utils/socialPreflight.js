const { postMediaWithTags, imageTags } = require("./instagramTags");
const array = (value) => { if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const isVideo = (item) => item?.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(item?.url || "");
function preflight(post, platforms = ["instagram", "facebook"]) {
  const issues = [];
  const add = (field, message, platform) => issues.push({ field, message, ...(platform ? { platform } : {}) });
  const media = array(post.media);
  if (media.length > 10) add("media", "Use up to 10 artwork files per post.");
  for (const item of media) {
    try { const url = new URL(item?.url); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { add("media", "Artwork needs a public HTTPS URL."); }
  }
  const story = /story|stories/i.test(post.format || ""), reel = /reel/i.test(post.format || "");
  if (platforms.length && (story || reel) && (media.length !== 1 || reel && !isVideo(media[0]))) add("media", story ? "A Story needs exactly one image or video." : "A Reel needs exactly one video.");
  if (platforms.includes("instagram") && story && (String(post.tags || "").trim() || media.some(item => item?.userTags?.length))) add("tags", "Story profile tagging is not implemented in Finvera. Remove them before review.");
  for (const item of media) if (item?.coverUrl) {
    if (!reel || !isVideo(item) || media.length !== 1) add("media", "Cover images are supported on a single Reel video only.");
    try { const url = new URL(item.coverUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { add("media", "The Reel cover needs a public HTTPS URL."); }
    if (/\.(png|webp|gif|avif|svg)(\?|$)/i.test(item.coverUrl)) add("media", "Use a JPG Reel cover. Upload it here for JPEG conversion.");
  }
  if (platforms.includes("instagram")) {
    if (!media.length) add("media", "Add the image or video to the post — Instagram needs media.", "instagram");
    try { for (const item of postMediaWithTags(media, post.tags)) if (isVideo(item) && imageTags(item).length) add("tags", "Image profile tags are not supported on videos in Finvera.", "instagram"); } catch (error) { add("tags", error.message, "instagram"); }
    if (media.some((item) => !isVideo(item) && /\.(png|webp|gif|avif|svg)(\?|$)/i.test(item?.url || ""))) add("media", "Instagram only accepts JPG images. Replace the non-JPG artwork.", "instagram");
    if (/reel/i.test(post.format || "") && (media.length !== 1 || !isVideo(media[0]))) add("media", "A Reel needs exactly one video.", "instagram");
  }
  if (platforms.includes("facebook") && media.some(isVideo) && media.length > 1) add("media", "Facebook video posts must contain one video. Split mixed or multiple-video artwork into separate posts.", "facebook");
  if (platforms.length && (!/^\d{4}-\d{2}-\d{2}$/.test(String(post.postDate || "")) || !Number.isFinite(Date.parse(post.postDate)))) add("postDate", "Set a valid go-live date before scheduling.");
  if (post.postTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(post.postTime)) add("postTime", "Choose a valid go-live time.");
  return issues;
}
module.exports = { preflight, array, isVideo };
