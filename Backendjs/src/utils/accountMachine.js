const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const isLocked = (user, now = Date.now()) => !!user.lockedUntil && new Date(user.lockedUntil).getTime() > now;
function statusOf(user, now = Date.now()) {
  if (!user.active) return "deactivated";
  if (user.invitePending) return "invited";
  return isLocked(user, now) ? "locked" : "active";
}
const resetFailures = () => ({ failedLogins: 0, firstFailedAt: null, lockedUntil: null });
function failureAfter(user, now = Date.now()) {
  const start = user.firstFailedAt ? new Date(user.firstFailedAt).getTime() : 0;
  const patch = !start || now - start > FAIL_WINDOW_MS
    ? { failedLogins: 1, firstFailedAt: new Date(now), lockedUntil: user.lockedUntil }
    : { failedLogins: (user.failedLogins || 0) + 1, firstFailedAt: user.firstFailedAt, lockedUntil: user.lockedUntil };
  const locked = patch.failedLogins >= MAX_FAILS;
  if (locked) Object.assign(patch, { lockedUntil: new Date(now + LOCK_MS), failedLogins: 0, firstFailedAt: null });
  return { patch, locked };
}
const afterPassword = (user) => user.twoFactorEnabled ? "second-factor" : "session";
module.exports = { MAX_FAILS, FAIL_WINDOW_MS, LOCK_MS, isLocked, statusOf, resetFailures, failureAfter, afterPassword };
