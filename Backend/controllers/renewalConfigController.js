const { RenewalConfig, LabourInspection, LabourLicense, VehiclePolicy, EmployeeCompensationPolicy, HealthPolicies, FirePolicy, DSC, LifePolicy, ReminderLog, Company, Consumer } = require('../models');
const { Op } = require('sequelize');
const FactoryQuotation = require('../models/factoryQuotationModel');
const StabilityManagement = require('../models/stabilityManagementModel');

// Get all renewal configurations
const getAllConfigs = async (req, res) => {
  try {
    const configs = await RenewalConfig.findAll({
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching renewal configs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching renewal configurations',
      error: error.message
    });
  }
};

// Get renewal config by service type
const getConfigByService = async (req, res) => {
  try {
    const { serviceType } = req.params;

    const config = await RenewalConfig.findOne({
      where: { serviceType }
    });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Renewal configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching renewal config:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching renewal configuration',
      error: error.message
    });
  }
};

// Create renewal configuration
const createConfig = async (req, res) => {
  try {
    const {
      serviceType,
      serviceName,
      reminderTimes,
      reminderDays,
      reminderIntervals,
      isActive
    } = req.body;
    
    // Validate required fields
    if (!serviceType || !serviceName || !reminderTimes || !reminderDays) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: serviceType, serviceName, reminderTimes, reminderDays'
      });
    }
    
    // Check if service type already exists
    const existingConfig = await RenewalConfig.findOne({
      where: { serviceType }
    });
    
    if (existingConfig) {
      return res.status(400).json({
        success: false,
        message: 'Service type already exists'
      });
    }
    
    const config = await RenewalConfig.create({
      serviceType,
      serviceName,
      reminderTimes,
      reminderDays,
      reminderIntervals: reminderIntervals || (
        serviceType === 'labour_inspection' ? [15, 10, 7, 3, 1] : 
        [30, 15, 7]
      ),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.user_id,
      updatedBy: req.user.user_id
    });
    
    res.status(201).json({
      success: true,
      message: 'Renewal configuration created successfully',
      data: config
    });
  } catch (error) {
    console.error('Error creating renewal config:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating renewal configuration',
      error: error.message
    });
  }
};

// Update renewal configuration
const updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      serviceType,
      serviceName,
      reminderTimes,
      reminderDays,
      reminderIntervals,
      isActive
    } = req.body;
    
    const config = await RenewalConfig.findByPk(id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Renewal configuration not found'
      });
    }

    // Check if service type already exists (excluding current record)
    if (serviceType && serviceType !== config.serviceType) {
      const existingConfig = await RenewalConfig.findOne({
        where: { 
          serviceType,
          id: { [Op.ne]: id }
        }
      });

      if (existingConfig) {
        return res.status(400).json({
          success: false,
          message: 'Service type already exists'
        });
      }
    }

    await config.update({
      serviceType: serviceType || config.serviceType,
      serviceName: serviceName || config.serviceName,
      reminderTimes: reminderTimes !== undefined ? reminderTimes : config.reminderTimes,
      reminderDays: reminderDays !== undefined ? reminderDays : config.reminderDays,
      reminderIntervals: reminderIntervals !== undefined ? reminderIntervals : config.reminderIntervals,
      isActive: isActive !== undefined ? isActive : config.isActive,
      updatedBy: req.user.user_id
    });
    
    res.json({
      success: true,
      message: 'Renewal configuration updated successfully',
      data: config
    });
  } catch (error) {
    console.error('Error updating renewal config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating renewal configuration',
      error: error.message
    });
  }
};

// Delete renewal configuration
const deleteConfig = async (req, res) => {
  try {
    const { id } = req.params;
    
    const config = await RenewalConfig.findByPk(id);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Renewal configuration not found'
      });
    }
    
    await config.destroy();
    
    res.json({
      success: true,
      message: 'Renewal configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting renewal config:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting renewal configuration',
      error: error.message
    });
  }
};

// Helper function for Labour Inspection live data
const getLabourInspectionLiveData = async (config, today) => {
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [upcomingCount, expiringThisWeek, expiringNextWeek, expiringThisMonth] = await Promise.all([
    // Upcoming renewals (within reminder window)
    LabourInspection.count({
      where: {
        expiry_date: {
          [Op.gte]: today,
          [Op.lte]: new Date(today.getTime() + (config.reminderDays * 24 * 60 * 60 * 1000))
        }
      }
    }),
    
    // Expiring this week
    LabourInspection.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfWeek, endOfWeek]
        }
      }
    }),
    
    // Expiring next week
    LabourInspection.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfNextWeek, endOfNextWeek]
        }
      }
    }),
    
    // Expiring this month
    LabourInspection.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    })
  ]);

  return {
    upcomingCount,
    expiringThisWeek,
    expiringNextWeek,
    expiringThisMonth
  };
};

