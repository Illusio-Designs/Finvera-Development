const stateOf = (user) => user.twoFactorEnabled ? "enabled" : user.twoFactorSecret ? "setup" : "disabled";
function configurationEvent(event, data = {}) {
  switch (event) {
    case "SETUP": return { twoFactorSecret: data.secret };
    case "ENABLE": return { twoFactorEnabled: true, twoFactorBackup: data.hashes };
    case "DISABLE": return { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackup: null };
    case "RENEW_CODES": return { twoFactorBackup: data.hashes };
    default: throw new Error(`Unknown second-factor event: ${event}`);
  }
}
function consumeBackup(hashes, hash) { return hashes.includes(hash) ? hashes.filter((item) => item !== hash) : null; }

// Deliberately process-local, matching the existing replay policy. Persisting
// replay claims across workers is a separate security/behavior change.
function createReplayGuard() {
  const steps = new Map(), tickets = new Map();
  return {
    rememberStep(userId, step) { steps.set(userId, step); },
    acceptStep(userId, step) {
      if (step == null || (steps.get(userId) || -1) >= step) return false;
      steps.set(userId, step); return true;
    },
    spendTicket(jti, expiresAtSeconds, now = Date.now()) {
      if (tickets.size > 1000) for (const [key, until] of tickets) if (until < now) tickets.delete(key);
      if (tickets.has(jti)) return false;
      tickets.set(jti, expiresAtSeconds * 1000); return true;
    },
  };
}
module.exports = { stateOf, configurationEvent, consumeBackup, createReplayGuard };
