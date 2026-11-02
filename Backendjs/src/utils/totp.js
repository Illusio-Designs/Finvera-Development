/* TOTP (RFC 6238: HMAC-SHA1, 30 s steps, 6 digits) with Node crypto only.
   Secrets are base32 (what authenticator apps expect) and stored encrypted
   (AES-256-GCM, key derived from TOTP_ENC_KEY, else JWT_SECRET). */
const crypto = require("crypto");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffff; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const s = String(str).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out = [];
  for (const ch of s) {
    value = ((value << 5) | B32.indexOf(ch)) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1e6).padStart(6, "0");
}

/* Returns the matched time step (number) or null. ±window steps. */
function verify(secret, code, { window = 1, at = Date.now() } = {}) {
  const c = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c) || !secret) return null;
  const step = Math.floor(at / 30000);
  for (let w = -window; w <= window; w++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, step + w)), Buffer.from(c))) return step + w;
  }
  return null;
}

function otpauthUrl(secret, account, issuer = "Finvera") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/* ── At-rest encryption of the secret ── */
const key = () => crypto.createHash("sha256").update(`totp:${process.env.TOTP_ENC_KEY || process.env.JWT_SECRET || ""}`).digest();
function seal(secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}
function open(stored) {
  if (!stored) return null;
  if (!String(stored).startsWith("v1:")) return stored;
  try {
    const [, iv, tag, ct] = String(stored).split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

/* ── Backup codes: 8 × "xxxx-xxxx" (hex), stored only as sha256 ── */
const normBackup = (c) => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const hashBackup = (c) => crypto.createHash("sha256").update(`bk:${normBackup(c)}`).digest("hex");
function makeBackupCodes(n = 8) {
  const codes = [];
  for (let i = 0; i < n; i++) { const h = crypto.randomBytes(4).toString("hex"); codes.push(`${h.slice(0, 4)}-${h.slice(4)}`); }
  return { codes, hashes: codes.map(hashBackup) };
}

module.exports = { base32Encode, base32Decode, generateSecret, hotp, verify, otpauthUrl, seal, open, makeBackupCodes, hashBackup, normBackup };
