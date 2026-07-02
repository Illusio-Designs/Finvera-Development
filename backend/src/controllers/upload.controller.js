const { asyncHandler } = require("../utils/crud");

function fileUrl(req, filename) {
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/uploads/${filename}`;
}

/* Single image upload → { url } */
const uploadOne = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded (field name: 'file')." });
  res.status(201).json({ url: fileUrl(req, req.file.filename), filename: req.file.filename, size: req.file.size });
});

/* Multiple image upload → { urls: [] } */
const uploadMany = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ message: "No files uploaded (field name: 'files')." });
  res.status(201).json({ urls: req.files.map((f) => fileUrl(req, f.filename)) });
});

module.exports = { uploadOne, uploadMany };
