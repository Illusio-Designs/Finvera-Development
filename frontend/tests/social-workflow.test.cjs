const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/socialWorkflow.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const ui = context.exports;
const server = require('../../Backendjs/src/controllers/social.controller');

for (const [format, maker, staleStep] of [
  ['Static post', 'graphic', 'video'], ['Carousel', 'graphic', 'video'],
  ['Reel', 'video', 'graphic'], ['Influencer Reel', 'video', 'graphic'], ['Video', 'video', 'graphic'],
]) {
  test(`${format} shows only its maker and social reviewer, including legacy steps`, () => {
    assert.deepEqual(Array.from(ui.chainFor(format)), [maker, 'social']);
    for (const stage of ['planned', 'client', 'production']) {
      assert.equal(ui.roleFor(stage, format, staleStep), maker);
      assert.equal(server.stageRole(stage, format, staleStep), maker);
    }
    for (const stage of ['approval', 'ready', 'posted']) {
      assert.equal(ui.roleFor(stage, format, staleStep), 'social');
      assert.equal(server.stageRole(stage, format, staleStep), 'social');
    }
  });
}

test('changing a planned static post to a reel selects its video editor', async () => {
  const req = { body: { format: 'Reel' }, _post: Promise.resolve({ status: 'planned', format: 'Post', step: null, assigneeId: 11, team: { graphic: 11, video: 22, social: 33 } }) };
  await server.assignOnStageChange(req, {}, (error) => { if (error) throw error; });
  assert.equal(req.body.assigneeId, 22);
  assert.equal(req.body.step, null);
});

test('entering production corrects a legacy graphic step on a reel', async () => {
  const req = { body: { status: 'production', step: 'graphic' }, _post: Promise.resolve({ status: 'planned', format: 'Reel', step: null, assigneeId: 22, team: { graphic: 11, video: 22 } }) };
  await server.assignOnStageChange(req, {}, (error) => { if (error) throw error; });
  assert.equal(req.body.step, 'video');
  assert.equal(req.body.assigneeId, 22);
});
