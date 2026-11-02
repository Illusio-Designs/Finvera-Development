const path = require("path");
const { asyncHandler } = require("../utils/crud");
const { optimizeUpload, optimizeInPlace, pendingIn, getSharp } = require("../utils/images");
const { UPLOAD_DIR } = require("../middleware/upload");

function fileUrl(req, filename, sub = "") {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/uploads/${sub ? `${sub}/` : ""}${filename}`;
}

/* One stored upload → response fields. JPEG/PNG/WebP are compressed first
   (see utils/images.js); anything else — or a host without sharp — is
   stored exactly as uploaded and reports thumbUrl null. */
async function describe(req, f, { mode = "site", sub = "" } = {}) {
  const o = await optimizeUpload(f, { mode });
  const filename = o ? o.filename : f.filename;
  return {
    url: fileUrl(req, filename, sub),
    filename,
    size: o ? o.bytes : f.size,
    thumbUrl: o ? fileUrl(req, o.thumbFilename, sub) : null,
    width: o ? o.width : null,
    height: o ? o.height : null,
    bytes: o ? o.bytes : f.size,
    originalBytes: o ? o.originalBytes : f.size,
  };
}

/* Single image upload → { url, filename, size, thumbUrl, width, height, bytes, originalBytes } */
const uploadOne = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded (field name: 'file')." });
  res.status(201).json(await describe(req, req.file));
});

/* Multiple image upload → { urls: [], items: [{ url, thumbUrl, … }] } */
const uploadMany = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ message: "No files uploaded (field name: 'files')." });
  const items = [];
  for (const f of req.files) items.push(await describe(req, f)); // one at a time: low memory on shared hosting
  res.status(201).json({ urls: items.map((i) => i.url), items });
});

/* POST /api/uploads/optimize-existing?limit=20 (admin)
   Compresses images uploaded before compression existed, a batch per call
   (same file names and formats, so saved links keep working; a file is only
   replaced when the result is smaller) and adds their thumbnails. Files
   that already have a thumbnail are skipped. Call again while remaining > 0. */
const optimizeExisting = asyncHandler(async (req, res) => {
  if (!getSharp()) return res.status(503).json({ message: "Image compression isn't available on this server yet (run NPM Install in cPanel)." });
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.body?.limit, 10) || 20));
  const dirs = [{ dir: UPLOAD_DIR, mode: "site" }, { dir: path.join(UPLOAD_DIR, "social"), mode: "social" }];
  const done = [], errors = [];
  let remaining = 0, savedBytes = 0;
  for (const { dir, mode } of dirs) {
    const todo = await pendingIn(dir);
    for (const name of todo) {
      if (done.length + errors.length >= limit) { remaining++; continue; }
      try {
        const r = await optimizeInPlace(path.join(dir, name), { mode });
        if (r.bytes != null) savedBytes += r.originalBytes - r.bytes;
        done.push(r);
      } catch (e) { errors.push({ name, error: e.message }); }
    }
  }
  res.json({ processed: done.length, savedBytes, remaining, errors, items: done });
});

module.exports = { uploadOne, uploadMany, optimizeExisting, describe };
