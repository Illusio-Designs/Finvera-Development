function dailyState(date, minutes, runAt, checkedFor) {
  return minutes < runAt ? "early" : checkedFor === date ? "checked" : "eligible";
}
function runnerState(running, lastRun, now, gap, force = false) {
  return running ? "running" : !force && now - lastRun < gap ? "cooldown" : "eligible";
}
async function claimDate(key, date) {
  const { Setting } = require("../models");
  const { Op } = require("sequelize");
  await Setting.findOrCreate({ where: { key }, defaults: { key, value: "", group: "system", isPublic: false } });
  const [claimed] = await Setting.update({ value: date }, { where: { key, [Op.or]: [{ value: null }, { value: { [Op.ne]: date } }] } });
  return claimed > 0;
}
async function claimWindow(key, now, windowMs) {
  const { Setting, sequelize } = require("../models");
  const { Op } = require("sequelize");
  await Setting.findOrCreate({ where: { key }, defaults: { key, value: "0", group: "system", isPublic: false } });
  const [claimed] = await Setting.update({ value: String(now) }, { where: { key, [Op.or]: [
    { value: null }, { value: "" }, sequelize.where(sequelize.cast(sequelize.col("value"), "UNSIGNED"), Op.lt, now - windowMs),
  ] } });
  return claimed > 0;
}
async function claimRepair(key, createOnly, runningValue = "running") {
  const { Setting } = require("../models");
  const { Op } = require("sequelize");
  const [flag, created] = await Setting.findOrCreate({ where: { key }, defaults: { value: createOnly ? runningValue : "", group: "system", isPublic: false } });
  if (createOnly) return { flag, claimed: created };
  const [claimed] = await Setting.update({ value: runningValue }, { where: { key, [Op.or]: [{ value: null }, { value: "" }] } });
  return { flag, claimed: claimed > 0 };
}
module.exports = { dailyState, runnerState, claimDate, claimWindow, claimRepair };
