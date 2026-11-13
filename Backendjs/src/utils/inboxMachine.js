function stateOf(row) { return row.isSpam ? "spam" : row.isRead ? "read" : "unread"; }
function spamPatch(row, spam) {
  return spam ? { isSpam: true, spamReason: row.spamReason || "Marked by hand", isRead: true }
    : { isSpam: false, spamReason: null, isRead: false };
}
function conversionState(row, existingLead) {
  if (!row) return "missing";
  if (row.isSpam) return "blocked";
  return row.leadId && existingLead ? "linked" : "unconverted";
}
function deliveryState(result) {
  if (result.sent) return "sent";
  return ["not-configured", "nodemailer-missing"].includes(result.reason) ? "unavailable" : "failed";
}
module.exports = { stateOf, spamPatch, conversionState, deliveryState };
