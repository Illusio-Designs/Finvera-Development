const crypto = require("node:crypto");
const multer = require("multer");
const { fail } = require("./payroll");

const kinds = ["aadhaar", "pan", "cheque", "offerLetter"];
const extensions = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const maxFileBytes = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes + 1, files: kinds.length, fields: 1, fieldSize: 32 * 1024, parts: kinds.length + 2 },
}).fields(kinds.map(name => ({ name, maxCount: 1 })));

function receiveDocuments(req, res, next) {
  if (!req.is("multipart/form-data")) return next();
  upload(req, res, error => {
    if (error) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return next(fail(tooLarge ? 413 : 400, tooLarge ? "Employee documents must be 2 MB or smaller." : "Send one file per employee document and valid employee details."));
    }
    try {
      req.body = JSON.parse(req.body?.details);
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new Error();
    } catch {
      return next(fail(400, "Enter valid employee details."));
    }
    next();
  });
}

function fileType(bytes) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

function readFiles(files) {
  return kinds.flatMap(kind => {
    const file = files?.[kind]?.[0];
    if (!file) return [];
    const bytes = file.buffer;
    if (bytes.length > maxFileBytes) throw fail(413, "Employee documents must be 2 MB or smaller.");
    const mimeType = fileType(bytes);
    if (!mimeType) throw fail(400, "Employee documents must be PDF, JPG, or PNG files.");
    return [{ kind, mimeType, bytes }];
  });
}

// Keep the selected storage secret stable so existing files can still be read after deployment.
function key() {
  const secret = process.env.EMPLOYEE_DOCUMENT_ENC_KEY || process.env.TOKEN_ENC_KEY || process.env.JWT_SECRET;
  if (!secret) throw fail(503, "Employee document storage is unavailable.");
  return crypto.hkdfSync("sha256", secret, "", "finvera/employee-documents/v1", 32);
}

const context = (employeeId, kind, mimeType) => Buffer.from(JSON.stringify([employeeId, kind, mimeType]));

function encryptDocument(employeeId, { kind, mimeType, bytes }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(context(employeeId, kind, mimeType));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decryptDocument({ employeeId, kind, mimeType, contents }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), contents.subarray(0, 12));
  decipher.setAAD(context(employeeId, kind, mimeType));
  decipher.setAuthTag(contents.subarray(12, 28));
  return Buffer.concat([decipher.update(contents.subarray(28)), decipher.final()]);
}

module.exports = { kinds, extensions, receiveDocuments, readFiles, encryptDocument, decryptDocument };
