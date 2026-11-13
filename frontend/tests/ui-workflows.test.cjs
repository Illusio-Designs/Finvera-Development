const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), ts = require("typescript");
function load(name) {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/" + name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
  return context.exports;
}
const dialogs = load("dialogMachine");
const work = load("socialWorkMachine");
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
