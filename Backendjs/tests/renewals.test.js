const { test } = require('node:test');
const assert = require('node:assert/strict');
const { addMonths, checkExpected } = require('../src/controllers/renewals.controller');
test('billing cycles clamp month ends and leap days without shifting the due-date basis', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2028-02-29', 12), '2029-02-28');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
});
test('conflict snapshots tolerate representation differences but detect changed history or dates', () => {
  assert.doesNotThrow(() => checkExpected({ amount: 0, owner: null }, { amount: '0', owner: '' }));
  assert.throws(() => checkExpected({ notes: 'New remark\nOld remark' }, { notes: 'Old remark' }), error => error.status === 409);
  assert.throws(() => checkExpected({ renewalDate: '2026-12-01' }, { renewalDate: '2026-11-01' }), error => error.status === 409);
});
