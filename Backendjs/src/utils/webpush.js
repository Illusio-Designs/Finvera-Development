/* Web Push sender — built on Node's own crypto, no npm dependency.

   The FTP deploy uploads code but not node_modules, so instead of the
   `web-push` package this implements the two standards it wraps:
     • RFC 8291 — message encryption (aes128gcm, ECDH P-256 + HKDF)
     • RFC 8292 — VAPID: an ES256-signed JWT that identifies this server

   VAPID keys come from env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, base64url)
   or, if unset, are generated once and kept in the settings table (group
   "system", never public and read-only through the API). */

const crypto = require("crypto");
const https = require("https");
const { URL } = require("url");
const { Setting } = require("../models");

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

let keys = null; // { publicKey: b64u(65 bytes), privateKey: b64u(32 bytes), subject }

function generateKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

async function getKeys() {
  if (keys) return keys;
  const subject = process.env.VAPID_SUBJECT || "mailto:finverasolutionsllp@gmail.com";
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY.trim(), privateKey: process.env.VAPID_PRIVATE_KEY.trim(), subject };
    return keys;
  }
  const [row, created] = await Setting.findOrCreate({
    where: { key: "push.vapid" },
    defaults: { key: "push.vapid", value: JSON.stringify(generateKeys()), group: "system", isPublic: false },
  });
  let stored = {};
  try { stored = JSON.parse(row.value || "{}"); } catch { /* regenerate below */ }
  if (!stored.publicKey || !stored.privateKey) {
    stored = generateKeys();
    await row.update({ value: JSON.stringify(stored), group: "system", isPublic: false });
  } else if (!created && (row.group !== "system" || row.isPublic)) {
    await row.update({ group: "system", isPublic: false });
  }
  keys = { ...stored, subject };
  return keys;
}

/* A signing key object for the raw P-256 private key (+ its public point). */
function privateKeyObject(privB64u, pubB64u) {
  const pub = fromB64u(pubB64u);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: privB64u, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
}

/* RFC 8292: Authorization header value for one push service origin. */
function vapidAuth(endpoint, k) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: k.subject }));
  const sig = crypto.sign("sha256", Buffer.from(`${header}.${claims}`), { key: privateKeyObject(k.privateKey, k.publicKey), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${k.publicKey}`;
}

/* RFC 8291: encrypt `plaintext` for a subscription (p256dh + auth from the
   browser). `local` and `salt` are only passed by the RFC test vector. */
function encrypt(plaintext, p256dh, auth, local, salt) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const ecdh = crypto.createECDH("prime256v1");
  if (local) ecdh.setPrivateKey(fromB64u(local)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const s = salt ? fromB64u(salt) : crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, s, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, s, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([s, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

function post(endpoint, headers, body) {
  return new Promise((resolve) => {
    const u = new URL(endpoint);
    const req = https.request({ method: "POST", hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: { ...headers, "Content-Length": body.length }, timeout: 15000 }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(0));
    req.end(body);
  });
}

/* Send one message. Returns the push service's HTTP status (201 = queued,
   404/410 = subscription is gone and should be deleted, 0 = network error). */
async function send(sub, message, { ttl = 24 * 3600, urgency = "high", topic } = {}) {
  const k = await getKeys();
  const body = encrypt(JSON.stringify(message), sub.p256dh, sub.auth);
  const headers = {
    TTL: String(ttl),
    Urgency: urgency,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    Authorization: vapidAuth(sub.endpoint, k),
  };
  if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return post(sub.endpoint, headers, body);
}

module.exports = { getKeys, send, encrypt, vapidAuth, b64u, fromB64u };
