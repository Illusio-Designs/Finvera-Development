const { LabourLicense, Company, PreviousLabourLicense } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/emailService');
const sequelize = require('../config/db');

// Create labour license
const createLabourLicense = async (req, res) => {
  try {
    const {
      company_id,
      license_number,
      type,
      issue_date,
      expiry_date,
      status,
      remarks
    } = req.body;

    // Validate required fields
    if (!company_id || !license_number || !type || !expiry_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: company_id, license_number, type, expiry_date'
      });
    }

    // Check if license number already exists
    const existingLicense = await LabourLicense.findOne({
      where: { license_number }
    });

    if (existingLicense) {
      return res.status(400).json({
        success: false,
        message: 'License number already exists'
      });
    }

    // Create labour license
    const labourLicense = await LabourLicense.create({
      company_id,
      license_number,
      type,
      issue_date,
      expiry_date,
      status: status || 'Active',
      remarks,
      email_service_active: true,
      created_by: req.user.user_id,
      updated_by: req.user.user_id
    });

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(file => file.path);
      await labourLicense.update({
        documents: filePaths
      });
    }

    res.status(201).json({
      success: true,
      message: 'Labour license created successfully',
      data: labourLicense
    });
  } catch (error) {
    console.error('Error creating labour license:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating labour license',
      error: error.message
    });
  }
};

// Get all labour licenses
const getAllLabourLicenses = async (req, res) => {
  try {
    const { page = 1, limit, pageSize, search, type, status } = req.query;
    const actualLimit = parseInt(pageSize) || parseInt(limit) || 10;
    const offset = (page - 1) * actualLimit;

    let whereClause = {};

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { license_number: { [Op.like]: `%${search}%` } },
        { '$company.company_name$': { [Op.like]: `%${search}%` } }
      ];
    }

    // Add type filter
    if (type) {
      whereClause.type = type;
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await LabourLicense.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['company_id', 'company_name', 'company_code']
        }
      ],
      limit: actualLimit,
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Update expired licenses automatically
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const license of rows) {
      const expiryDate = new Date(license.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      
      // If expiry date has passed and status is not already expired, update it
      if (expiryDate < today && license.status !== 'expired') {
        await license.update({ status: 'expired' });
      }
    }

    // Fetch updated data
    const updatedRows = await LabourLicense.findAll({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['company_id', 'company_name', 'company_code']
        }
      ],
      limit: actualLimit,
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: updatedRows,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        itemsPerPage: actualLimit,
        totalPages: Math.ceil(count / actualLimit),
        total: count,
        page: parseInt(page),
        limit: actualLimit
      }
    });
  } catch (error) {
    console.error('Error fetching labour licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching labour licenses',
      error: error.message
    });
  }
};

// Get labour license by ID
const getLabourLicenseById = async (req, res) => {
  try {
    const { id } = req.params;

    const labourLicense = await LabourLicense.findByPk(id, {
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['company_id', 'company_name', 'company_code']
        }
      ]
    });

    if (!labourLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    res.json({
      success: true,
      data: labourLicense
    });
  } catch (error) {
    console.error('Error fetching labour license:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching labour license',
      error: error.message
    });
  }
};

// Update labour license
const updateLabourLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_id,
      license_number,
      type,
      issue_date,
      expiry_date,
      status,
      remarks,
      email_service_active
    } = req.body;

    const labourLicense = await LabourLicense.findByPk(id);

    if (!labourLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    // Check if license number already exists (excluding current record)
    if (license_number && license_number !== labourLicense.license_number) {
      const existingLicense = await LabourLicense.findOne({
        where: { 
          license_number,
          id: { [Op.ne]: id }
        }
      });

      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already exists'
        });
      }
    }

    // Update labour license
    await labourLicense.update({
      company_id: company_id || labourLicense.company_id,
      license_number: license_number || labourLicense.license_number,
      type: type || labourLicense.type,
      issue_date: issue_date || labourLicense.issue_date,
      expiry_date: expiry_date || labourLicense.expiry_date,
      status: status || labourLicense.status,
      remarks: remarks !== undefined ? remarks : labourLicense.remarks,
      email_service_active: email_service_active !== undefined ? email_service_active : labourLicense.email_service_active,
      updated_by: req.user.user_id
    });

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(file => file.path);
      await labourLicense.update({
        documents: filePaths
      });
    }

    res.json({
      success: true,
      message: 'Labour license updated successfully',
      data: labourLicense
    });
  } catch (error) {
    console.error('Error updating labour license:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating labour license',
      error: error.message
    });
  }
};

// Delete labour license
const deleteLabourLicense = async (req, res) => {
  try {
    const { id } = req.params;

    const labourLicense = await LabourLicense.findByPk(id);

    if (!labourLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    await labourLicense.destroy();

    res.json({
      success: true,
      message: 'Labour license deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting labour license:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting labour license',
      error: error.message
    });
  }
};

// Upload labour license documents
const uploadLicenseDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const labourLicense = await LabourLicense.findByPk(id);

    if (!labourLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const filePaths = req.files.map(file => file.path);
    await labourLicense.update({
      documents: filePaths,
      updated_by: req.user.user_id
    });

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: { documents: filePaths }
    });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading documents',
      error: error.message
    });
  }
};

