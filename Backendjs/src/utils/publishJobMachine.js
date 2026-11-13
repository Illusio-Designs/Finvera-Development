/* Job events are applied under the caller's existing database locks/lease.
   A graph edge never replaces approval, absence-confirmation or scope guards. */
const TRANSITIONS = Object.freeze(Object.fromEntries(Object.entries({
  scheduled: { CLAIM: "publishing", CANCEL: "cancelled", SYNC: "scheduled", EXPIRE: "missed", CONFIRM: "published", PUBLISH_NOW: "scheduled" },
  publishing: { SUCCESS: "published", FAIL: "failed", UNCERTAIN: "check", RETRY_LATER: "scheduled", RECOVER_SAFE: "scheduled", RECOVER_UNCERTAIN: "check" },
  published: { CONFIRM: "published" },
  failed: { RETRY: "scheduled", CANCEL: "cancelled", CONFIRM: "published", PUBLISH_NOW: "scheduled" },
  check: { RETRY: "scheduled", CONFIRM: "published" },
  missed: { RETRY: "scheduled", CANCEL: "cancelled", SYNC: "scheduled", EXPIRE: "missed", CONFIRM: "published", PUBLISH_NOW: "scheduled" },
  cancelled: { CANCEL: "cancelled", SYNC: "scheduled", EXPIRE: "missed", CONFIRM: "published", PUBLISH_NOW: "scheduled" },
}).map(([state, events]) => [state, Object.freeze(events)])));

function transition(state, event) {
  const events = Object.hasOwn(TRANSITIONS, state) ? TRANSITIONS[state] : null;
  if (!events || !Object.hasOwn(events, event)) throw Object.assign(new Error(`Cannot ${event} a ${state} publishing job.`), { status: 409 });
  return events[event];
}

// Malformed persisted checkpoints must never authorize a potentially duplicate
// write. This preserves the operator endpoints' existing conservative parser.
function checkpointOf(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value || "{}"); } catch { return { publishCalled: true }; }
}
function retryKind(job) {
  if (!["failed", "check", "missed"].includes(job.status)) return "forbidden";
  const cp = checkpointOf(job.checkpoint);
  if (job.platform === "facebook" && cp.publishedConfirmed === true && cp.coverPending === true && cp.publishedId && cp.videoId) return "cover";
  return job.status === "check" || cp.publishCalled ? "verify" : "resume";
}
function recoveryEvent(checkpoint) { return checkpoint.publishCalled ? "RECOVER_UNCERTAIN" : "RECOVER_SAFE"; }
function publicationState(jobs) {
  const intended = jobs.filter((job) => job.status !== "cancelled");
  if (!intended.length) return "none";
  const published = intended.filter((job) => job.status === "published").length;
  return published === intended.length ? "complete" : published ? "partial" : "pending";
}
module.exports = { TRANSITIONS, transition, checkpointOf, retryKind, recoveryEvent, publicationState };
