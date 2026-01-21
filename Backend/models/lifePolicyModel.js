const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const InsuranceCompany = require('./insuranceCompanyModel');
const Company = require('./companyModel');
const Consumer = require('./consumerModel');

const LifePolicy = sequelize.define('LifePolicy', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  business_type: {
    type: DataTypes.ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement'),
    allowNull: false,
    defaultValue: 'Fresh/New'
  },
  customer_type: {
    type: DataTypes.ENUM('Organisation', 'Individual'),
    allowNull: false,
    defaultValue: 'Individual'
  },
  insurance_company_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'InsuranceCompanies',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Companies',
      key: 'company_id'
    }
  },
  consumer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Consumers',
      key: 'consumer_id'
    }
  },
  date_of_birth: {
    type: DataTypes.DATE,
    allowNull: false
  },
  plan_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sub_product: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pt: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  ppt: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  payment_mode: {
    type: DataTypes.ENUM('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'),
    allowNull: false,
    defaultValue: 'Yearly',
    comment: 'Premium payment frequency'
  },
  policy_start_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  issue_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  policy_end_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Calculated as policy_start_date + ppt years'
  },
  current_policy_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  proposer_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  mobile_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  net_premium: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  gst: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  gross_premium: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  policy_document_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled'),
    defaultValue: 'active'
  },
  previous_policy_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'PreviousLifePolicies',
      key: 'id'
    },
    comment: 'Reference to the previous policy ID that was renewed (if this is a renewal)'
  }
}, {
  tableName: 'LifePolicies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  modelName: 'LifePolicy',
  indexes: [
    {
      unique: true,
      fields: ['current_policy_number']
    }
  ]
});

module.exports = LifePolicy; 