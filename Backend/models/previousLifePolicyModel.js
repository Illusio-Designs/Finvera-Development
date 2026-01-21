// PreviousLifePolicy Model
// This model stores historical/previous life insurance policies
// when they are renewed. Multiple previous policies can exist for the same company/consumer.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const InsuranceCompany = require('./insuranceCompanyModel');
const Company = require('./companyModel');
const Consumer = require('./consumerModel');

const PreviousLifePolicy = sequelize.define('PreviousLifePolicy', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  original_policy_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Reference to the original policy ID before it was moved to previous'
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
  proposer_name: {
    type: DataTypes.STRING,
    allowNull: false
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
    allowNull: false,
    validate: {
      min: 0
    }
  },
  ppt: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  payment_mode: {
    type: DataTypes.ENUM('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'),
    allowNull: true,
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
    allowNull: false
  },
  current_policy_number: {
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
    defaultValue: 'expired',
    comment: 'Status when the policy was moved to previous (usually expired)'
  },
  renewed_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Date when this policy was renewed and moved to previous'
  }
}, {
  tableName: 'PreviousLifePolicies',
  timestamps: true,
  indexes: [
    {
      fields: ['current_policy_number']
    },
    {
      fields: ['company_id']
    },
    {
      fields: ['consumer_id']
    },
    {
      fields: ['insurance_company_id']
    },
    {
      fields: ['policy_end_date']
    },
    {
      fields: ['original_policy_id']
    },
    {
      fields: ['renewed_at']
    },
    {
      fields: ['policy_start_date', 'policy_end_date']
    },
    {
      fields: ['date_of_birth']
    },
    {
      fields: ['issue_date']
    }
  ]
});

module.exports = PreviousLifePolicy;