// Helper function for Labour License live data
const getLabourLicenseLiveData = async (config, today) => {
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [upcomingCount, expiringThisWeek, expiringNextWeek, expiringThisMonth] = await Promise.all([
    // Upcoming renewals (within reminder window)
    LabourLicense.count({
      where: {
        expiry_date: {
          [Op.gte]: today,
          [Op.lte]: new Date(today.getTime() + (config.reminderDays * 24 * 60 * 60 * 1000))
        }
      }
    }),
    
    // Expiring this week
    LabourLicense.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfWeek, endOfWeek]
        }
      }
    }),
    
    // Expiring next week
    LabourLicense.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfNextWeek, endOfNextWeek]
        }
      }
    }),
    
    // Expiring this month
    LabourLicense.count({
      where: {
        expiry_date: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    })
  ]);

  return {
    upcomingCount,
    expiringThisWeek,
    expiringNextWeek,
    expiringThisMonth
  };
};

// Helper function for Vehicle Policy live data
const getVehiclePolicyLiveData = async (config, today) => {
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const startOfNextWeek = new Date(endOfWeek);
  startOfNextWeek.setDate(endOfWeek.getDate() + 1);
  
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [upcomingCount, expiringThisWeek, expiringNextWeek, expiringThisMonth] = await Promise.all([
    // Upcoming renewals (within reminder window)
    VehiclePolicy.count({
      where: {
        policy_end_date: {
          [Op.gte]: today,
          [Op.lte]: new Date(today.getTime() + (config.reminderDays * 24 * 60 * 60 * 1000))
        }
      }
    }),
    
    // Expiring this week
    VehiclePolicy.count({
      where: {
        policy_end_date: {
          [Op.between]: [startOfWeek, endOfWeek]
        }
      }
    }),
    
    // Expiring next week
    VehiclePolicy.count({
      where: {
        policy_end_date: {
          [Op.between]: [startOfNextWeek, endOfNextWeek]
        }
      }
    }),
    
    // Expiring this month
    VehiclePolicy.count({
      where: {
        policy_end_date: {
          [Op.between]: [startOfMonth, endOfMonth]
        }
      }
    })
  ]);

  return {
    upcomingCount,
    expiringThisWeek,
    expiringNextWeek,
    expiringThisMonth
  };
};

