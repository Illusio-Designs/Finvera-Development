const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LabourLicense = sequelize.define('LabourLicense', {
    license_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      comment: 'Unique identifier for the labour license'
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Reference to the company that holds this license'
    },
    license_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Official license number issued by authorities'
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Date when the license expires'
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'suspended', 'renewed'),
      allowNull: false,
      defaultValue: 'active',
      comment: 'Current status of the license'
    },
    type: {
      type: DataTypes.ENUM('Central', 'State'),
      allowNull: false,
      defaultValue: 'State',
      comment: 'Type of labour license - Central or State'
    },
    previous_license_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reference to the previous license ID that was renewed (if this is a renewal)'
    }
  }, {
    tableName: 'labour_licenses',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['license_number']
      },
      {
        fields: ['company_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['expiry_date']
      }
    ]
  });

  // Define associations
  LabourLicense.associate = (models) => {
    LabourLicense.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'company',
      onDelete: 'CASCADE'
    });
  };

  // Hooks for automatic status updates
  LabourLicense.addHook('beforeSave', (license) => {
    if (license.expiry_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(license.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      
      // If expiry date has passed, automatically set status to expired
      if (expiryDate < today && license.status !== 'expired') {
        console.log(`Auto-updating license ${license.license_id} status to expired (expiry date: ${license.expiry_date})`);
        license.status = 'expired';
      }
      // If expiry date is in the future and status is expired, set to active
      else if (expiryDate >= today && license.status === 'expired') {
        console.log(`Auto-updating license ${license.license_id} status to active (expiry date: ${license.expiry_date})`);
        license.status = 'active';
      }
    }
  });

  // Hook to check expiry on find
  LabourLicense.addHook('afterFind', (result) => {
    if (!result) return;
    
    const licenses = Array.isArray(result) ? result : [result];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    licenses.forEach(license => {
      if (license && license.expiry_date) {
        const expiryDate = new Date(license.expiry_date);
        expiryDate.setHours(0, 0, 0, 0);
        
        // If expired by date but not marked as expired, update it
        if (expiryDate < today && license.status !== 'expired') {
          license.update({ status: 'expired' }).catch(err => {
            console.error('Error auto-updating expired license:', err);
          });
        }
      }
    });
  });

  return LabourLicense;
};
