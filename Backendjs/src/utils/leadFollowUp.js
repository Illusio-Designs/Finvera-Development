const { Op, fn, col, where } = require('sequelize');
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const addDays = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// Keep legacy follow-up dates visible in exports, just as in the pipeline UI.
function followUpWhere(range, today = todayIst()) {
  const condition = range === 'overdue' ? { [Op.lt]: today } : range === 'today' ? today
    : range === 'week' ? { [Op.between]: [today, addDays(today, 6)] } : null;
  return condition === null ? null : { [Op.and]: [
    { stage: { [Op.notIn]: ['won', 'lost'] } },
    where(fn('COALESCE', col('nextFollowUpAt'), col('nextFollowUp')), condition),
  ] };
}
module.exports = { todayIst, addDays, isDay, followUpWhere };