// Helper function to get life insurance counts with PPT-based payment logic
const getLifeInsuranceCount = async (config, today, days = null) => {
  try {
    const endDate = days ? new Date(today.getTime() + (days * 24 * 60 * 60 * 1000)) : 
                          new Date(today.getTime() + (config.reminderDays * 24 * 60 * 60 * 1000));
    
    // Get all active life policies
    const policies = await LifePolicy.findAll({
      where: {
        status: 'active',
        policy_start_date: { [Op.not]: null },
        ppt: { [Op.not]: null }
      },
      attributes: ['id', 'policy_start_date', 'ppt', 'payment_mode', 'policy_end_date']
    });

    let count = 0;
    
    for (const policy of policies) {
      const startDate = new Date(policy.policy_start_date);
      const pptYears = parseInt(policy.ppt); // Premium Paying Term in years
      const paymentMode = policy.payment_mode || 'Yearly';
      
      // Calculate payment frequency in months
      let paymentFrequencyMonths;
      switch (paymentMode) {
        case 'Monthly':
          paymentFrequencyMonths = 1;
          break;
        case 'Quarterly':
          paymentFrequencyMonths = 3;
          break;
        case 'Half-Yearly':
          paymentFrequencyMonths = 6;
          break;
        case 'Yearly':
        default:
          paymentFrequencyMonths = 12;
          break;
      }
      
      // Calculate all payment dates within the PPT period
      const totalPayments = Math.floor((pptYears * 12) / paymentFrequencyMonths);
      
      for (let i = 0; i < totalPayments; i++) {
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(startDate.getMonth() + (i * paymentFrequencyMonths));
        
        // Check if this payment date falls within our target period
        if (paymentDate >= today && paymentDate <= endDate) {
          count++;
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error('Error getting life insurance count:', error);
    return 0;
  }
};

// Helper function to get life insurance counts between two specific dates
const getLifeInsuranceCountBetween = async (config, startDate, endDate) => {
  try {
    // Get all active life policies
    const policies = await LifePolicy.findAll({
      where: {
        status: 'active',
        policy_start_date: { [Op.not]: null },
        ppt: { [Op.not]: null }
      },
      attributes: ['id', 'policy_start_date', 'ppt', 'payment_mode', 'policy_end_date']
    });

    let count = 0;
    
    for (const policy of policies) {
      const policyStartDate = new Date(policy.policy_start_date);
      const pptYears = parseInt(policy.ppt); // Premium Paying Term in years
      const paymentMode = policy.payment_mode || 'Yearly';
      
      // Calculate payment frequency in months
      let paymentFrequencyMonths;
      switch (paymentMode) {
        case 'Monthly':
          paymentFrequencyMonths = 1;
          break;
        case 'Quarterly':
          paymentFrequencyMonths = 3;
          break;
        case 'Half-Yearly':
          paymentFrequencyMonths = 6;
          break;
        case 'Yearly':
        default:
          paymentFrequencyMonths = 12;
          break;
      }
      
      // Calculate all payment dates within the PPT period
      const totalPayments = Math.floor((pptYears * 12) / paymentFrequencyMonths);
      
      for (let i = 0; i < totalPayments; i++) {
        const paymentDate = new Date(policyStartDate);
        paymentDate.setMonth(policyStartDate.getMonth() + (i * paymentFrequencyMonths));
        
        // Check if this payment date falls within our target period
        if (paymentDate >= startDate && paymentDate <= endDate) {
          count++;
        }
      }
    }
    
    return count;
  } catch (error) {
    console.error('Error getting life insurance count between dates:', error);
    return 0;
  }
};

// Helper function to get policy counts for different service types
const getPolicyCount = async (config, today, dateField, days = null) => {
  let Model;
  
  // Map service types to models
  switch (config.serviceType) {
    case 'ecp':
      Model = EmployeeCompensationPolicy;
      break;
    case 'health':
      Model = HealthPolicies;
      break;
    case 'fire':
      Model = FirePolicy;
      break;
    case 'dsc':
      Model = DSC;
      break;
    case 'factory':
      Model = FactoryQuotation;
      break;
    case 'stability':
      Model = StabilityManagement;
      break;
    case 'life':
      Model = LifePolicy;
      break;
    default:
      return 0;
  }

  if (days) {
    const endDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    return await Model.count({
      where: {
        [dateField]: {
          [Op.between]: [today, endDate]
        }
      }
    });
  } else {
    return await Model.count({
      where: {
        [dateField]: {
          [Op.gte]: today,
          [Op.lte]: new Date(today.getTime() + (config.reminderDays * 24 * 60 * 60 * 1000))
        }
      }
    });
  }
};

// Helper function to get policy counts between two specific dates
const getPolicyCountBetween = async (config, dateField, startDate, endDate) => {
  let Model;
  
  // Map service types to models
  switch (config.serviceType) {
    case 'ecp':
      Model = EmployeeCompensationPolicy;
      break;
    case 'health':
      Model = HealthPolicies;
      break;
    case 'fire':
      Model = FirePolicy;
      break;
    case 'dsc':
      Model = DSC;
      break;
    case 'factory':
      Model = FactoryQuotation;
      break;
    case 'stability':
      Model = StabilityManagement;
      break;
    case 'life':
      Model = LifePolicy;
      break;
    default:
      return 0;
  }

  return await Model.count({
    where: {
      [dateField]: {
        [Op.between]: [startDate, endDate]
      }
    }
  });
};

// Get live renewal counts and upcoming renewals for dashboard
const getLiveRenewalData = async (req, res) => {
  try {
    const today = new Date();
    console.log('[getLiveRenewalData] Fetching live data for all services');
    
    // Get all active renewal configs (exclude reminderIntervals if column doesn't exist)
    const configs = await RenewalConfig.findAll({
      where: { isActive: true },
      attributes: {
        exclude: ['reminderIntervals'] // Temporarily exclude this field
      }
    });

    console.log('[getLiveRenewalData] Found configs:', configs.length);

    const liveData = {};

    for (const config of configs) {
      try {
        console.log(`[getLiveRenewalData] Processing service: ${config.serviceType}`);
        let upcomingCount = 0;
        let expiringThisWeek = 0;
        let expiringNextWeek = 0;
        let expiringThisMonth = 0;

        switch (config.serviceType) {
          case 'labour_inspection':
            const inspectionData = await getLabourInspectionLiveData(config, today);
            upcomingCount = inspectionData.upcomingCount;
            expiringThisWeek = inspectionData.expiringThisWeek;
            expiringNextWeek = inspectionData.expiringNextWeek;
            expiringThisMonth = inspectionData.expiringThisMonth;
            break;

          case 'labour_license':
            const licenseData = await getLabourLicenseLiveData(config, today);
            upcomingCount = licenseData.upcomingCount;
            expiringThisWeek = licenseData.expiringThisWeek;
            expiringNextWeek = licenseData.expiringNextWeek;
            expiringThisMonth = licenseData.expiringThisMonth;
            break;

          case 'vehicle':
            const vehicleData = await getVehiclePolicyLiveData(config, today);
            upcomingCount = vehicleData.upcomingCount;
            expiringThisWeek = vehicleData.expiringThisWeek;
            expiringNextWeek = vehicleData.expiringNextWeek;
            expiringThisMonth = vehicleData.expiringThisMonth;
            break;

          case 'ecp':
          case 'health':
          case 'fire':
            // These use policy_end_date - need proper week/month calculations
            const ecpStartOfWeek = new Date(today);
            ecpStartOfWeek.setDate(today.getDate() - today.getDay());
            const ecpEndOfWeek = new Date(ecpStartOfWeek);
            ecpEndOfWeek.setDate(ecpStartOfWeek.getDate() + 6);
            
            const ecpStartOfNextWeek = new Date(ecpEndOfWeek);
            ecpStartOfNextWeek.setDate(ecpEndOfWeek.getDate() + 1);
            const ecpEndOfNextWeek = new Date(ecpStartOfNextWeek);
            ecpEndOfNextWeek.setDate(ecpStartOfNextWeek.getDate() + 6);
            
            const ecpStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const ecpEndOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            upcomingCount = await getPolicyCount(config, today, 'policy_end_date');
            expiringThisWeek = await getPolicyCountBetween(config, 'policy_end_date', ecpStartOfWeek, ecpEndOfWeek);
            expiringNextWeek = await getPolicyCountBetween(config, 'policy_end_date', ecpStartOfNextWeek, ecpEndOfNextWeek);
            expiringThisMonth = await getPolicyCountBetween(config, 'policy_end_date', ecpStartOfMonth, ecpEndOfMonth);
            break;

          case 'dsc':
            // DSC uses expiry_date - need proper week/month calculations
            const dscStartOfWeek = new Date(today);
            dscStartOfWeek.setDate(today.getDate() - today.getDay());
            const dscEndOfWeek = new Date(dscStartOfWeek);
            dscEndOfWeek.setDate(dscStartOfWeek.getDate() + 6);
            
            const dscStartOfNextWeek = new Date(dscEndOfWeek);
            dscStartOfNextWeek.setDate(dscEndOfWeek.getDate() + 1);
            const dscEndOfNextWeek = new Date(dscStartOfNextWeek);
            dscEndOfNextWeek.setDate(dscStartOfNextWeek.getDate() + 6);
            
            const dscStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const dscEndOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            upcomingCount = await getPolicyCount(config, today, 'expiry_date');
            expiringThisWeek = await getPolicyCountBetween(config, 'expiry_date', dscStartOfWeek, dscEndOfWeek);
            expiringNextWeek = await getPolicyCountBetween(config, 'expiry_date', dscStartOfNextWeek, dscEndOfNextWeek);
            expiringThisMonth = await getPolicyCountBetween(config, 'expiry_date', dscStartOfMonth, dscEndOfMonth);
            break;

          case 'factory':
            // Factory uses renewal_date - need proper week/month calculations
            const factoryStartOfWeek = new Date(today);
            factoryStartOfWeek.setDate(today.getDate() - today.getDay());
            const factoryEndOfWeek = new Date(factoryStartOfWeek);
            factoryEndOfWeek.setDate(factoryStartOfWeek.getDate() + 6);
            
            const factoryStartOfNextWeek = new Date(factoryEndOfWeek);
            factoryStartOfNextWeek.setDate(factoryEndOfWeek.getDate() + 1);
            const factoryEndOfNextWeek = new Date(factoryStartOfNextWeek);
            factoryEndOfNextWeek.setDate(factoryStartOfNextWeek.getDate() + 6);
            
            const factoryStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const factoryEndOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            upcomingCount = await getPolicyCount(config, today, 'renewal_date');
            expiringThisWeek = await getPolicyCountBetween(config, 'renewal_date', factoryStartOfWeek, factoryEndOfWeek);
            expiringNextWeek = await getPolicyCountBetween(config, 'renewal_date', factoryStartOfNextWeek, factoryEndOfNextWeek);
            expiringThisMonth = await getPolicyCountBetween(config, 'renewal_date', factoryStartOfMonth, factoryEndOfMonth);
            break;

          case 'stability':
            // Stability uses renewal_date - need proper week/month calculations
            const stabilityStartOfWeek = new Date(today);
            stabilityStartOfWeek.setDate(today.getDate() - today.getDay());
            const stabilityEndOfWeek = new Date(stabilityStartOfWeek);
            stabilityEndOfWeek.setDate(stabilityStartOfWeek.getDate() + 6);
            
            const stabilityStartOfNextWeek = new Date(stabilityEndOfWeek);
            stabilityStartOfNextWeek.setDate(stabilityEndOfWeek.getDate() + 1);
            const stabilityEndOfNextWeek = new Date(stabilityStartOfNextWeek);
            stabilityEndOfNextWeek.setDate(stabilityStartOfNextWeek.getDate() + 6);
            
            const stabilityStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const stabilityEndOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            upcomingCount = await getPolicyCount(config, today, 'renewal_date');
            expiringThisWeek = await getPolicyCountBetween(config, 'renewal_date', stabilityStartOfWeek, stabilityEndOfWeek);
            expiringNextWeek = await getPolicyCountBetween(config, 'renewal_date', stabilityStartOfNextWeek, stabilityEndOfNextWeek);
            expiringThisMonth = await getPolicyCountBetween(config, 'renewal_date', stabilityStartOfMonth, stabilityEndOfMonth);
            break;

          case 'life':
            // Life insurance uses monthly payment term logic - need proper week/month calculations
            const lifeStartOfWeek = new Date(today);
            lifeStartOfWeek.setDate(today.getDate() - today.getDay());
            const lifeEndOfWeek = new Date(lifeStartOfWeek);
            lifeEndOfWeek.setDate(lifeStartOfWeek.getDate() + 6);
            
            const lifeStartOfNextWeek = new Date(lifeEndOfWeek);
            lifeStartOfNextWeek.setDate(lifeEndOfWeek.getDate() + 1);
            const lifeEndOfNextWeek = new Date(lifeStartOfNextWeek);
            lifeEndOfNextWeek.setDate(lifeStartOfNextWeek.getDate() + 6);
            
            const lifeStartOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lifeEndOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            
            upcomingCount = await getLifeInsuranceCount(config, today);
            expiringThisWeek = await getLifeInsuranceCountBetween(config, lifeStartOfWeek, lifeEndOfWeek);
            expiringNextWeek = await getLifeInsuranceCountBetween(config, lifeStartOfNextWeek, lifeEndOfNextWeek);
            expiringThisMonth = await getLifeInsuranceCountBetween(config, lifeStartOfMonth, lifeEndOfMonth);
            break;
        }

        liveData[config.serviceType] = {
          serviceName: config.serviceName,
          upcomingCount,
          expiringThisWeek,
          expiringNextWeek,
          expiringThisMonth,
          reminderDays: config.reminderDays,
          reminderTimes: config.reminderTimes,
          reminderIntervals: config.reminderIntervals || (
            config.serviceType === 'labour_inspection' ? [15, 10, 7, 3, 1] : 
            [30, 15, 7]
          )
        };

        console.log(`[getLiveRenewalData] ${config.serviceType} data:`, {
          upcomingCount,
          expiringThisWeek,
          expiringNextWeek,
          expiringThisMonth
        });

      } catch (error) {
        console.error(`[getLiveRenewalData] Error for ${config.serviceType}:`, error.message);
        liveData[config.serviceType] = {
          serviceName: config.serviceName,
          upcomingCount: 0,
          expiringThisWeek: 0,
          expiringNextWeek: 0,
          expiringThisMonth: 0,
          error: error.message
        };
      }
    }

    console.log('[getLiveRenewalData] Result:', {
      servicesProcessed: Object.keys(liveData).length,
      services: Object.keys(liveData)
    });

    res.json({
      success: true,
      data: liveData
    });
  } catch (error) {
    console.error('[getLiveRenewalData] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching live renewal data',
      error: error.message
    });
  }
};

// Get default service types
const getDefaultServiceTypes = async (req, res) => {
  try {
    const serviceTypes = [
      { value: 'vehicle', label: 'Vehicle Insurance' },
      { value: 'ecp', label: 'Employee Compensation Policy' },
      { value: 'health', label: 'Health Insurance' },
      { value: 'fire', label: 'Fire Insurance' },
      { value: 'dsc', label: 'Digital Signature Certificate' },
      { value: 'factory', label: 'Factory Quotation' },
      { value: 'labour_inspection', label: 'Labour Inspection' },
      { value: 'labour_license', label: 'Labour License' },
      { value: 'stability', label: 'Stability Management' },
      { value: 'life', label: 'Life Insurance' }
    ];
    
    res.json({
      success: true,
      data: serviceTypes
    });
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service types',
      error: error.message
    });
  }
};

