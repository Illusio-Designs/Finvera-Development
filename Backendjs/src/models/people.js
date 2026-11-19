const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Employee = sequelize.define("PayrollEmployee", {
  name: { type: DataTypes.STRING(120), allowNull: false },
  title: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
  startsOn: { type: DataTypes.DATEONLY, allowNull: false },
  endsOn: DataTypes.DATEONLY,
  salary: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: "payroll_employees" });

const Leave = sequelize.define("PayrollLeave", {
  employeeId: { type: DataTypes.INTEGER, allowNull: false },
  from: { type: DataTypes.DATEONLY, allowNull: false },
  to: { type: DataTypes.DATEONLY, allowNull: false },
  kind: { type: DataTypes.ENUM("paid", "unpaid"), allowNull: false },
  half: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reason: { type: DataTypes.STRING(255), allowNull: false },
  status: { type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"), allowNull: false, defaultValue: "pending" },
  recordedBy: { type: DataTypes.INTEGER, allowNull: false },
  reviewedBy: DataTypes.INTEGER,
  reviewedAt: DataTypes.DATE,
}, { tableName: "payroll_leaves", indexes: [{ fields: ["employeeId", "from", "to"] }] });
Leave.belongsTo(Employee, { foreignKey: "employeeId", onDelete: "RESTRICT" });

const Period = sequelize.define("PayrollPeriod", {
  month: { type: DataTypes.STRING(7), primaryKey: true },
  rules: DataTypes.JSON,
  adjustments: DataTypes.JSON,
  snapshot: DataTypes.JSON,
  finalizedAt: DataTypes.DATE,
  finalizedBy: DataTypes.INTEGER,
}, { tableName: "payroll_periods" });

// Keep associations private. Public Team and generic User reads never select this table.
const EmployeeLink = sequelize.define("PayrollEmployeeLink", {
  employeeId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  userId: { type: DataTypes.INTEGER, unique: true },
  teamMemberId: { type: DataTypes.INTEGER, unique: true },
}, { tableName: "payroll_employee_links" });

const { User, TeamMember } = require("./index");
EmployeeLink.belongsTo(Employee, { foreignKey: "employeeId", onDelete: "CASCADE" });
EmployeeLink.belongsTo(User, { foreignKey: "userId", onDelete: "SET NULL" });
EmployeeLink.belongsTo(TeamMember, { foreignKey: "teamMemberId", onDelete: "SET NULL" });

module.exports = { Employee, Leave, Period, EmployeeLink };
