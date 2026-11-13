const { resetFailures } = require("./accountMachine");
function linkState(row, now = Date.now()) {
  if (!row) return "missing";
  if (row.usedAt) return "consumed";
  return new Date(row.expiresAt).getTime() < now ? "expired" : "usable";
}
function sessionRejection(payload, user, session) {
  if (!user || !user.active) return "account";
  if (payload.jti) return !session || session.revokedAt || Number(session.userId) !== Number(user.id) ? "session" : null;
  return user.tokensValidAfter && (payload.iat || 0) * 1000 < new Date(user.tokensValidAfter).getTime() ? "legacy" : null;
}
function credentialEvent(event, now = new Date()) {
  switch (event) {
    case "CHANGE_PASSWORD": return { passwordChangedAt: now, mustChangePassword: false };
    case "RESET_PASSWORD": return { passwordChangedAt: now, mustChangePassword: false, invitePending: false, ...resetFailures() };
    case "ADMIN_SET_PASSWORD": return { passwordChangedAt: now, invitePending: false, ...resetFailures() };
    default: throw new Error(`Unknown credential event: ${event}`);
  }
}
const revocation = (reason, now = new Date()) => ({ revokedAt: now, revokedReason: reason });
module.exports = { linkState, sessionRejection, credentialEvent, revocation };