// Get renewal logs
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, pageSize, status, policy_type, reminder_type } = req.query;
    const actualLimit = parseInt(limit) || parseInt(pageSize) || 50;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (status) whereClause.status = status;
    if (policy_type) whereClause.policy_type = policy_type;
    if (reminder_type) whereClause.reminder_type = reminder_type;

    const { count, rows: logs } = await ReminderLog.findAndCountAll({
      where: whereClause,
      order: [['sent_at', 'DESC']],
      limit: actualLimit,
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: actualLimit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
};

// Create reminder log entry
const createReminderLog = async (logData) => {
  try {
    const log = await ReminderLog.create({
      policy_id: logData.policy_id,
      policy_type: logData.policy_type,
      client_name: logData.client_name,
      client_email: logData.client_email,
      reminder_type: logData.reminder_type || 'email',
      reminder_day: logData.reminder_day,
      expiry_date: logData.expiry_date,
      status: logData.status || 'sent',
      email_subject: logData.email_subject,
      response_data: logData.response_data,
      error_message: logData.error_message,
      days_until_expiry: logData.days_until_expiry
    });
    
    console.log('✅ Reminder log created:', log.id);
    return log;
  } catch (error) {
    console.error('❌ Error creating reminder log:', error);
    return null;
  }
};

// Get renewal counts
const getCounts = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));

    const counts = {
      total: 0,
      upcoming: 0,
      expiringThisWeek: 0,
      expiringThisMonth: 0
    };

    // Get counts from all service types
    const [labourInspectionCount, labourLicenseCount, vehicleCount] = await Promise.all([
      LabourInspection.count(),
      LabourLicense.count(),
      VehiclePolicy.count()
    ]);

    counts.total = labourInspectionCount + labourLicenseCount + vehicleCount;
    
    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error fetching counts:', error);
    res.status(500).json({
        success: false,
      message: 'Error fetching counts',
      error: error.message
    });
  }
};

