/* Meta (Facebook + Instagram) connection and publishing.

   The connect flow is ported from Collabhype (Backend/src/modules/oauth/
   facebook.service.js + oauth.controller.js + utils/crypto.js): Facebook
   login → long-lived user token → the person's Pages with their linked
   Instagram Business accounts → the chosen Page's token is stored encrypted.
   Finvera additionally asks for the publishing permissions and adds the
   publish calls. Uses Node's https (deploys don't install npm packages).

   Env: META_APP_ID, META_APP_SECRET, and optionally META_REDIRECT_URI,
   META_GRAPH_VERSION (default v26.0)
   (default: <PUBLIC_URL>/api/social-connect/meta/callback). */

const crypto = require("crypto");
const https = require("https");
const { imageParams, imageTags, postMediaWithTags } = require("./instagramTags");
const { URL, URLSearchParams } = require("url");

const VERSION = process.env.META_GRAPH_VERSION || "v26.0"; // match the app's API version in the Meta dashboard
const FB_AUTH_URL = `https://www.facebook.com/${VERSION}/dialog/oauth`;
// META_GRAPH_URL only exists so tests can point at a fake Graph API.
const FB_GRAPH = (process.env.META_GRAPH_URL || `https://graph.facebook.com/${VERSION}`).replace(/\/$/, "");

// Read Pages + linked Instagram accounts, and publish to both.
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
  // Extra permissions once added to the Meta app, e.g. META_EXTRA_SCOPES=pages_manage_metadata (edit Page details)
  ...String(process.env.META_EXTRA_SCOPES || "").split(",").map((x) => x.trim()).filter(Boolean),
];

const configured = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
function redirectUri() {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const base = (process.env.PUBLIC_URL || "https://api.finvera.solutions").replace(/\/$/, "");
  return `${base}/api/social-connect/meta/callback`;
}

/* AES-256-GCM for stored tokens (same scheme as Collabhype's utils/crypto.js). */
const key = () => crypto.createHash("sha256").update(String(process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET || "")).digest();
function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
function decrypt(payload) {
  if (payload == null) return null;
  const buf = Buffer.from(payload, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/* Minimal Graph API client. Throws an Error carrying Meta's own message. */
function graph(method, path, params = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path.startsWith("http") ? path : `${FB_GRAPH}${path}`);
    const body = method === "GET" ? null : new URLSearchParams(params).toString();
    if (method === "GET") for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    const req = https.request({
      method, hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, timeout: 60000,
      headers: body ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) } : {},
    }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        let data = {};
        try { data = JSON.parse(raw || "{}"); } catch { data = { raw }; }
        if (res.statusCode >= 400 || data.error) {
          const e = new Error(data.error?.error_user_msg || data.error?.message || `Meta returned ${res.statusCode}`);
          e.meta = data.error || null;
          return reject(e);
        }
        resolve(data);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Meta did not answer in time")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Connect (from Collabhype) ── */
function buildAuthUrl(state) {
  const p = new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: redirectUri(), scope: SCOPES.join(","), response_type: "code", state });
  return `${FB_AUTH_URL}?${p.toString()}`;
}

async function exchangeCode(code) {
  const short = await graph("GET", "/oauth/access_token", { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: redirectUri(), code });
  const long = await graph("GET", "/oauth/access_token", { grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, fb_exchange_token: short.access_token });
  return long.access_token;
}

/* The person's Pages, each with its (non-expiring) Page token and the
   Instagram Business account linked to it, if any. */
