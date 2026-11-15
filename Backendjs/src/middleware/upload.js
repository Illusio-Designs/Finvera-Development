const multer = require("multer");
const path = require("path");
const crypto = require("node:crypto");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    cb(null, `${base}-${crypto.randomUUID()}${ext}`);
  },
});

const types = { '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'], '.webp': ['image/webp'], '.gif': ['image/gif'], '.svg': ['image/svg+xml'], '.avif': ['image/avif'] };
function fileFilter(_req, file, cb) {
  const ok = types[path.extname(file.originalname).toLowerCase()]?.includes(String(file.mimetype).toLowerCase());
  const error = ok ? null : Object.assign(new Error("Choose a supported image with a matching file type."), { status: 400 });
  cb(error, !!ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
