const {User,sequelize}=require('../models');
const {asyncHandler}=require('../utils/crud');
const {PUSH_KINDS,pushPreferences,preferencePatch,object,fail}=require('../utils/workspaceTools');
const get=asyncHandler(async(req,res)=>{const user=await User.findByPk(req.user.id,{attributes:['id','emailPrefs']});if(!user)throw fail(404,'User not found.');res.set('Cache-Control','no-store').json({prefs:pushPreferences(user),kinds:PUSH_KINDS});});
const put=asyncHandler(async(req,res)=>{const body=preferencePatch(req.body);const user=await sequelize.transaction(async transaction=>{const row=await User.findByPk(req.user.id,{transaction,lock:transaction.LOCK.UPDATE});if(!row)throw fail(404,'User not found.');await row.update({emailPrefs:{...object(row.emailPrefs),notificationPush:{...pushPreferences(row),...body}}},{transaction});return row;});require('../middleware/auth').forgetUser(user.id);res.json({prefs:pushPreferences(user),kinds:PUSH_KINDS});});
module.exports={get,put};
