function imageTags(media) {
  if (media.userTags == null) return [];
  if (!Array.isArray(media.userTags) || media.userTags.length > 20) throw new Error("Use up to 20 positioned Instagram tags per image in Finvera.");
  const usernames = new Set();
  return media.userTags.map((tag) => {
    const username = String(tag?.username || "").trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_.]{1,30}$/.test(username) || username.startsWith(".") || username.endsWith(".") || username.includes("..")) throw new Error("Enter an exact Instagram username for each image tag.");
    if (!Number.isFinite(tag.x) || !Number.isFinite(tag.y) || tag.x < 0 || tag.x > 1 || tag.y < 0 || tag.y > 1) throw new Error("Choose a position inside the image for each Instagram tag.");
    if (usernames.has(username.toLowerCase())) throw new Error("Tag an Instagram username only once per image.");
    usernames.add(username.toLowerCase());
    return { username, x: tag.x, y: tag.y };
  });
}
function imageParams(media, base = {}) {
  const tags = imageTags(media);
  return { ...base, image_url: media.url, ...(tags.length ? { user_tags: JSON.stringify(tags) } : {}) };
}
function profileNames(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const names = raw.split(/[,;\n]+|\s+(?=@)/).map((name) => name.trim()).filter(Boolean).map((name) => {
    name = name.trim();
    if (/^https?:\/\//i.test(name)) {
      let url;
      try { url = new URL(name); } catch { throw new Error("Use exact Instagram usernames, separated by commas."); }
      if (!/^(www\.)?instagram\.com$/i.test(url.hostname) || !/^\/[a-zA-Z0-9_.]+\/?$/.test(url.pathname)) throw new Error("Use Instagram profile usernames, not post links.");
      name = url.pathname.replace(/^\/|\/$/g, "");
    }
    return name.replace(/^@/, "");
  });
  // Reuse the same validation as positioned tags.
  return imageTags({ userTags: [...new Map(names.map((username) => [username.toLowerCase(), { username, x: 0.5, y: 0.5 }])).values()] }).map((tag) => tag.username);
}
function postMediaWithTags(media, profiles) {
  const names = profileNames(profiles);
  const video = (item) => item.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(item.url || "");
  if (names.length && media.every(video)) throw new Error("Instagram profile tags in Finvera apply to images. For this video, use caption mentions instead.");
  return media.map((item) => {
    if (video(item)) return item;
    const tags = imageTags(item);
    const have = new Set(tags.map((tag) => tag.username.toLowerCase()));
    const combined = [...tags, ...names.filter((name) => !have.has(name.toLowerCase())).map((username) => ({ username, x: 0.5, y: 0.5 }))];
    return { ...item, userTags: imageTags({ userTags: combined }) };
  });
}
module.exports = { imageTags, imageParams, profileNames, postMediaWithTags };
