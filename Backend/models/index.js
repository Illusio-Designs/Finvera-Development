const sequelize = require("../config/db");

// Import models
const User = require("./userModel");
const Role = require("./roleModel");
const UserRole = require("./userRoleModel");
const Company = require("./companyModel");
const Consumer = require("./consumerModel");
const InsuranceCompany = require("./insuranceCompanyModel");
const EmployeeCompensationPolicy = require("./employeeCompensationPolicyModel");
const PreviousEmployeeCompensationPolicy = require("./previousEmployeeCompensationPolicyModel");
const VehiclePolicy = require("./vehiclePolicyModel");
const PreviousVehiclePolicy = require("./previousVehiclePolicyModel");
const HealthPolicies = require("./healthPolicyModel");
const PreviousHealthPolicy = require("./previousHealthPolicyModel");
const FirePolicy = require("./firePolicyModel");
const PreviousFirePolicy = require("./previousFirePolicyModel");
const LifePolicy = require("./lifePolicyModel");
const PreviousLifePolicy = require("./previousLifePolicyModel");
const DSC = require("./dscModel");
const ReminderLog = require("./reminderLogModel");
const DSCLog = require("./dscLogModel");
const UserRoleWorkLog = require("./userRoleWorkLogModel");
const FactoryQuotation = require("./factoryQuotationModel");
const PlanManagement = require("./planManagementModel");
const StabilityManagement = require("./stabilityManagementModel");
const PreviousStabilityManagement = require("./previousStabilityManagementModel");
const ApplicationManagement = require("./applicationManagementModel");
const RenewalStatus = require("./renewalStatusModel");
const RenewalConfig = require("./renewalConfigModel")(
  sequelize,
  require("sequelize").DataTypes
);
const LabourInspection = require("./labourInspectionModel");
const LabourLicense = require("./labourLicenseModel")(
  sequelize,
  require("sequelize").DataTypes
);

// Define associations
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "user_id",
  as: "roles",
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "role_id",
  as: "users",
});

// Company-User Associations
Company.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasOne(Company, { foreignKey: "user_id", as: "company" });

// Consumer-User Associations
Consumer.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasOne(Consumer, { foreignKey: "user_id", as: "consumer" });

// Plan Management Associations
PlanManagement.belongsTo(FactoryQuotation, {
  foreignKey: "factory_quotation_id",
  as: "factoryQuotation",
});
PlanManagement.belongsTo(User, {
  foreignKey: "plan_manager_id",
  as: "planManager",
});
PlanManagement.belongsTo(User, { foreignKey: "reviewed_by", as: "reviewer" });
FactoryQuotation.hasOne(PlanManagement, {
  foreignKey: "factory_quotation_id",
  as: "planManagement",
});

// Stability Management Associations
StabilityManagement.belongsTo(FactoryQuotation, {
  foreignKey: "factory_quotation_id",
  as: "factoryQuotation",
});
StabilityManagement.belongsTo(User, {
  foreignKey: "stability_manager_id",
  as: "stabilityManager",
});
StabilityManagement.belongsTo(User, {
  foreignKey: "reviewed_by",
  as: "reviewer",
});
FactoryQuotation.hasOne(StabilityManagement, {
  foreignKey: "factory_quotation_id",
  as: "stabilityManagement",
});

// Previous Stability Management Associations
PreviousStabilityManagement.belongsTo(FactoryQuotation, {
  foreignKey: "factory_quotation_id",
  as: "factoryQuotation",
});
PreviousStabilityManagement.belongsTo(User, {
  foreignKey: "stability_manager_id",
  as: "stabilityManager",
});
PreviousStabilityManagement.belongsTo(User, {
  foreignKey: "reviewed_by",
  as: "reviewer",
});

// Stability Management ↔ Previous Stability Management
StabilityManagement.hasMany(PreviousStabilityManagement, {
  foreignKey: "original_stability_id",
  as: "previousStabilities",
});
PreviousStabilityManagement.belongsTo(StabilityManagement, {
  foreignKey: "original_stability_id",
  as: "originalStability",
});

// Application Management Associations
ApplicationManagement.belongsTo(FactoryQuotation, {
  foreignKey: "factory_quotation_id",
  as: "factoryQuotation",
});
ApplicationManagement.belongsTo(User, {
  foreignKey: "compliance_manager_id",
  as: "complianceManager",
});
ApplicationManagement.belongsTo(User, {
  foreignKey: "reviewed_by",
  as: "reviewer",
});
FactoryQuotation.hasOne(ApplicationManagement, {
  foreignKey: "factory_quotation_id",
  as: "applicationManagement",
});

// Renewal Status Associations
RenewalStatus.belongsTo(FactoryQuotation, {
  foreignKey: "factory_quotation_id",
  as: "factoryQuotation",
});
RenewalStatus.belongsTo(User, { foreignKey: "created_by", as: "creator" });
FactoryQuotation.hasOne(RenewalStatus, {
  foreignKey: "factory_quotation_id",
  as: "renewalStatus",
});
User.hasMany(RenewalStatus, {
  foreignKey: "created_by",
  as: "createdRenewalStatuses",
});

