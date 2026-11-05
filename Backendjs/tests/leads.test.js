const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isDay, addDays } = require('../src/utils/leadFollowUp');
const { validateLead } = require('../src/controllers/leads.controller');
function validate(body, method = 'PATCH') {
  let result = { status: 200 };
  validateLead({ body, method }, { status(status) { result.status = status; return this; }, json(data) { result = { ...result, ...data }; } }, () => {});
  return result;
}
test('follow-up dates must exist on the calendar', () => {
  assert.equal(isDay('2026-02-30'), false);
  assert.equal(isDay('2026-13-01'), false);
  assert.equal(isDay('2028-02-29'), true);
  assert.equal(isDay('2027-02-29'), false);
  assert.equal(addDays('2026-12-29', 6), '2027-01-04');
});
test('direct lead writes reject invalid stages, names, priorities and values', () => {
  for (const [body, field] of [[{ name: ' ' }, 'name'], [{ stage: 'ready' }, 'stage'], [{ priority: 'urgent' }, 'priority'], [{ value: -1 }, 'value'], [{ value: 1.5 }, 'value'], [{ nextFollowUpAt: '2026-02-30' }, 'nextFollowUpAt']]) {
    assert.equal(validate(body).status, 400); assert.equal(validate(body).field, field);
  }
  assert.equal(validate({}, 'POST').status, 400);
  assert.equal(validate({ name: 'Valid lead', stage: 'new', value: 0 }, 'POST').status, 200);
  assert.equal(validate({ owner: null, nextFollowUpAt: null }).status, 200);
});
