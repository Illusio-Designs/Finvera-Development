// Completion belongs to the outgoing assignee, not the person receiving work.
// Starting production, scheduling and reassignment are not completed work.
function completedAssignments(events) {
  const completed = new Map();
  for (const event of events) {
    const makerDone = event.from === "production" && ["approval", "ready", "posted"].includes(event.to);
    const postingDone = event.from === "ready" && event.to === "posted";
    if ((!makerDone && !postingDone) || !event.who) continue;
    const key = `${event.postId}|${Number(event.who)}`;
    // Repeated handoffs/rework must not turn one person's post into many deliveries.
    completed.set(key, event);
  }
  return [...completed.values()];
}

module.exports = { completedAssignments };
