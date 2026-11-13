const { createSerialQueue } = require("../utils/asyncMachine");
/* Browser-only WebP delivery. Original upload URLs and social publishing bytes
   stay available; no remote URLs are fetched and SVG/animation stay intact. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { getSharp } = require('../utils/images');
const ROOT = path.resolve(__dirname, '../../uploads');
const pending = new Map();
const conversionQueue = createSerialQueue();
async function variantFor(file, stat) {
  const sharp = getSharp(); if (!sharp) return null;
  const key = crypto.createHash('sha256').update(`${file}|${stat.size}|${stat.mtimeMs}`).digest('hex');
  const out = path.join(ROOT, '.webp-cache', key + '.webp');
  try { await fs.promises.access(out); return out; } catch {}
  if (pending.has(key)) return pending.get(key);
  const promise = conversionQueue.enqueue(async () => {
    const image = sharp(file, { limitInputPixels: 40000000 });
    const meta = await image.metadata();
    if ((meta.pages || 1) > 1 || !['jpeg','png','webp','avif','heif','gif'].includes(meta.format)) return null;
    const bytes = await image.rotate().webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer();
    await fs.promises.mkdir(path.dirname(out), { recursive: true });
    const temp = out + '.' + process.pid + '.tmp';
    await fs.promises.writeFile(temp, bytes); await fs.promises.rename(temp, out); return out;
  });
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
async function webpImages(req, res, next) {
  if (!['GET','HEAD'].includes(req.method)) return next();
  const accepts = req.get('accept') || '';
  if (!/(?:^|,)\s*image\/webp(?:[;,]|$)/i.test(accepts) || !req.accepts('image/webp')) return next();
  let relative;
  try { relative = decodeURIComponent(req.path).replace(/^\/+/, ''); } catch { return next(); }
  if (!/\.(jpe?g|png|avif|gif)$/i.test(relative) || relative.includes('\0') || relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) return next();
  // The original social URL must always serve JPEG to Meta. Only a browser
  // display URL explicitly opts in; saved media/publishing URLs stay original.
  if (relative.startsWith('social/') && req.query.display !== 'webp') return next();
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) return next();
  res.vary('Accept'); // Both negotiated representations must vary, including fallbacks.
  try {
    const real = await fs.promises.realpath(file);
    if (!real.startsWith(ROOT + path.sep)) return next();
    const stat = await fs.promises.stat(real); if (!stat.isFile()) return next();
    const output = await variantFor(real, stat); if (!output) return next();
    res.type('image/webp').set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(output, { dotfiles: 'allow' }, error => { if (error && !res.headersSent) next(error); });
  } catch { return next(); } // Existing image remains usable if conversion isn't available.
}
// Explicit API route also works when Apache serves /uploads files directly
// before Passenger/Express. It accepts local upload paths only.
async function imageDisplay(req, res) {
  const input = req.query.file;
  if (typeof input !== 'string' || !input.startsWith('/uploads/') || input.includes('\\') || input.includes('\0') || input.split('/').some(part => part.startsWith('.')) || !/\.(jpe?g|png|webp|gif|avif)$/i.test(input)) return res.status(400).json({ message: 'Choose a local uploaded raster image.' });
  const file = path.resolve(ROOT, input.slice('/uploads/'.length));
  if (!file.startsWith(ROOT + path.sep)) return res.status(400).json({ message: 'Invalid image path.' });
  try {
    const real = await fs.promises.realpath(file);
    if (!real.startsWith(ROOT + path.sep)) return res.status(404).json({ message: 'Image not found.' });
    const stat = await fs.promises.stat(real); if (!stat.isFile()) return res.status(404).json({ message: 'Image not found.' });
    let output = real;
    if (/(?:^|,)\s*image\/webp(?:[;,]|$)/i.test(req.get('accept') || '') && req.accepts('image/webp')) {
      try { output = await variantFor(real, stat) || real; } catch { /* Keep the original usable. */ }
    }
    res.vary('Accept').set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(output, { dotfiles: 'allow' }, error => { if (error && !res.headersSent) res.status(404).end(); });
  } catch { return res.status(404).json({ message: 'Image not found.' }); }
}
async function removeVariantsFor(file) {
  try {
    const stat = await fs.promises.stat(file);
    const key = crypto.createHash('sha256').update(`${file}|${stat.size}|${stat.mtimeMs}`).digest('hex');
    if (pending.has(key)) await pending.get(key).catch(() => {});
    await fs.promises.unlink(path.join(ROOT, '.webp-cache', key + '.webp')).catch(() => {});
  } catch { /* No original/variant remains. */ }
}
module.exports = { webpImages, variantFor, imageDisplay, removeVariantsFor };