// Send labour license reminder
const sendLabourLicenseReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const labourLicense = await LabourLicense.findByPk(id, {
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['company_id', 'company_name', 'company_code', 'email']
        }
      ]
    });

    if (!labourLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    if (!labourLicense.company || !labourLicense.company.email) {
      return res.status(400).json({
        success: false,
        message: 'Company email not found'
      });
    }

    // Calculate days until expiry
    const today = new Date();
    const expiryDate = new Date(labourLicense.expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

    // Send email reminder
    const emailResult = await emailService.sendLabourLicenseReminder({
      companyName: labourLicense.company.company_name,
      companyEmail: labourLicense.company.email,
      licenseNumber: labourLicense.license_number,
      type: labourLicense.type,
      expiryDate: labourLicense.expiry_date,
      daysUntilExpiry
    });

    res.json({
      success: true,
      message: 'Reminder sent successfully',
      data: {
        emailResult,
        daysUntilExpiry
      }
    });
  } catch (error) {
    console.error('Error sending labour license reminder:', error);
    return {
      success: false,
      message: 'Failed to send reminder',
      error: error.message
    };
  }
};

// Get labour license stats overview
const getLabourLicenseStatsOverview = async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysFromNow = new Date(today.getTime() + (60 * 24 * 60 * 60 * 1000));

    const totalCount = await LabourLicense.count();
    const activeCount = await LabourLicense.count({
      where: { 
        status: 'Active',
        expiry_date: { [Op.gte]: today }
      }
    });
    const expiringSoonCount = await LabourLicense.count({
      where: { 
        expiry_date: { [Op.between]: [today, thirtyDaysFromNow] }
      }
    });
    const expiredCount = await LabourLicense.count({
      where: { 
        expiry_date: { [Op.lt]: today }
      }
    });

    res.json({
      success: true,
      data: {
        total: totalCount,
        active: activeCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
};

// Renew labour license
const renewLabourLicense = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      license_number,
      expiry_date,
      type,
      remarks
    } = req.body;

    console.log('🔄 Starting labour license renewal for ID:', id);

    // Validate required fields
    if (!license_number || !expiry_date || !type) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: license_number, expiry_date, type'
      });
    }

    // Get the current license
    const currentLicense = await LabourLicense.findByPk(id, {
      include: [{
        model: Company,
        as: 'company'
      }],
      transaction
    });

    if (!currentLicense) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    console.log('📋 Current license found:', currentLicense.license_number);

    // Create previous license record
    const previousLicenseData = {
      original_license_id: currentLicense.license_id,
      company_id: currentLicense.company_id,
      license_number: currentLicense.license_number,
      expiry_date: currentLicense.expiry_date,
      status: 'expired',
      type: currentLicense.type
    };

    const previousLicense = await PreviousLabourLicense.create(previousLicenseData, { transaction });
    console.log('✅ Previous license record created with ID:', previousLicense.id);

    // Update current license with new details
    await currentLicense.update({
      license_number,
      expiry_date,
      type,
      status: 'active',
      remarks: remarks || currentLicense.remarks,
      previous_license_id: previousLicense.id,
      updated_by: req.user.user_id
    }, { transaction });

    console.log('✅ Current license updated with new details');

    await transaction.commit();
    console.log('✅ Labour license renewal completed successfully');

    // Fetch updated license with associations
    const updatedLicense = await LabourLicense.findByPk(id, {
      include: [{
        model: Company,
        as: 'company'
      }]
    });

    res.json({
      success: true,
      message: 'Labour license renewed successfully',
      data: updatedLicense
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error renewing labour license:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew labour license',
      error: error.message
    });
  }
};

// Get previous licences for a specific license
const getPreviousLicenses = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get the current license to find its company
    const currentLicense = await LabourLicense.findByPk(id);
    
    if (!currentLicense) {
      return res.status(404).json({
        success: false,
        message: 'Labour license not found'
      });
    }

    // Get all previous licenses for this company
    const { count, rows } = await PreviousLabourLicense.findAndCountAll({
      where: {
        company_id: currentLicense.company_id
      },
      include: [{
        model: Company,
        as: 'company',
        attributes: ['company_id', 'company_name', 'company_code']
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching previous licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous licenses',
      error: error.message
    });
  }
};