// Get renewal list by type and period
const getListByTypeAndPeriod = async (req, res) => {
  try {
    const { type, period = 30 } = req.query;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Service type is required'
      });
    }
    
    const today = new Date();
    const endDate = new Date(today.getTime() + (parseInt(period) * 24 * 60 * 60 * 1000));
    
    let renewalList = [];
    
    switch (type) {
      case 'vehicle':
        renewalList = await VehiclePolicy.findAll({
          where: {
            policy_end_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'companyPolicyHolder',
              attributes: ['company_id', 'company_name', 'company_email']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              attributes: ['consumer_id', 'name', 'email']
            }
          ],
          attributes: ['id', 'policy_number', 'vehicle_number', 'policy_end_date', 'company_id', 'consumer_id']
        });
        break;
        
      case 'ecp':
        renewalList = await EmployeeCompensationPolicy.findAll({
          where: {
            policy_end_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'policyHolder',
              attributes: ['company_id', 'company_name', 'company_email']
            }
          ],
          attributes: ['id', 'policy_number', 'policy_end_date', 'company_id']
        });
        break;
        
      case 'health':
        renewalList = await HealthPolicies.findAll({
          where: {
            policy_end_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'companyPolicyHolder',
              attributes: ['company_id', 'company_name', 'company_email']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              attributes: ['consumer_id', 'name', 'email']
            }
          ],
          attributes: ['id', 'policy_number', 'policy_end_date', 'company_id', 'consumer_id']
        });
        break;
        
      case 'fire':
        renewalList = await FirePolicy.findAll({
          where: {
            policy_end_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'companyPolicyHolder',
              attributes: ['company_id', 'company_name', 'company_email']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              attributes: ['consumer_id', 'name', 'email']
            }
          ],
          attributes: ['id', 'policy_number', 'policy_end_date', 'company_id', 'consumer_id']
        });
        break;
        
      case 'dsc':
        renewalList = await DSC.findAll({
          where: {
            expiry_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'company',
              attributes: ['company_id', 'company_name', 'company_email']
            },
            {
              model: Consumer,
              as: 'consumer',
              attributes: ['consumer_id', 'name', 'email']
            }
          ],
          attributes: ['dsc_id', 'certification_name', 'expiry_date', 'company_id', 'consumer_id', 'status']
        });
        break;
        
      case 'factory':
        renewalList = await FactoryQuotation.findAll({
          where: {
            renewal_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'company',
              attributes: ['company_id', 'company_name', 'company_email']
            }
          ],
          attributes: ['id', 'renewal_date', 'company_id']
        });
        break;
        
      case 'labour_license':
        renewalList = await LabourLicense.findAll({
          where: {
            expiry_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'company',
              attributes: ['company_id', 'company_name', 'company_email']
            }
          ],
          attributes: ['license_id', 'license_number', 'expiry_date', 'company_id']
        });
        break;
        
      case 'labour_inspection':
        renewalList = await LabourInspection.findAll({
          where: {
            expiry_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'company',
              attributes: ['company_id', 'company_name', 'company_email']
            }
          ],
          attributes: ['inspection_id', 'date_of_notice', 'expiry_date', 'company_id', 'officer_name', 'status']
        });
        break;
        
      case 'stability':
        renewalList = await StabilityManagement.findAll({
          where: {
            renewal_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: FactoryQuotation,
              as: 'factoryQuotation',
              attributes: ['id', 'company_id'],
              include: [
                {
                  model: Company,
                  as: 'company',
                  attributes: ['company_id', 'company_name', 'company_email']
                }
              ]
            }
          ],
          attributes: ['id', 'renewal_date', 'factory_quotation_id']
        });
        break;
        
      case 'life':
        renewalList = await LifePolicy.findAll({
          where: {
            policy_end_date: {
              [Op.between]: [today, endDate]
            }
          },
          include: [
            {
              model: Company,
              as: 'companyPolicyHolder',
              attributes: ['company_id', 'company_name', 'company_email']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              attributes: ['consumer_id', 'name', 'email']
            }
          ],
          attributes: ['id', 'current_policy_number', 'policy_end_date', 'company_id', 'consumer_id']
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: `Invalid service type: ${type}`
        });
    }
    
    // Format the response data
    const formattedData = renewalList.map(item => {
      const data = item.toJSON();
      const daysUntilExpiry = Math.ceil((new Date(data.policy_end_date || data.expiry_date || data.renewal_date) - today) / (1000 * 60 * 60 * 24));
      
      return {
        id: data.id || data.dsc_id || data.inspection_id || data.license_id,
        policyNumber: data.policy_number || data.certification_name || data.license_number || data.current_policy_number || data.dsc_id || data.inspection_id || data.id || 'N/A',
        expiryDate: data.policy_end_date || data.expiry_date || data.renewal_date,
        daysUntilExpiry,
        serviceType: type,
        companyName: data.policyHolder?.company_name || data.companyPolicyHolder?.company_name || data.company?.company_name || data.factoryQuotation?.company?.company_name || 'N/A',
        companyEmail: data.policyHolder?.company_email || data.companyPolicyHolder?.company_email || data.company?.company_email || data.factoryQuotation?.company?.company_email || 'N/A',
        consumerName: data.consumerPolicyHolder?.name || data.consumer?.name || 'N/A',
        consumerEmail: data.consumerPolicyHolder?.email || data.consumer?.email || 'N/A',
        clientName: data.policyHolder?.company_name || data.companyPolicyHolder?.company_name || data.company?.company_name || data.factoryQuotation?.company?.company_name || data.consumerPolicyHolder?.name || data.consumer?.name || 'N/A',
        clientEmail: data.policyHolder?.company_email || data.companyPolicyHolder?.company_email || data.company?.company_email || data.factoryQuotation?.company?.company_email || data.consumerPolicyHolder?.email || data.consumer?.email || 'N/A'
      };
    });
    
    res.json({
      success: true,
      data: formattedData,
      total: formattedData.length
    });
  } catch (error) {
    console.error('Error fetching renewal list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching renewal list',
      error: error.message
    });
  }
};

