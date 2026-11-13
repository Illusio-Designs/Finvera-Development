/* Pure workflow definition. Persistence, permissions, media preflight and
   publication verification stay in the transaction that applies the move. */
const TRANSITIONS = Object.freeze({
  planned: Object.freeze({ START: "production", REQUEST_CLIENT: "client" }),
  client: Object.freeze({ START: "production", RETURN_TO_PLAN: "planned" }),
  production: Object.freeze({ SUBMIT: "approval", RETURN_TO_PLAN: "planned", REQUEST_CLIENT: "client" }),
  approval: Object.freeze({ APPROVE: "ready", REQUEST_CHANGES: "production" }),
  ready: Object.freeze({ REVOKE_APPROVAL: "approval", CONFIRM_PUBLICATION: "posted" }),
  posted: Object.freeze({}),
});
const STATES = Object.freeze(Object.keys(TRANSITIONS));
const NEXT_EVENT = Object.freeze({ planned: "START", client: "START", production: "SUBMIT", approval: "APPROVE" });
const isState = (value) => Object.hasOwn(TRANSITIONS, value);
const transition = (state, event) => isState(state) && Object.hasOwn(TRANSITIONS[state], event) ? TRANSITIONS[state][event] : null;
const canMove = (from, to) => isState(from) && isState(to) && (from === to || Object.values(TRANSITIONS[from]).includes(to));
const nextStage = (state) => transition(state, NEXT_EVENT[state]);
const isVideoFormat = (format) => /reel|video/i.test(String(format || ""));
const makerFor = (format) => isVideoFormat(format) ? "video" : "graphic";
const roleFor = (state, format) => ["approval", "ready", "posted"].includes(state) ? "social" : makerFor(format);
const stepFor = (state, _legacyStep, format) => state === "production" ? makerFor(format) : null;

module.exports = { STATES, TRANSITIONS, isState, transition, canMove, nextStage, isVideoFormat, makerFor, roleFor, stepFor };
