// The CRM deliberately permits direct moves between all six stages.
const STAGE_PROGRESS = Object.freeze({ new: 10, contacted: 35, qualified: 60, proposal: 85, won: 100, lost: 0 });
const STATES = Object.freeze(Object.keys(STAGE_PROGRESS));
const isOpen = (lead) => !["won", "lost"].includes(lead.stage);
const progressOfStage = (stage) => STAGE_PROGRESS[stage || "new"] ?? 0;
const wonAtAfter = (lead, now = new Date()) => lead.stage === "won" ? lead.wonAt || now : null;
function followUpState(lead, today) {
  if (!isOpen(lead)) return "closed";
  const date = lead.nextFollowUpAt;
  if (!date) return "unscheduled";
  return String(date) < today ? "overdue" : String(date) === today ? "today" : "future";
}
module.exports = { STATES, STAGE_PROGRESS, isOpen, progressOfStage, wonAtAfter, followUpState };
