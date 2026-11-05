const { Renewal, sequelize } = require('../models');
const { asyncHandler } = require('../utils/crud');
const audit = require('../utils/audit');
const { isDay, todayIst } = require('../utils/leadFollowUp');
const CYCLES = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 };
const FIELDS = ['client', 'project', 'amount', 'cycle', 'renewalDate', 'lastInvoiced', 'status', 'owner', 'email', 'phone', 'notes', 'position'];
const failure = (status, message, field) => Object.assign(new Error(message), { status, statusCode: status, field });
const normalized = (key, value) => value == null || value === '' ? '' : ['amount', 'position'].includes(key) ? String(Number(value)) : String(value);
function checkExpected(row, expected) {
  if (!expected || typeof expected !== 'object') return;
  if (FIELDS.some(key => Object.hasOwn(expected, key) && normalized(key, row[key]) !== normalized(key, expected[key]))) {
    throw failure(409, 'This renewal changed while you were working. Reload the saved record before applying your changes.');
  }
}
function addMonths(iso, count) {
  const [year, month, day] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + count, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + count, Math.min(day, last))).toISOString().slice(0, 10);
}
const fmt = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function append(row, what, actor, remark) {
  const entry = `${fmt(todayIst())} · ${what} · ${actor || 'someone'}${remark ? ` — ${remark}` : ''}`;
  return [entry, row.notes].filter(value => value && String(value).trim()).join('\n');
}
async function locked(req, change) {
  return sequelize.transaction(async transaction => {
    const item = await Renewal.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw failure(404, 'Renewal not found.');
    checkExpected(item, req.body?.expected);
    const before = item.toJSON();
    await change(item, transaction);
    await item.reload({ transaction });
    return { item, before };
  });
}
async function updateRecord(req) {
  return locked(req, (item, transaction) => item.update(Object.fromEntries(FIELDS.filter(key => Object.hasOwn(req.body, key)).map(key => [key, req.body[key]])), { transaction }));
}
function validate(req, res, next) {
  const body = req.body || {};
  let field, message;
  if ((req.method === 'POST' || 'client' in body) && (typeof body.client !== 'string' || !body.client.trim())) [field, message] = ['client', 'Add the client or company name.'];
  else if ('cycle' in body && !Object.hasOwn(CYCLES, body.cycle)) [field, message] = ['cycle', 'Choose a valid billing cycle.'];
  else if ('status' in body && !['active', 'paused', 'cancelled'].includes(body.status)) [field, message] = ['status', 'Choose a valid renewal status.'];
  else if (body.amount != null && (!Number.isSafeInteger(Number(body.amount)) || Number(body.amount) < 0 || Number(body.amount) > 2147483647)) [field, message] = ['amount', 'Enter a non-negative whole amount.'];
  else for (const key of ['renewalDate', 'lastInvoiced']) if (body[key] != null && body[key] !== '' && !isDay(body[key])) { [field, message] = [key, 'Enter a valid date.']; break; }
  if (field) return res.status(400).json({ field, message });
  next();
}
const action = kind => asyncHandler(async (req, res) => {
  const remark = String(req.body?.remark || '').trim().slice(0, 1000);
  if (kind === 'remark' && !remark) return res.status(400).json({ field: 'remark', message: 'Write a remark first.' });
  const picked = req.body?.renewalDate;
  if (kind === 'renew' && picked != null && picked !== '' && !isDay(picked)) return res.status(400).json({ field: 'renewalDate', message: 'Enter a valid next renewal date.' });
  if (kind === 'renew' && req.body?.invoiced !== undefined && typeof req.body.invoiced !== 'boolean') return res.status(400).json({ message: 'Choose whether to record the renewal date as today.' });
  let summary;
  const { item, before } = await locked(req, async (row, transaction) => {
    const patch = {};
    if (kind === 'renew') {
      const next = picked || addMonths(row.renewalDate || todayIst(), CYCLES[row.cycle] || 12);
      Object.assign(patch, { renewalDate: next, status: 'active', ...(req.body?.invoiced === false ? {} : { lastInvoiced: todayIst() }) });
      summary = `Renewed till ${fmt(next)}`;
    } else if (kind === 'end') { patch.status = 'cancelled'; summary = 'Terminated'; }
    else if (kind === 'restore') { patch.status = 'active'; summary = 'Restored'; }
    else summary = 'Note';
    patch.notes = append(row, summary, req.user?.name, remark);
    await row.update(patch, { transaction });
  });
  audit.record(req, { action: 'other', entity: 'renewal', before, after: item, diffOpts: { skip: ['notes'] }, summary: `${summary}${remark ? ` — ${remark}` : ''}` });
  res.json(item);
});
module.exports = { validate, updateRecord, renew: action('renew'), terminate: action('end'), restore: action('restore'), remark: action('remark'), addMonths, checkExpected };
