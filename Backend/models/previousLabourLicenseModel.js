const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PreviousLabourLicense = sequelize.define('PreviousLabourLicense', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: 'Unique identifier for the previous labour license record'
    },
    original_license_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reference to the original license ID before it was moved to previous'
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Reference to the company that held this license'
    },
    license_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Official license number issued by authorities'
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Date when the license expired'
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'suspended', 'renewed'),
      allowNull: false,
      defaultValue: 'expired',
      comment: 'Status when the license was moved to previous (usually expired)'
    },
    type: {
      type: DataTypes.ENUM('Central', 'State'),
      allowNull: false,
      comment: 'Type of labour license - Central or State'
    }
  }, {
    tableName: 'previous_labour_licenses',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['company_id']
      },
      {
        fields: ['license_number']
      },
      {
        fields: ['original_license_id']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['expiry_date']
      }
    ]
  });

  // Define associations
  PreviousLabourLicense.associate = (models) => {
    PreviousLabourLicense.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'company',
      onDelete: 'RESTRICT'
    });
  };

  return PreviousLabourLicense;
};