// Factory Quotation - Company Association
FactoryQuotation.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company",
});
Company.hasMany(FactoryQuotation, {
  foreignKey: "company_id",
  as: "factoryQuotations",
});

// Employee Compensation Policy Associations
EmployeeCompensationPolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "policyHolder",
});
EmployeeCompensationPolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
Company.hasMany(EmployeeCompensationPolicy, {
  foreignKey: "company_id",
  as: "employeeCompensationPolicies",
});
InsuranceCompany.hasMany(EmployeeCompensationPolicy, {
  foreignKey: "insurance_company_id",
  as: "employeeCompensationPolicies",
});

// Previous Employee Compensation Policy Associations
PreviousEmployeeCompensationPolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "policyHolder",
});
PreviousEmployeeCompensationPolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
Company.hasMany(PreviousEmployeeCompensationPolicy, {
  foreignKey: "company_id",
  as: "previousEmployeeCompensationPolicies",
});
InsuranceCompany.hasMany(PreviousEmployeeCompensationPolicy, {
  foreignKey: "insurance_company_id",
  as: "previousEmployeeCompensationPolicies",
});

// Vehicle Policy Associations
VehiclePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
VehiclePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
VehiclePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
VehiclePolicy.belongsTo(PreviousVehiclePolicy, {
  foreignKey: "previous_policy_id",
  as: "previousPolicy",
});
Company.hasMany(VehiclePolicy, {
  foreignKey: "company_id",
  as: "vehiclePolicies",
});
Consumer.hasMany(VehiclePolicy, {
  foreignKey: "consumer_id",
  as: "vehiclePolicies",
});
InsuranceCompany.hasMany(VehiclePolicy, {
  foreignKey: "insurance_company_id",
  as: "vehiclePolicies",
});

// Previous Vehicle Policy Associations
PreviousVehiclePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "policyHolder",
});
PreviousVehiclePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
PreviousVehiclePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
PreviousVehiclePolicy.hasOne(VehiclePolicy, {
  foreignKey: "previous_policy_id",
  as: "renewedPolicy",
});
Company.hasMany(PreviousVehiclePolicy, {
  foreignKey: "company_id",
  as: "previousVehiclePolicies",
});
Consumer.hasMany(PreviousVehiclePolicy, {
  foreignKey: "consumer_id",
  as: "previousVehiclePolicies",
});
InsuranceCompany.hasMany(PreviousVehiclePolicy, {
  foreignKey: "insurance_company_id",
  as: "previousVehiclePolicies",
});

// Health Policy Associations
HealthPolicies.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
HealthPolicies.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
HealthPolicies.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
HealthPolicies.belongsTo(PreviousHealthPolicy, {
  foreignKey: "previous_policy_id",
  as: "previousPolicy",
});
Company.hasMany(HealthPolicies, {
  foreignKey: "company_id",
  as: "healthPolicies",
});
Consumer.hasMany(HealthPolicies, {
  foreignKey: "consumer_id",
  as: "healthPolicies",
});
InsuranceCompany.hasMany(HealthPolicies, {
  foreignKey: "insurance_company_id",
  as: "healthPolicies",
});

// Previous Health Policy Associations
PreviousHealthPolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
PreviousHealthPolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
PreviousHealthPolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
PreviousHealthPolicy.hasOne(HealthPolicies, {
  foreignKey: "previous_policy_id",
  as: "renewedPolicy",
});
Company.hasMany(PreviousHealthPolicy, {
  foreignKey: "company_id",
  as: "previousHealthPolicies",
});
Consumer.hasMany(PreviousHealthPolicy, {
  foreignKey: "consumer_id",
  as: "previousHealthPolicies",
});
InsuranceCompany.hasMany(PreviousHealthPolicy, {
  foreignKey: "insurance_company_id",
  as: "previousHealthPolicies",
});

// Fire Policy Associations
FirePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
FirePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
FirePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
FirePolicy.belongsTo(PreviousFirePolicy, {
  foreignKey: "previous_policy_id",
  as: "previousPolicy",
});
Company.hasMany(FirePolicy, { foreignKey: "company_id", as: "firePolicies" });
Consumer.hasMany(FirePolicy, { foreignKey: "consumer_id", as: "firePolicies" });
InsuranceCompany.hasMany(FirePolicy, {
  foreignKey: "insurance_company_id",
  as: "firePolicies",
});