// Search renewals
const searchRenewals = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    const searchResults = [];
    
    // Search across all service types
    const searchPromises = [
      // Vehicle Insurance
      VehiclePolicy.findAll({
        where: {
          [Op.or]: [
            { policy_number: { [Op.like]: searchTerm } },
            { vehicle_number: { [Op.like]: searchTerm } }
          ],
          policy_end_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'companyPolicyHolder',
            attributes: ['company_id', 'company_name', 'company_email']
          },
          {
            model: Consumer,
            as: 'consumerPolicyHolder',
            attributes: ['consumer_id', 'name', 'email']
          }
        ],
        attributes: ['id', 'policy_number', 'vehicle_number', 'policy_end_date', 'company_id', 'consumer_id']
      }),
      
      // Health Insurance
      HealthPolicies.findAll({
        where: {
          policy_number: { [Op.like]: searchTerm },
          policy_end_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'companyPolicyHolder',
            attributes: ['company_id', 'company_name', 'company_email']
          },
          {
            model: Consumer,
            as: 'consumerPolicyHolder',
            attributes: ['consumer_id', 'name', 'email']
          }
        ],
        attributes: ['id', 'policy_number', 'policy_end_date', 'company_id', 'consumer_id']
      }),
      
      // Fire Insurance
      FirePolicy.findAll({
        where: {
          policy_number: { [Op.like]: searchTerm },
          policy_end_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'companyPolicyHolder',
            attributes: ['company_id', 'company_name', 'company_email']
          },
          {
            model: Consumer,
            as: 'consumerPolicyHolder',
            attributes: ['consumer_id', 'name', 'email']
          }
        ],
        attributes: ['id', 'policy_number', 'policy_end_date', 'company_id', 'consumer_id']
      }),
      
      // DSC
      DSC.findAll({
        where: {
          certificate_number: { [Op.like]: searchTerm },
          expiry_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'companyPolicyHolder',
            attributes: ['company_id', 'company_name', 'company_email']
          },
          {
            model: Consumer,
            as: 'consumerPolicyHolder',
            attributes: ['consumer_id', 'name', 'email']
          }
        ],
        attributes: ['dsc_id', 'certificate_number', 'expiry_date', 'company_id', 'consumer_id']
      }),
      
      // Factory Quotation
      FactoryQuotation.findAll({
        where: {
          id: { [Op.like]: searchTerm },
          renewal_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email']
          }
        ],
        attributes: ['id', 'renewal_date', 'company_id']
      }),
      
      // Labour License
      LabourLicense.findAll({
        where: {
          license_number: { [Op.like]: searchTerm },
          expiry_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email']
          }
        ],
        attributes: ['license_id', 'license_number', 'expiry_date', 'company_id']
      }),
      
      // Labour Inspection
      LabourInspection.findAll({
        where: {
          inspection_number: { [Op.like]: searchTerm },
          inspection_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email']
          }
        ],
        attributes: ['inspection_id', 'inspection_number', 'inspection_date', 'company_id']
      }),
      
      // Stability Management
      StabilityManagement.findAll({
        where: {
          renewal_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: FactoryQuotation,
            as: 'factoryQuotation',
            attributes: ['id', 'company_id'],
            include: [
              {
                model: Company,
                as: 'company',
                attributes: ['company_id', 'company_name', 'company_email']
              }
            ]
          }
        ],
        attributes: ['id', 'renewal_date', 'factory_quotation_id']
      }),
      
      // Life Insurance
      LifePolicy.findAll({
        where: {
          current_policy_number: { [Op.like]: searchTerm },
          policy_end_date: {
            [Op.between]: [today, thirtyDaysFromNow]
          }
        },
        include: [
          {
            model: Company,
            as: 'companyPolicyHolder',
            attributes: ['company_id', 'company_name', 'company_email']
          },
          {
            model: Consumer,
            as: 'consumerPolicyHolder',
            attributes: ['consumer_id', 'name', 'email']
          }
        ],
        attributes: ['id', 'current_policy_number', 'policy_end_date', 'company_id', 'consumer_id']
      })
    ];
    
    const results = await Promise.all(searchPromises);
    
    // Process results and add service type
    const serviceTypes = ['vehicle', 'health', 'fire', 'dsc', 'factory', 'labour_license', 'labour_inspection', 'stability', 'life'];
    
    results.forEach((result, index) => {
      const serviceType = serviceTypes[index];
      result.forEach(item => {
        const data = item.toJSON();
        const daysUntilExpiry = Math.ceil((new Date(data.policy_end_date || data.expiry_date || data.inspection_date || data.renewal_date) - today) / (1000 * 60 * 60 * 24));
        
        searchResults.push({
          id: data.id,
          policyNumber: data.policy_number || data.certificate_number || data.id || data.license_number || data.inspection_number || data.current_policy_number,
          expiryDate: data.policy_end_date || data.expiry_date || data.inspection_date || data.renewal_date,
          daysUntilExpiry,
          serviceType,
          companyName: data.companyPolicyHolder?.company_name || data.company?.company_name || 'N/A',
          companyEmail: data.companyPolicyHolder?.company_email || data.company?.company_email || 'N/A',
          consumerName: data.consumerPolicyHolder?.name || data.consumer?.name || 'N/A',
          consumerEmail: data.consumerPolicyHolder?.email || data.consumer?.email || 'N/A',
          clientName: data.companyPolicyHolder?.company_name || data.company?.company_name || data.consumerPolicyHolder?.name || data.consumer?.name || 'N/A',
          clientEmail: data.companyPolicyHolder?.company_email || data.company?.company_email || data.consumerPolicyHolder?.email || data.consumer?.email || 'N/A'
        });
      });
    });
    
    // Sort by days until expiry
    searchResults.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    
    res.json({
      success: true,
      data: searchResults,
      total: searchResults.length,
      query: q
    });
  } catch (error) {
    console.error('Error searching renewals:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching renewals',
      error: error.message
    });
  }
};

module.exports = {
  getAllConfigs,
  getConfigByService,
  createConfig,
  updateConfig,
  deleteConfig,
  getLiveRenewalData,
  getDefaultServiceTypes,
  getLogs,
  getCounts,
  getListByTypeAndPeriod,
  searchRenewals,
  getLabourInspectionLiveData,
  getLabourLicenseLiveData,
  getVehiclePolicyLiveData,
  createReminderLog
};
