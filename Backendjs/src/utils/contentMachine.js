const PUBLICATION_STATES = Object.freeze(["draft", "published"]);
const isPublicationState = (state) => PUBLICATION_STATES.includes(state);
const isPublished = (item) => item.status === "published";
function reportRevision(row, body, summary) {
  const hasSummary = "summary" in body;
  // Explicit review can approve the supplied commentary in the same action;
  // otherwise changing commentary invalidates the previous review.
  const status = body.status === "reviewed" ? "reviewed"
    : hasSummary && summary !== row.summary ? "draft" : body.status || row.status;
  return { summary: hasSummary ? summary : row.summary, status, version: row.version + 1 };
}
module.exports = { PUBLICATION_STATES, isPublicationState, isPublished, reportRevision };