// Previous Fire Policy Associations
PreviousFirePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
PreviousFirePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
PreviousFirePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
PreviousFirePolicy.hasOne(FirePolicy, {
  foreignKey: "previous_policy_id",
  as: "renewedPolicy",
});
Company.hasMany(PreviousFirePolicy, {
  foreignKey: "company_id",
  as: "previousFirePolicies",
});
Consumer.hasMany(PreviousFirePolicy, {
  foreignKey: "consumer_id",
  as: "previousFirePolicies",
});
InsuranceCompany.hasMany(PreviousFirePolicy, {
  foreignKey: "insurance_company_id",
  as: "previousFirePolicies",
});

// Life Policy Associations
LifePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
LifePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
LifePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
LifePolicy.belongsTo(PreviousLifePolicy, {
  foreignKey: "previous_policy_id",
  as: "previousPolicy",
});
Company.hasMany(LifePolicy, { foreignKey: "company_id", as: "lifePolicies" });
Consumer.hasMany(LifePolicy, { foreignKey: "consumer_id", as: "lifePolicies" });
InsuranceCompany.hasMany(LifePolicy, {
  foreignKey: "insurance_company_id",
  as: "lifePolicies",
});

// Previous Life Policy Associations
PreviousLifePolicy.belongsTo(Company, {
  foreignKey: "company_id",
  as: "companyPolicyHolder",
});
PreviousLifePolicy.belongsTo(Consumer, {
  foreignKey: "consumer_id",
  as: "consumerPolicyHolder",
});
PreviousLifePolicy.belongsTo(InsuranceCompany, {
  foreignKey: "insurance_company_id",
  as: "provider",
});
PreviousLifePolicy.hasOne(LifePolicy, {
  foreignKey: "previous_policy_id",
  as: "renewedPolicy",
});
Company.hasMany(PreviousLifePolicy, {
  foreignKey: "company_id",
  as: "previousLifePolicies",
});
Consumer.hasMany(PreviousLifePolicy, {
  foreignKey: "consumer_id",
  as: "previousLifePolicies",
});
InsuranceCompany.hasMany(PreviousLifePolicy, {
  foreignKey: "insurance_company_id",
  as: "previousLifePolicies",
});

// DSC Associations
DSC.belongsTo(Company, { foreignKey: "company_id", as: "company" });
DSC.belongsTo(Consumer, { foreignKey: "consumer_id", as: "consumer" });
Company.hasMany(DSC, { foreignKey: "company_id", as: "dscs" });
Consumer.hasMany(DSC, { foreignKey: "consumer_id", as: "dscs" });

// DSC Log Associations
DSCLog.belongsTo(User, { foreignKey: "performed_by", as: "user" });
DSCLog.belongsTo(DSC, { foreignKey: "dsc_id", as: "dsc" });
User.hasMany(DSCLog, { foreignKey: "performed_by", as: "dscLogs" });
DSC.hasMany(DSCLog, { foreignKey: "dsc_id", as: "dscLogs" });

// User Role Work Log Associations
UserRoleWorkLog.belongsTo(User, { foreignKey: "user_id", as: "user" });
UserRoleWorkLog.belongsTo(User, {
  foreignKey: "target_user_id",
  as: "targetUser",
});
UserRoleWorkLog.belongsTo(Role, { foreignKey: "role_id", as: "role" });
User.hasMany(UserRoleWorkLog, {
  foreignKey: "user_id",
  as: "userRoleWorkLogs",
});
User.hasMany(UserRoleWorkLog, {
  foreignKey: "target_user_id",
  as: "targetUserRoleWorkLogs",
});
Role.hasMany(UserRoleWorkLog, {
  foreignKey: "role_id",
  as: "userRoleWorkLogs",
});

// Labour Inspection Associations
LabourInspection.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company",
});
LabourInspection.belongsTo(User, { foreignKey: "created_by", as: "creator" });
LabourInspection.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
Company.hasMany(LabourInspection, {
  foreignKey: "company_id",
  as: "labourInspections",
});
User.hasMany(LabourInspection, {
  foreignKey: "created_by",
  as: "createdInspections",
});
User.hasMany(LabourInspection, {
  foreignKey: "updated_by",
  as: "updatedInspections",
});

// Labour License Associations
LabourLicense.belongsTo(Company, { foreignKey: "company_id", as: "company" });
Company.hasMany(LabourLicense, {
  foreignKey: "company_id",
  as: "labourLicenses",
});

module.exports = {
  User,
  Role,
  UserRole,
  Company,
  Consumer,
  InsuranceCompany,
  EmployeeCompensationPolicy,
  PreviousEmployeeCompensationPolicy,
  VehiclePolicy,
  PreviousVehiclePolicy,
  HealthPolicies,
  PreviousHealthPolicy,
  FirePolicy,
  PreviousFirePolicy,
  LifePolicy,
  PreviousLifePolicy,
  DSC,
  ReminderLog,
  DSCLog,
  UserRoleWorkLog,
  FactoryQuotation,
  PlanManagement,
  StabilityManagement,
  PreviousStabilityManagement,
  ApplicationManagement,
  RenewalStatus,
  RenewalConfig,
  LabourInspection,
  LabourLicense,
  sequelize,
};