async function listPages(longToken) {
  const res = await graph("GET", "/me/accounts", { access_token: longToken, limit: 100, fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}" });
  return (res.data || []).map((p) => ({
    pageId: p.id, pageName: p.name || "", pageToken: p.access_token, pageAvatar: p.picture?.data?.url || null,
    igUserId: p.instagram_business_account?.id || null, igUsername: p.instagram_business_account?.username || null,
    igAvatar: p.instagram_business_account?.profile_picture_url || null,
  }));
}

/* ── Publishing ── */
const isVideo = (m) => m.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(m.url || "");

/* Wait until Instagram has processed an uploaded container (videos take a while). */
async function waitForContainer(id, token, maxMs = 5 * 60 * 1000) {
  const start = Date.now();
  for (;;) {
    const s = await graph("GET", `/${id}`, { fields: "status_code,status", access_token: token });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram couldn't process the media (${s.status || s.status_code}).`);
    if (Date.now() - start > maxMs) throw new Error("Instagram is still processing the video — try Retry in a few minutes.");
    await sleep(5000);
  }
}

/* Instagram: one image, one video (as a Reel) or a carousel of up to 10.
   `cp` is the job's checkpoint: the container id is saved as soon as it
   exists so a retry resumes instead of uploading again, and `publishCalled`
   marks the moment after which the outcome is uncertain on failure. */
async function publishInstagram(acc, media, caption, cp = {}, save = async () => {}, profiles = "", options = {}) {
  const story = /story|stories/i.test(options.format || "");
  if (story && (media.length !== 1 || profiles || media.some(item => imageTags(item).length))) throw new Error("A Story needs one asset and does not support image profile tags.");
  media = story ? media : postMediaWithTags(media, profiles);
  const token = decrypt(acc.pageToken);
  const ig = acc.igUserId;
  if (!ig) throw new Error("This brand has no Instagram Business account linked to its Facebook Page.");
  if (!media.length) throw new Error("Add the image or video to publish.");
  for (const item of media) { if (isVideo(item) && imageTags(item).length) throw new Error("Positioned profile tags are supported on images in Finvera. Remove image tags from this video before publishing."); }
  let creation = cp.creationId || null;
  if (creation) {
    // resume: already uploaded on an earlier attempt
  } else if (media.length === 1) {
    const m = media[0];
    const c = await graph("POST", `/${ig}/media`, isVideo(m)
      ? { media_type: story ? "STORIES" : "REELS", video_url: m.url, ...(story ? {} : { caption, share_to_feed: "true", ...(m.coverUrl ? { cover_url: m.coverUrl } : {}) }), access_token: token }
      : story ? { media_type: "STORIES", image_url: m.url, access_token: token } : imageParams(m, { caption, access_token: token }));
    creation = c.id;
  } else {
    const children = [];
    for (const m of media.slice(0, 10)) {
      const c = await graph("POST", `/${ig}/media`, isVideo(m)
        ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true", access_token: token }
        : imageParams(m, { is_carousel_item: "true", access_token: token }));
      children.push(c.id);
    }
    for (const id of children) await waitForContainer(id, token);
    const c = await graph("POST", `/${ig}/media`, { media_type: "CAROUSEL", children: children.join(","), caption, access_token: token });
    creation = c.id;
  }
  if (!cp.creationId) { cp.creationId = creation; await save(cp); }
  await waitForContainer(creation, token);
  cp.publishCalled = true; await save(cp);
  const pub = await graph("POST", `/${ig}/media_publish`, { creation_id: creation, access_token: token });
  const info = await graph("GET", `/${pub.id}`, { fields: "permalink", access_token: token }).catch(() => ({}));
  return { id: pub.id, url: info.permalink || null };
}

async function waitForFacebookPublished(id, token) {
  for (let attempt = 0; attempt < 18; attempt++) {
    const result = await graph("GET", `/${id}`, { fields: "status", access_token: token });
    const phase = result.status?.publishing_phase;
    if (["complete", "completed"].includes(phase?.status)) return;
    if (phase?.status === "error") throw new Error("Facebook reported a publishing error. Check the Page before retrying.");
    await sleep(5000);
  }
  throw new Error("Facebook accepted the video but has not confirmed it is live yet. Check the Page before retrying.");
}

/* Facebook Page: a video, or photos (one or several) in one post. The final
   call creates the post, so a failure from then on is uncertain. */
async function publishFacebook(acc, media, caption, cp = {}, save = async () => {}, options = {}) {
  const token = decrypt(acc.pageToken);
  const page = acc.pageId;
  if (/story|stories|reel/i.test(options.format || "")) return require("./socialMetaFormats").publishFacebookFormat({ page, token, media, caption, format: options.format, checkpoint: cp, save }, { graph, isVideo, waitForPublished: waitForFacebookPublished, uploadHosted: require("./metaUploads").uploadHosted, uploadCover: (id, url, access) => require("./metaUploads").uploadCover(id, url, access, FB_GRAPH) });
  let postId;
  const mark = async () => { cp.publishCalled = true; await save(cp); };
  const video = media.find(isVideo);
  if (video && media.length > 1) throw new Error("Facebook video publishing supports one video per post in Finvera. Split the media into separate posts.");
  if (video) {
    await mark();
    const v = await graph("POST", `/${page}/videos`, { file_url: video.url, description: caption, access_token: token });
    postId = v.post_id || v.id;
  } else if (media.length) {
    const ids = [];
    for (const m of media.slice(0, 10)) ids.push((await graph("POST", `/${page}/photos`, { url: m.url, published: "false", access_token: token })).id);
    await mark();
    const p = await graph("POST", `/${page}/feed`, { message: caption, attached_media: JSON.stringify(ids.map((id) => ({ media_fbid: id }))), access_token: token });
    postId = p.id;
  } else {
    await mark();
    postId = (await graph("POST", `/${page}/feed`, { message: caption, access_token: token })).id;
  }
  const info = await graph("GET", `/${postId}`, { fields: "permalink_url", access_token: token }).catch(() => ({}));
  return { id: postId, url: info.permalink_url || `https://www.facebook.com/${postId}` };
}

/* ── Numbers for Social studio (permissions already granted for publishing) ── */
async function fetchProfile(acc) {
  const token = decrypt(acc.pageToken);
  const out = {};
  const fb = await graph("GET", `/${acc.pageId}`, { fields: "name,followers_count,fan_count,picture.type(large){url}", access_token: token }).catch(() => null);
  if (!fb) { const identity = await profilePicture(acc, "facebook").catch(() => null); if (identity) { const { platform, ...data } = identity; out.facebook = data; } }
  if (fb) out.facebook = { followers: fb.followers_count ?? fb.fan_count ?? null, name: fb.name, picture: fb.picture?.data?.url || null };
  if (acc.igUserId) {
    const ig = await graph("GET", `/${acc.igUserId}`, { fields: "username,followers_count,media_count,profile_picture_url", access_token: token }).catch(() => null);
    if (!ig) { const identity = await profilePicture(acc, "instagram").catch(() => null); if (identity) { const { platform, ...data } = identity; out.instagram = data; } }
    if (ig) out.instagram = { followers: ig.followers_count ?? null, posts: ig.media_count ?? null, username: ig.username, picture: ig.profile_picture_url || null };
  }
  return out;
}

async function profilePicture(acc, platform) {
  const token = decrypt(acc.pageToken);
  if (platform === "instagram") {
    if (!acc.igUserId) throw new Error("No Instagram account is linked to this brand.");
    const row = await graph("GET", `/${acc.igUserId}`, { fields: "username,profile_picture_url", access_token: token });
    return { platform, username: row.username, picture: row.profile_picture_url || null };
  }
  const row = await graph("GET", `/${acc.pageId}`, { fields: "name,picture.type(large){url}", access_token: token });
  return { platform, name: row.name, picture: row.picture?.data?.url || null };
}

/* Likes / comments (and shares on Facebook) of one published post. */
async function fetchPostMetrics(acc, platform, remoteId) {
  const token = decrypt(acc.pageToken);
  if (platform === "instagram") {
    const m = await graph("GET", `/${remoteId}`, { fields: "like_count,comments_count,media_type,media_url,thumbnail_url,permalink", access_token: token });
    return { likes: m.like_count ?? 0, comments: m.comments_count ?? 0, picture: m.thumbnail_url || m.media_url || null, url: m.permalink || null };
  }
  const m = await graph("GET", `/${remoteId}`, { fields: "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares,full_picture,permalink_url", access_token: token });
  return { likes: m.reactions?.summary?.total_count ?? 0, comments: m.comments?.summary?.total_count ?? 0, shares: m.shares?.count ?? 0, picture: m.full_picture || null, url: m.permalink_url || null };
}

/* Full profile of one channel, for the Profile panel. */
async function profileDetails(acc, platform) {
  const token = decrypt(acc.pageToken);
  if (platform === "instagram") {
    if (!acc.igUserId) throw new Error("No Instagram account is linked to this brand's Facebook Page.");
    const ig = await graph("GET", `/${acc.igUserId}`, { fields: "username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url", access_token: token });
    return { platform, username: ig.username, name: ig.name || "", biography: ig.biography || "", website: ig.website || "", followers: ig.followers_count ?? null, following: ig.follows_count ?? null, posts: ig.media_count ?? null, picture: ig.profile_picture_url || null, link: `https://www.instagram.com/${ig.username}/` };
  }
  const fb = await graph("GET", `/${acc.pageId}`, { fields: "name,about,description,website,phone,emails,category,link,followers_count,fan_count,picture.type(large){url}", access_token: token });
  return { platform, name: fb.name || "", about: fb.about || "", description: fb.description || "", website: fb.website || "", phone: fb.phone || "", email: (fb.emails || [])[0] || "", category: fb.category || "", followers: fb.followers_count ?? fb.fan_count ?? null, picture: fb.picture?.data?.url || null, link: fb.link || `https://www.facebook.com/${acc.pageId}` };
}

/* Update a Facebook Page's details (needs pages_manage_metadata). */
async function updatePage(acc, fields) {
  const token = decrypt(acc.pageToken);
  const params = { access_token: token };
  for (const k of ["about", "description", "website", "phone"]) if (fields[k] !== undefined) params[k] = String(fields[k] || "").slice(0, k === "description" ? 5000 : 255);
  if (fields.email !== undefined) params.emails = JSON.stringify(fields.email ? [String(fields.email).trim()] : []);
  return graph("POST", `/${acc.pageId}`, params);
}

module.exports = { profilePicture, profileDetails, updatePage, fetchProfile, fetchPostMetrics, configured, redirectUri, SCOPES, encrypt, decrypt, buildAuthUrl, exchangeCode, listPages, publishInstagram, publishFacebook, isVideo, graph };
