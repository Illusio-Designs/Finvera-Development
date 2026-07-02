const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const allowed = /jpeg|jpg|png|webp|gif|svg|avif/;
function fileFilter(_req, file, cb) {
  const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && /image\//.test(file.mimetype);
  cb(ok ? null : new Error("Only image files are allowed."), ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
