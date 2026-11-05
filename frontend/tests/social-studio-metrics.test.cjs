const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/socialStudioMetrics.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const metrics = context.exports;

test('unknown metrics and real zero counts remain distinct', () => {
  assert.equal(metrics.sumReported([{ metrics: { picture: 'image.jpg' } }], 'likes'), null);
  assert.equal(metrics.sumReported([{ metrics: { likes: 0 } }], 'likes'), 0);
  assert.equal(metrics.hasReportedMetrics({ picture: 'image.jpg' }), false);
  assert.equal(metrics.hasReportedMetrics({ comments: 0 }), true);
  assert.equal(metrics.totalReported([]), null);
});

test('partial reports total available values without inventing missing counts', () => {
  const rows = [{ metrics: { likes: 3 } }, { metrics: { comments: 2, shares: 0 } }, { metrics: {} }];
  assert.equal(metrics.sumReported(rows, 'likes'), 3);
  assert.equal(metrics.totalReported(rows), 5);
  assert.equal(metrics.followerTotal([{ followers: null }]), null);
  assert.equal(metrics.followerTotal([{ followers: 0 }, { followers: null }]), 0);
  assert.equal(metrics.followerTotal([{ followers: 12 }, { followers: 8 }]), 20);
});

test('invalid counts never contaminate aggregate metrics', () => {
  const rows = [{ metrics: { likes: NaN, comments: -1, shares: Infinity } }, { metrics: { likes: 5 } }];
  assert.equal(metrics.totalReported(rows), 5);
});
