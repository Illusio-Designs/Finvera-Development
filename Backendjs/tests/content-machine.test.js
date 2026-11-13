const { test } = require("node:test"), assert = require("node:assert/strict");
const { reportRevision } = require("../src/utils/contentMachine");
test("editing reviewed commentary revokes review unless explicitly reviewed in that action", () => {
  const row = { status: "reviewed", summary: "Original", version: 4 };
  assert.deepEqual(reportRevision(row, { summary: "Changed" }, "Changed"), { status: "draft", summary: "Changed", version: 5 });
  assert.equal(reportRevision(row, { summary: "Changed", status: "reviewed" }, "Changed").status, "reviewed");
  assert.deepEqual(reportRevision(row, {}, ""), { status: "reviewed", summary: "Original", version: 5 });
});
