const PLATFORMS = Object.freeze(["instagram", "facebook"]);
const array = (value) => { if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
function selectionState(selection, userId, now = Date.now()) {
  if (!selection) return "missing";
  if (selection.exp < now) return "expired";
  return selection.userId === userId ? "selectable" : "other-user";
}
function connectionEvent(event) {
  if (event === "CONNECT") return { status: "connected", lastError: null };
  if (event === "AUTH_FAILURE") return { status: "reconnect" };
  throw new Error(`Unknown social connection event: ${event}`);
}
function pausedAfter(current, platform, paused) {
  const next = new Set(array(current));
  if (paused) next.add(platform); else next.delete(platform);
  return [...next];
}
function targetsFor(post, account) {
  if (!account || account.status !== "connected") return [];
  const paused = array(account.paused);
  const connected = ["facebook", ...(account.igUserId ? ["instagram"] : [])].filter((platform) => !paused.includes(platform));
  const chosen = post.publishTo == null ? null : array(post.publishTo);
  return PLATFORMS.filter((platform) => connected.includes(platform) && (!chosen || chosen.includes(platform)));
}
module.exports = { PLATFORMS, selectionState, connectionEvent, pausedAfter, targetsFor };
