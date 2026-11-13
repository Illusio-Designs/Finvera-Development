const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
function load(name, globals = {}) {
  const context = { exports: {}, require: dependency => load(dependency.replace(/^\.\//, "")), ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/" + name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports;
}
const dialogs = load("dialogMachine");
const work = load("socialWorkMachine");
const editors = load("editorMachine");
const enquiries = load("enquiryMachine");
const resources = load("resourceMachine");
const notifications = load("notificationMachine");
const presentation = load("presentationMachine");
test("visibility polling stops on hide and cannot restart after cleanup", () => {
  const listeners = new Map(), document = { hidden: false, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  let timers = 0, calls = 0, cleared = 0;
  const { visibleInterval } = load("visibleInterval", { document, setInterval: () => ++timers, clearInterval: () => cleared++ });
  const cleanup = visibleInterval(() => calls++, 100);
  const callback = listeners.get("visibilitychange");
  document.hidden = true; callback(); assert.equal(cleared, 1);
  document.hidden = false; callback(); assert.equal(calls, 1); assert.equal(timers, 2);
  cleanup(); callback(); assert.equal(timers, 2); assert.equal(listeners.size, 0);
});
test("disclosure toggles, one-way reveals and dialog results retain their UI contracts", () => {
  assert.equal(presentation.disclosureTransition("closed", "TOGGLE"), "open");
  assert.equal(presentation.disclosureTransition("open", "CLOSE"), "closed");
  assert.equal(presentation.revealState(false, true, true), "visible");
  assert.equal(presentation.revealState(false, false, true), "hidden");
  assert.equal(presentation.dialogResult("prompt", true, " text "), "text");
  assert.equal(presentation.dialogResult("prompt", true, " "), null);
  assert.equal(presentation.dialogResult("confirm", false, ""), false);
  assert.equal(presentation.dialogResult("alert", true, ""), undefined);
});
test("push permission and install requirements are separate from subscription key replacement", () => {
  const input = { ios: false, standalone: false, supported: true, permission: "granted" };
  assert.equal(notifications.pushEligibility(input), "subscription");
  assert.equal(notifications.pushEligibility({ ...input, permission: "denied" }), "denied");
  assert.equal(notifications.pushEligibility({ ...input, ios: true }), "ios-install");
  assert.equal(notifications.subscriptionAction(true, false), "replace");
  assert.equal(notifications.subscriptionAction(true, true), "reuse");
  assert.equal(notifications.installState(true, true, true), "installed");
});
test("refresh failures retain prior data and paging completion does not end an overlapping refresh", () => {
  let state = { data: [1], request: "idle", error: "" };
  state = resources.resourceTransition(state, { type: "LOADING", value: true });
  state = resources.resourceTransition(state, { type: "MORE", value: true });
  state = resources.resourceTransition(state, { type: "MORE", value: false });
  assert.equal(state.request, "loading");
  state = resources.resourceTransition(state, { type: "ERROR", error: "Offline" });
  state = resources.resourceTransition(state, { type: "LOADING", value: false });
  assert.equal(resources.resourcePhase(state), "stale-error"); assert.equal(state.data[0], 1);
  assert.equal(resources.backendState(true, "down"), "offline");
});
test("submission cleanup preserves success and captcha expiry discards the old token", () => {
  let state = enquiries.enquiryTransition("idle", "SUBMIT");
  state = enquiries.enquiryTransition(state, "SUCCESS");
  assert.equal(enquiries.enquiryTransition(state, "SETTLED"), "ok");
  let captcha = enquiries.captchaTransition({ phase: "ready", token: "" }, { type: "TOKEN", token: "valid" });
  assert.equal(captcha.token, "valid");
  captcha = enquiries.captchaTransition(captcha, { type: "EXPIRE" });
  assert.equal(captcha.phase, "expired"); assert.equal(captcha.token, "");
});
test("a save conflict survives finally and clears only when its error/conflict state is reset", () => {
  let state = { activity: "idle", outcome: "none", error: "" };
  state = editors.saveTransition(state, { type: "ACTIVITY", saving: true });
  state = editors.saveTransition(state, { type: "CONFLICT", value: true });
  state = editors.saveTransition(state, { type: "ERROR", error: "Newer version exists" });
  state = editors.saveTransition(state, { type: "ACTIVITY", saving: false });
  assert.equal(state.outcome, "conflict"); assert.equal(state.error, "Newer version exists");
  state = editors.saveTransition(state, { type: "ERROR", error: "" });
  state = editors.saveTransition(state, { type: "CONFLICT", value: false });
  assert.equal(state.outcome, "none");
  assert.equal(editors.reportCaptureAction(false, false), "create");
  assert.equal(editors.reportCaptureAction(true, true), "update");
  assert.equal(editors.reportCaptureAction(true, false, "reviewed"), "update");
  assert.equal(editors.reportCaptureAction(true, false), "read");
});
test("saved-post hydration preserves typed fields and does not overwrite a different editor", () => {
  const draft = { id: 1, caption: "Typing…", _full: false };
  const full = { id: 1, caption: "Saved", updatedAt: "latest", _full: true };
  const merged = work.hydrateEditor(draft, full, 1, new Set(["caption"]));
  assert.equal(merged.caption, "Typing…"); assert.equal(merged.updatedAt, "latest"); assert.equal(merged._full, true);
  assert.equal(work.hydrateEditor(draft, full, 2, []), draft);
  assert.equal(work.hydrateEditor(merged, full, 1, []), merged);
});
test("review cannot become ready while preflight is stale, failed, blocked or submitting", () => {
  const input = { loaded: true, canReview: true, checks: [true, true, true, true], required: 4, mediaCount: 1, checking: false, issueCount: 0, busy: false };
  assert.equal(work.reviewState(input), "ready");
  for (const patch of [{ loaded: false }, { canReview: false }, { checking: true }, { error: "Failed" }, { issueCount: 1 }, { mediaCount: 0 }, { busy: true }, { checks: [true] }]) assert.notEqual(work.reviewState({ ...input, ...patch }), "ready");
});
test("handoff submission, retry and close retain data without contradictory busy flags", () => {
  let state = dialogs.updateDialog({ phase: "closed" }, { chosen: 33, busy: false });
  assert.equal(state.phase, "editing");
  state = dialogs.updateDialog(state, current => ({ ...current, busy: true }));
  assert.equal(state.phase, "submitting"); assert.equal(dialogs.dialogValue(state).chosen, 33);
  state = dialogs.updateDialog(state, current => ({ ...current, busy: false, error: "Conflict" }));
  assert.equal(state.phase, "editing"); assert.equal(dialogs.dialogValue(state).error, "Conflict");
  assert.equal(dialogs.dialogValue(dialogs.updateDialog(state, null)), null);
});
test("calendar import has one active stage and returns from cancellation to team selection", () => {
  let state = dialogs.updateImport({ phase: "closed" }, { kind: "brand", update: { name: "Brand" } });
  state = dialogs.updateImport(state, { kind: "team", update: { chosen: 33, busy: false } });
  assert.equal(state.phase, "team");
  state = dialogs.updateImport(state, { kind: "team", update: current => ({ ...current, busy: true }) });
  assert.equal(state.phase, "importing");
  state = dialogs.updateImport(state, { kind: "team", update: current => ({ ...current, busy: false }) });
  assert.equal(dialogs.importTeamValue(state).chosen, 33);
  const unchanged = dialogs.updateImport(state, { kind: "brand", update: null });
  assert.equal(unchanged, state);
});
