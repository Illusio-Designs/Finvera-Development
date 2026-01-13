const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PreviousStabilityManagement = sequelize.define('PreviousStabilityManagement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  original_stability_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Reference to the original stability ID before it was moved to previous'
  },
  factory_quotation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'FactoryQuotations',
      key: 'id'
    }
  },
  stability_manager_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'user_id'
    }
  },
  status: {
    type: DataTypes.ENUM('stability', 'submit', 'Approved', 'Reject', 'Expired'),
    allowNull: false,
    defaultValue: 'Approved',
    comment: 'Status when the stability was moved to previous (usually Approved)'
  },
  load_type: {
    type: DataTypes.ENUM('with_load', 'without_load'),
    allowNull: false
  },
  stability_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date when stability certificate was issued'
  },
  renewal_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Original renewal date (5 years after stability date)'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  files: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'user_id'
    }
  },
  renewed_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Date when this stability was renewed and moved to previous'
  }
}, {
  tableName: 'previous_stability_management',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['factory_quotation_id']
    },
    {
      fields: ['stability_manager_id']
    },
    {
      fields: ['original_stability_id']
    },
    {
      fields: ['renewed_at']
    },
    {
      fields: ['renewal_date']
    },
    {
      fields: ['stability_date', 'renewal_date']
    }
  ]
});

module.exports = PreviousStabilityManagement;