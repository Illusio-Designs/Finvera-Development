const https = require('https');
const fs = require('fs/promises');
const path = require('path');
const { UPLOAD_DIR } = require('../middleware/upload');
function send(url, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers, timeout: 60000 }, res => {
      let raw = ''; res.on('data', chunk => { raw += chunk; }); res.on('end', () => {
        let data; try { data = JSON.parse(raw || '{}'); } catch { return reject(new Error('Meta returned an unreadable upload response.')); }
        if (res.statusCode >= 400 || data.error || data.success === false) { const error = new Error(data.error?.message || `Meta upload failed (${res.statusCode}).`); error.meta = data.error; reject(error); } else resolve(data);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Meta upload timeout.'))); req.on('error', reject); req.end(body);
  });
}
async function uploadHosted(uploadUrl, fileUrl, token) {
  const url = new URL(uploadUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'rupload.facebook.com' || url.username || url.password || !url.pathname.startsWith('/video-upload/')) throw new Error('Meta returned an invalid video upload destination.');
  return send(url, { Authorization: `OAuth ${token}`, file_url: fileUrl }, undefined);
}
async function coverBytes(urlString, { publicUrl = process.env.PUBLIC_URL, uploadDir = UPLOAD_DIR } = {}) {
  const url = new URL(urlString), origin = new URL(publicUrl).origin;
  const match = url.origin === origin && /^\/uploads\/social\/([^/]+)$/.exec(url.pathname);
  if (!match) throw new Error('Upload the Facebook Reel cover inside Finvera before publishing.');
  const name = decodeURIComponent(match[1]);
  if (path.basename(name) !== name || name.includes('\\')) throw new Error('Invalid cover filename.');
  const root = await fs.realpath(path.join(uploadDir, 'social')), filename = await fs.realpath(path.join(root, name));
  if (path.dirname(filename) !== root) throw new Error('Invalid cover file location.');
  const handle = await fs.open(filename, 'r');
  try {
    const stat = await handle.stat(); if (!stat.isFile() || stat.size > 10 * 1024 * 1024 || stat.size < 3) throw new Error('Use a cover image under 10 MB.');
    const bytes = await handle.readFile(); if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Re-upload the cover as a JPEG image.'); return bytes;
  } finally { await handle.close(); }
}
async function uploadCover(videoId, coverUrl, token, graphBase, options = {}) {
  const bytes = await coverBytes(coverUrl, options), boundary = `finvera-${require('crypto').randomBytes(16).toString('hex')}`;
  const field = (name, value) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  const body = Buffer.concat([field('access_token', token), field('is_preferred', 'true'), Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="cover.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return send(new URL(`${graphBase}/${encodeURIComponent(videoId)}/thumbnails`), { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }, body);
}
module.exports = { uploadHosted, uploadCover, coverBytes };
