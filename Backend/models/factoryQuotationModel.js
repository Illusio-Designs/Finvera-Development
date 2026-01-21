const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FactoryQuotation = sequelize.define('FactoryQuotation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  companyAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isEmail: true }
  },
  noOfWorkers: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  horsePower: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  calculatedAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  additionalCharges: {
    type: DataTypes.JSON, // Array of { type, amount }
    allowNull: true,
  },
  stabilityCertificateType: {
    type: DataTypes.ENUM('with load', 'without load'),
    allowNull: false,
  },
  stabilityCertificateAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  administrationCharge: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  consultancyFees: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  planCharge: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('maked', 'approved', 'plan', 'stability', 'application', 'renewal'),
    defaultValue: 'maked',
  },
  assignedToRole: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Admin',
  },
  assignedToUser: {
    type: DataTypes.INTEGER, // User ID
    allowNull: true,
  },
  planUsers: {
    type: DataTypes.JSON, // Array of user IDs
    allowNull: true,
  },
  stabilityUsers: {
    type: DataTypes.JSON, // Array of user IDs
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER, // User ID
    allowNull: true,
  },
  pdfPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Path to the generated PDF file'
  },
  renewal_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when the quotation was renewed'
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of the company created during renewal'
  },
}, {
  tableName: 'FactoryQuotations',
  timestamps: true,
  underscored: true, // This makes Sequelize use snake_case column names
  modelName: 'FactoryQuotation'
});

module.exports = FactoryQuotation; 