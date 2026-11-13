const { lazyState } = require("./asyncMachine");
/* Image compression for uploads (sharp, loaded lazily).

   optimizeUpload(file, { mode })   file = multer file { path, filename, size, mimetype }
     mode "site"   → JPEG → optimized JPEG, PNG / WebP → WebP (alpha kept);
                   when nothing needs resizing and the result isn't smaller,
                   the original is kept (same name and format)
     mode "social" → always JPEG (Instagram publishing needs JPEG; transparency
                     goes on white)
   Resized to at most 2000 px on the long edge, turned upright from the EXIF
   orientation, metadata (EXIF / GPS) stripped, plus a 480 px thumbnail next to
   it ("<name>-thumb.<ext>"). Returns { filename, bytes, originalBytes, width,
   height, thumbFilename } or null — null means "leave the original exactly
   as uploaded" (sharp missing on the host, not a JPEG/PNG/WebP, animated, or
   any error). Videos, GIF, SVG and AVIF are never touched.

   optimizeInPlace(fullPath, { mode }) — for files uploaded before this
   existed: same name and format (links in the database keep working), only
   replaced when smaller; adds the thumbnail. */

const fs = require("fs");
const path = require("path");

const MAX_EDGE = Number(process.env.IMAGE_MAX_EDGE || 2000);
const THUMB_EDGE = 480;
const JPEG_Q = 82, SOCIAL_JPEG_Q = 88, WEBP_Q = 86;
const RASTER = /\.(jpe?g|png|webp)$/i;
const THUMB_RE = /-thumb\.(jpe?g|png|webp)$/i;

let sharpMod; // undefined = not tried yet, null = unavailable
function getSharp() {
  if (lazyState(sharpMod) !== "uninitialized") return sharpMod;
  if (String(process.env.IMAGE_OPTIMIZE || "").toLowerCase() === "false") return (sharpMod = null);
  try {
    sharpMod = require("sharp");
    sharpMod.cache(false);       // shared hosting: keep memory low
    sharpMod.concurrency(1);
  } catch (e) {
    console.warn("\x1b[33m⚠ sharp not available — uploads are stored as they are:\x1b[0m", e.message);
    sharpMod = null;
  }
  return sharpMod;
}

const thumbNameOf = (filename) => {
  const ext = path.extname(filename);
  return `${path.basename(filename, ext)}-thumb${ext}`;
};

function encoder(img, fmt, social) {
  if (fmt === "jpeg") return img.jpeg({ quality: social ? SOCIAL_JPEG_Q : JPEG_Q, mozjpeg: true, progressive: true });
  if (fmt === "png") return img.png({ compressionLevel: 9, adaptiveFiltering: true });
  return img.webp({ quality: WEBP_Q, alphaQuality: 100, effort: 4 });
}

/* Output format for a fresh upload. */
function targetFormat(inFmt, mode) {
  if (mode === "social") return "jpeg";
  return inFmt === "jpeg" ? "jpeg" : "webp";
}
const EXT = { jpeg: ".jpg", webp: ".webp", png: ".png" };

async function render(sharp, input, fmt, social, edge) {
  let img = sharp(input, { failOn: "none" }).rotate(); // EXIF orientation applied, then dropped
  img = img.resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
  if (fmt === "jpeg") img = img.flatten({ background: "#ffffff" });
  return encoder(img, fmt, social).toBuffer({ resolveWithObject: true });
}

async function optimizeUpload(file, { mode = "site" } = {}) {
  try {
    if (!file || !file.path || !RASTER.test(file.filename || file.path)) return null;
    if (file.mimetype && !/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) return null;
    const sharp = getSharp();
    if (!sharp) return null;
    const input = await fs.promises.readFile(file.path);
    const meta = await sharp(input).metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages || 1) > 1) return null; // animated → leave it
    const fmt = targetFormat(meta.format, mode);
    const social = mode === "social";
    const main = await render(sharp, input, fmt, social, MAX_EDGE);
    const dir = path.dirname(file.path);
    const base = path.basename(file.filename, path.extname(file.filename));
    let filename = `${base}${EXT[fmt]}`;
    let out = main;
    // No resize / rotation needed and the result isn't smaller → keep the
    // original file as uploaded (social images only when already JPEG).
    const resized = (meta.width || 0) > MAX_EDGE || (meta.height || 0) > MAX_EDGE;
    const rotated = (meta.orientation || 1) > 1;
    const keepable = !social || meta.format === "jpeg";
    if (keepable && !resized && !rotated && main.data.length >= input.length) { out = null; filename = file.filename; }
    if (out) {
      const tmp = path.join(dir, `${filename}.tmp`);
      await fs.promises.writeFile(tmp, out.data);
      await fs.promises.rename(tmp, path.join(dir, filename));
      if (filename !== file.filename) await fs.promises.unlink(file.path).catch(() => {});
    }
    const thumb = await render(sharp, input, out ? fmt : meta.format, social, THUMB_EDGE);
    const thumbFilename = thumbNameOf(filename);
    await fs.promises.writeFile(path.join(dir, thumbFilename), thumb.data);
    return {
      filename,
      bytes: out ? out.data.length : input.length,
      originalBytes: input.length,
      width: out ? out.info.width : meta.width,
      height: out ? out.info.height : meta.height,
      thumbFilename,
    };
  } catch (e) {
    console.warn("image optimize (kept original):", e.message);
    return null;
  }
}

async function optimizeInPlace(fullPath, { mode = "site" } = {}) {
  const sharp = getSharp();
  if (!sharp) throw new Error("sharp is not installed on this server (Run NPM Install).");
  const name = path.basename(fullPath);
  const input = await fs.promises.readFile(fullPath);
  const meta = await sharp(input).metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages || 1) > 1) return { name, skipped: "format" };
  const fmt = meta.format; // keep the format: database links point at this name
  const social = mode === "social";
  const main = await render(sharp, input, fmt, social, MAX_EDGE);
  let bytes = input.length;
  if (main.data.length < input.length) {
    const tmp = `${fullPath}.tmp`;
    await fs.promises.writeFile(tmp, main.data);
    await fs.promises.rename(tmp, fullPath);
    bytes = main.data.length;
  }
  const thumb = await render(sharp, input, fmt, social, THUMB_EDGE);
  await fs.promises.writeFile(path.join(path.dirname(fullPath), thumbNameOf(name)), thumb.data);
  return { name, originalBytes: input.length, bytes };
}

/* Files in `dir` that still need optimizeInPlace (no thumbnail yet). */
async function pendingIn(dir) {
  let names;
  try { names = await fs.promises.readdir(dir); } catch { return []; }
  const set = new Set(names);
  return names.filter((n) => RASTER.test(n) && !THUMB_RE.test(n) && !set.has(thumbNameOf(n))).sort();
}

module.exports = { optimizeUpload, optimizeInPlace, pendingIn, thumbNameOf, getSharp, THUMB_RE };