// Get all licenses grouped (running + previous)
const getAllLicensesGrouped = async (req, res) => {
  try {
    const { page = 1, limit, pageSize } = req.query;
    const actualLimit = parseInt(pageSize) || parseInt(limit) || 10;
    const offset = (page - 1) * actualLimit;

    // Get all running licenses (both active and expired)
    const runningLicenses = await LabourLicense.findAll({
      include: [{
        model: Company,
        as: 'company',
        attributes: ['company_id', 'company_name', 'company_code']
      }],
      order: [['created_at', 'DESC']]
    });

    // Update expired licenses automatically
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const license of runningLicenses) {
      const expiryDate = new Date(license.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      
      // If expiry date has passed and status is not already expired, update it
      if (expiryDate < today && license.status !== 'expired') {
        await license.update({ status: 'expired' });
      }
    }

    // Fetch updated running licenses
    const updatedRunningLicenses = await LabourLicense.findAll({
      include: [{
        model: Company,
        as: 'company',
        attributes: ['company_id', 'company_name', 'company_code']
      }],
      order: [['created_at', 'DESC']]
    });

    // Get previous licenses
    const previousLicenses = await PreviousLabourLicense.findAll({
      include: [{
        model: Company,
        as: 'company',
        attributes: ['company_id', 'company_name', 'company_code']
      }],
      order: [['created_at', 'DESC']]
    });

    // Mark records with their type
    const runningWithType = updatedRunningLicenses.map(license => ({
      ...license.toJSON(),
      record_type: 'running'
    }));

    const previousWithType = previousLicenses.map(license => ({
      ...license.toJSON(),
      record_type: 'previous',
      status: 'expired' // Ensure previous records always show as expired
    }));

    // Combine and sort all records
    const allLicenses = [...runningWithType, ...previousWithType];
    allLicenses.sort((a, b) => {
      const dateA = new Date(a.record_type === 'running' ? a.created_at : a.created_at);
      const dateB = new Date(b.record_type === 'running' ? b.created_at : b.created_at);
      return dateB - dateA;
    });

    // Apply pagination
    const totalItems = allLicenses.length;
    const paginatedLicenses = allLicenses.slice(offset, offset + actualLimit);

    console.log(`✅ Grouped licenses: ${runningWithType.length} running (all statuses), ${previousWithType.length} previous`);

    res.json({
      success: true,
      data: paginatedLicenses,
      currentPage: parseInt(page),
      pageSize: actualLimit,
      totalPages: Math.ceil(totalItems / actualLimit),
      totalItems: totalItems
    });
  } catch (error) {
    console.error('Error fetching grouped licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grouped licenses',
      error: error.message
    });
  }
};

// Search labour licenses
const searchLabourLicenses = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const licenses = await LabourLicense.findAll({
      where: {
        [Op.or]: [
          { license_number: { [Op.like]: `%${query}%` } },
          { '$company.company_name$': { [Op.like]: `%${query}%` } },
          { '$company.company_code$': { [Op.like]: `%${query}%` } }
        ]
      },
      include: [{
        model: Company,
        as: 'company',
        attributes: ['company_id', 'company_name', 'company_code']
      }],
      limit: 50
    });

    res.json({
      success: true,
      data: licenses
    });
  } catch (error) {
    console.error('Error searching labour licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search labour licenses',
      error: error.message
    });
  }
};

// Get statistics
const getStatistics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));

    // Update expired licenses first
    await LabourLicense.update(
      { status: 'expired' },
      {
        where: {
          expiry_date: {
            [Op.lt]: today
          },
          status: {
            [Op.ne]: 'expired'
          }
        }
      }
    );

    const total = await LabourLicense.count();
    
    const byStatus = {
      active: await LabourLicense.count({ where: { status: 'active' } }),
      expired: await LabourLicense.count({ where: { status: 'expired' } }),
      suspended: await LabourLicense.count({ where: { status: 'suspended' } }),
      renewed: await LabourLicense.count({ where: { status: 'renewed' } })
    };

    const expiringSoon = await LabourLicense.count({
      where: {
        expiry_date: {
          [Op.between]: [today, thirtyDaysFromNow]
        },
        status: 'active' // Only count active licenses that are expiring soon
      }
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus,
        expiringSoon
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// Check and update expired licenses
const checkAndUpdateExpiredLicenses = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all licenses that are expired by date but not marked as expired
    const expiredLicenses = await LabourLicense.findAll({
      where: {
        expiry_date: {
          [Op.lt]: today
        },
        status: {
          [Op.ne]: 'expired'
        }
      }
    });

    console.log(`Found ${expiredLicenses.length} licenses to mark as expired`);

    // Update all expired licenses
    const updatePromises = expiredLicenses.map(license => 
      license.update({ status: 'expired' })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Updated ${expiredLicenses.length} expired licenses`,
      count: expiredLicenses.length
    });
  } catch (error) {
    console.error('Error checking expired licenses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check expired licenses',
      error: error.message
    });
  }
};

module.exports = {
  createLabourLicense,
  getAllLabourLicenses,
  getLabourLicenseById,
  updateLabourLicense,
  deleteLabourLicense,
  uploadLicenseDocuments,
  sendLabourLicenseReminder,
  getLabourLicenseStatsOverview,
  renewLabourLicense,
  getPreviousLicenses,
  getAllLicensesGrouped,
  searchLabourLicenses,
  getStatistics,
  checkAndUpdateExpiredLicenses
};