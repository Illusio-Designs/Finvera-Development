const StabilityManagement = require('../models/stabilityManagementModel');
const PreviousStabilityManagement = require('../models/previousStabilityManagementModel');
const FactoryQuotation = require('../models/factoryQuotationModel');
const ApplicationManagement = require('../models/applicationManagementModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const UserRole = require('../models/userRoleModel');
const UserRoleWorkLog = require('../models/userRoleWorkLogModel');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const fs = require('fs');
const path = require('path');

// Get stability managers (users with Stability_manager role)
const getStabilityManagers = async (req, res) => {
  try {
    const stabilityManagerRole = await Role.findOne({
      where: { role_name: 'Stability_manager' }
    });

    if (!stabilityManagerRole) {
      return res.status(404).json({
        success: false,
        message: 'Stability_manager role not found'
      });
    }

    const stabilityManagers = await User.findAll({
      include: [{
        model: Role,
        as: 'roles',
        through: UserRole,
        where: { role_name: 'Stability_manager' }
      }],
      attributes: ['user_id', 'username', 'email']
    });

    res.json({
      success: true,
      data: stabilityManagers
    });
  } catch (error) {
    console.error('Error fetching stability managers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stability managers',
      error: error.message
    });
  }
};

// Get all stability management records (Admin can see all, Stability Manager sees only their own)
const getAllStabilityManagement = async (req, res) => {
  try {
    const { user } = req;
    console.log('📋 Stability Management - Fetching records for user:', user.user_id);
    
    // Handle both array and object formats
    let userRoles = [];
    if (Array.isArray(user.roles)) {
      userRoles = user.roles.map(role => role.role_name || role);
    } else if (user.roles) {
      userRoles = [user.roles];
    }
    
    const isAdmin = userRoles.includes('Admin');
    const isStabilityManager = userRoles.includes('Stability_manager');

    console.log('👤 User roles:', userRoles.join(', '), '- Admin:', isAdmin, 'Stability Manager:', isStabilityManager);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    let whereClause = {};
    
    // If user is stability manager, only show their assigned records
    if (isStabilityManager && !isAdmin) {
      whereClause.stability_manager_id = user.user_id;
      console.log('🔍 Filtering records for stability manager:', user.user_id);
    }

    const { count, rows } = await StabilityManagement.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'factory_quotation_id', 'stability_manager_id', 'status', 'load_type', 'stability_date', 'renewal_date', 'remarks', 'files', 'submitted_at', 'reviewed_at', 'reviewed_by', 'created_at', 'updated_at'],
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    console.log('✅ Found', count, 'stability management records');
    
    if (rows.length > 0) {
      console.log('📊 Records summary:', rows.map(row => ({
        id: row.id,
        company: row.factoryQuotation?.companyName || 'N/A',
        manager: row.stabilityManager?.username || 'N/A',
        status: row.status
      })));
    } else {
      console.log('⚠️ No stability records found for this user');
    }

    res.json({
      success: true,
      data: rows,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
      totalItems: count
    });
  } catch (error) {
    console.error('Error fetching stability management records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stability management records',
      error: error.message
    });
  }
};

// Search stability management records
const searchStabilityManagement = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters long'
      });
    }

    const searchQuery = query.trim();
    let whereClause = {};
    
    // Role-based filtering
    if (req.user.roles) {
      const userRoles = req.user.roles.map(role => role.role_name);
      const isStabilityManager = userRoles.includes('Stability_manager');
      const isAdmin = userRoles.includes('Admin');
      
      if (!isStabilityManager && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only Stability Managers and Admins can search stability records.'
        });
      }
      
      // Stability managers can only see their own records
      if (isStabilityManager && !isAdmin) {
        whereClause.stability_manager_id = req.user.user_id;
      }
    }

    const stabilityRecords = await StabilityManagement.findAll({
      where: {
        ...whereClause,
        [Op.or]: [
          {
            '$factoryQuotation.companyName$': {
              [Op.like]: `%${searchQuery}%`
            }
          },
          {
            status: {
              [Op.like]: `%${searchQuery}%`
            }
          },
          {
            '$stabilityManager.username$': {
              [Op.like]: `%${searchQuery}%`
            }
          }
        ]
      },
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'status']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: stabilityRecords });
  } catch (error) {
    console.error('Error searching stability management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search stability management',
      error: error.message
    });
  }
};

// Get stability management by factory quotation ID
const getStabilityManagementByQuotationId = async (req, res) => {
  try {
    const { quotationId } = req.params;

    const stabilityRecord = await StabilityManagement.findOne({
      where: { factory_quotation_id: quotationId },
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation'
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        }
      ]
    });

    if (!stabilityRecord) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    res.json({
      success: true,
      data: stabilityRecord
    });
  } catch (error) {
    console.error('Error fetching stability management record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stability management record',
      error: error.message
    });
  }
};

// Create stability management (assign to stability manager) - Admin and Compliance Manager only
const createStabilityManagement = async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    const { factory_quotation_id, stability_manager_id, load_type } = req.body;
    const { user } = req;

    console.log('Extracted values:', { factory_quotation_id, stability_manager_id, load_type });

    // Validate required fields
    if (!factory_quotation_id || !stability_manager_id || !load_type) {
      console.log('Missing required fields:', { factory_quotation_id, stability_manager_id, load_type });
      return res.status(400).json({
        success: false,
        message: 'Factory quotation ID, stability manager ID, and load type are required'
      });
    }

    // Validate load type
    if (!['with_load', 'without_load'].includes(load_type)) {
      console.log('Invalid load_type:', load_type);
      return res.status(400).json({
        success: false,
        message: 'Load type must be either "with_load" or "without_load"'
      });
    }

    // Check if factory quotation exists
    const factoryQuotation = await FactoryQuotation.findByPk(factory_quotation_id);
    if (!factoryQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Factory quotation not found'
      });
    }

    // Check if stability manager exists and has the correct role
    const stabilityManager = await User.findOne({
      where: { user_id: stability_manager_id },
      include: [{
        model: Role,
        as: 'roles',
        through: UserRole,
        where: { role_name: 'Stability_manager' }
      }]
    });

    if (!stabilityManager) {
      return res.status(404).json({
        success: false,
        message: 'Stability manager not found or does not have the correct role'
      });
    }

    // Check if stability management already exists for this quotation
    const existingRecord = await StabilityManagement.findOne({
      where: { factory_quotation_id }
    });

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: 'Stability management already exists for this factory quotation'
      });
    }

    // Create stability management record
    const stabilityManagement = await StabilityManagement.create({
      factory_quotation_id,
      stability_manager_id,
      load_type,
      status: 'stability'
    });

    // Update factory quotation status to 'stability'
    await factoryQuotation.update({ status: 'stability' });

    res.status(201).json({
      success: true,
      message: 'Stability management created successfully',
      data: stabilityManagement
    });
  } catch (error) {
    console.error('Error creating stability management:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stability management',
      error: error.message
    });
  }
};

// Update stability status (Stability Manager only)
const updateStabilityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, stability_date } = req.body;
    const { user } = req;

    // Validate status
    if (!['stability', 'submit', 'Approved', 'Reject', 'Expired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "stability", "submit", "Approved", "Reject", or "Expired"'
      });
    }

    // Find the stability management record
    const stabilityManagement = await StabilityManagement.findByPk(id);
    if (!stabilityManagement) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    // Check if user is the assigned stability manager or admin
    const isAdmin = user.roles.includes('Admin');
    const isAssignedManager = stabilityManagement.stability_manager_id === user.user_id;

    if (!isAdmin && !isAssignedManager) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this stability management record'
      });
    }

    // Update the record
    const updateData = { status };
    
    if (status === 'submit') {
      updateData.submitted_at = new Date();
    } else if (['Approved', 'Reject'].includes(status)) {
      updateData.reviewed_at = new Date();
      updateData.reviewed_by = user.user_id;
    }

    if (remarks) {
      updateData.remarks = remarks;
    }

    // Handle stability date when status is Approved
    if (status === 'Approved' && stability_date) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(stability_date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      // Calculate renewal date (5 years after stability date, minus 1 day)
      const stabilityDate = new Date(stability_date);
      const renewalDate = new Date(stabilityDate);
      renewalDate.setFullYear(renewalDate.getFullYear() + 5);
      renewalDate.setDate(renewalDate.getDate() - 1); // Subtract 1 day

      updateData.stability_date = stability_date;
      updateData.renewal_date = renewalDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }

    await stabilityManagement.update(updateData);

    // If stability is approved, automatically create application management
    if (status === 'Approved') {
      try {
        // Check if application management already exists
        const existingApplication = await ApplicationManagement.findOne({
          where: { factory_quotation_id: stabilityManagement.factory_quotation_id }
        });

        if (!existingApplication) {
          // Create application management automatically
          await ApplicationManagement.create({
            factory_quotation_id: stabilityManagement.factory_quotation_id,
            compliance_manager_id: null, // No specific compliance manager assigned
            status: 'application'
          });

          // Update factory quotation status to 'application'
          await FactoryQuotation.update(
            { status: 'application' },
            { where: { id: stabilityManagement.factory_quotation_id } }
          );

          console.log('Application management created automatically for quotation:', stabilityManagement.factory_quotation_id);
        }
      } catch (error) {
        console.error('Error creating automatic application management:', error);
        // Don't fail the stability update if application creation fails
      }
    }

    res.json({
      success: true,
      message: 'Stability status updated successfully',
      data: stabilityManagement
    });
  } catch (error) {
    console.error('Error updating stability status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stability status',
      error: error.message
    });
  }
};

// Update stability dates (Stability Manager only)
const updateStabilityDates = async (req, res) => {
  try {
    const { id } = req.params;
    const { stability_date } = req.body;
    const { user } = req;

    // Validate stability date
    if (!stability_date) {
      return res.status(400).json({
        success: false,
        message: 'Stability date is required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(stability_date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Find the stability management record
    const stabilityManagement = await StabilityManagement.findByPk(id);
    if (!stabilityManagement) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    // Check if user is the assigned stability manager or admin
    const isAdmin = user.roles.includes('Admin');
    const isAssignedManager = stabilityManagement.stability_manager_id === user.user_id;

    if (!isAdmin && !isAssignedManager) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this stability management record'
      });
    }

    // Calculate renewal date (5 years after stability date, minus 1 day)
    const stabilityDate = new Date(stability_date);
    const renewalDate = new Date(stabilityDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + 5);
    renewalDate.setDate(renewalDate.getDate() - 1); // Subtract 1 day

    // Update the record
    await stabilityManagement.update({
      stability_date: stability_date,
      renewal_date: renewalDate.toISOString().split('T')[0] // Format as YYYY-MM-DD
    });

    res.json({
      success: true,
      message: 'Stability dates updated successfully',
      data: {
        ...stabilityManagement.toJSON(),
        renewal_date: renewalDate.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error updating stability dates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stability dates',
      error: error.message
    });
  }
};

// Upload files for stability (Stability Manager and Admin only)
const uploadStabilityFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const isStabilityManager = user.roles.includes('Stability_manager');
    const isAdmin = user.roles.includes('Admin');

    if (!isStabilityManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only stability managers and admins can upload files'
      });
    }

    // Build where clause - admin can upload files for any stability record, stability manager only their own
    const whereClause = { id };
    if (isStabilityManager && !isAdmin) {
      whereClause.stability_manager_id = user.user_id;
    }

    const stabilityManagement = await StabilityManagement.findOne({ where: whereClause });

    if (!stabilityManagement) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files uploaded for stability record:', id);
      return res.status(400).json({
        success: false,
        message: 'No files were uploaded'
      });
    }

    console.log('✅ Files uploaded for stability record:', id, '- Count:', req.files.length);
    console.log('📁 Current stability record files:', {
      files: stabilityManagement.files,
      filesType: typeof stabilityManagement.files
    });

    // Process uploaded files
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date()
    }));

    // Get existing files or initialize empty array
    let existingFiles = [];
    if (stabilityManagement.files) {
      try {
        // Handle both JSON string and already parsed object
        existingFiles = typeof stabilityManagement.files === 'string' 
          ? JSON.parse(stabilityManagement.files) 
          : stabilityManagement.files;
      } catch (error) {
        console.error('Error parsing existing files:', error);
        existingFiles = []; // Fallback to empty array if parsing fails
      }
    }
    const updatedFiles = [...existingFiles, ...uploadedFiles];

    console.log('📊 File processing summary:', {
      existingFilesCount: existingFiles.length,
      newFilesCount: uploadedFiles.length,
      totalFilesCount: updatedFiles.length
    });

    // Update stability management with new files and status
    await stabilityManagement.update({
      files: JSON.stringify(updatedFiles),
      status: 'Approved', // Update status to Approved when files are uploaded
      reviewed_at: new Date(),
      reviewed_by: user.user_id
    });

    console.log('✅ Stability management record updated successfully');

    res.json({
      success: true,
      message: 'Files uploaded and stability approved successfully',
      data: {
        uploadedFiles,
        totalFiles: updatedFiles.length,
        status: 'Approved'
      }
    });
  } catch (error) {
    console.error('❌ Error uploading stability files:', {
      message: error.message,
      stack: error.stack,
      recordId: req.params.id,
      userId: req.user?.user_id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
};

// Get stability files (Stability Manager and Admin only)
const getStabilityFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const isStabilityManager = user.roles.includes('Stability_manager');
    const isAdmin = user.roles.includes('Admin');

    if (!isStabilityManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only stability managers and admins can view files'
      });
    }

    // Build where clause - admin can view files for any stability record, stability manager only their own
    const whereClause = { id };
    if (isStabilityManager && !isAdmin) {
      whereClause.stability_manager_id = user.user_id;
    }

    const stabilityManagement = await StabilityManagement.findOne({ where: whereClause });

    if (!stabilityManagement) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    const files = stabilityManagement.files ? JSON.parse(stabilityManagement.files) : [];

    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching stability files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stability files',
      error: error.message
    });
  }
};

// Get stability management statistics
const getStatistics = async (req, res) => {
  try {
    // Get total stability records count
    const total = await StabilityManagement.count();

    // Get count by status
    const stability = await StabilityManagement.count({
      where: { status: 'stability' }
    });

    const submit = await StabilityManagement.count({
      where: { status: 'submit' }
    });

    const approved = await StabilityManagement.count({
      where: { status: 'Approved' }
    });

    const rejected = await StabilityManagement.count({
      where: { status: 'Reject' }
    });

    // Get count by load type
    const withLoad = await StabilityManagement.count({
      where: { load_type: 'with_load' }
    });

    const withoutLoad = await StabilityManagement.count({
      where: { load_type: 'without_load' }
    });

    // Get recent records count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recent = await StabilityManagement.count({
      where: {
        created_at: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    res.json({
      success: true,
      data: {
        total,
        stability,
        submit,
        approved,
        rejected,
        withLoad,
        withoutLoad,
        recent
      }
    });
  } catch (error) {
    console.error('Error fetching stability management statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get stability management statistics',
      error: error.message
    });
  }
};

// Renew stability management
const renewStability = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { user } = req;
    const {
      stability_manager_id,
      load_type,
      stability_date,
      remarks
    } = req.body;

    console.log('🔄 Starting stability renewal process for ID:', id);
    console.log('📋 Renewal data:', { stability_manager_id, load_type, stability_date, remarks });

    // Validate required fields
    if (!stability_manager_id || !load_type || !stability_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Stability manager ID, load type, and stability date are required'
      });
    }

    // Find the original stability record
    const originalStability = await StabilityManagement.findByPk(id, {
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      transaction
    });

    if (!originalStability) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Original stability record not found'
      });
    }

    // Check if stability manager exists and has the correct role
    const stabilityManager = await User.findOne({
      where: { user_id: stability_manager_id },
      include: [{
        model: Role,
        as: 'roles',
        through: UserRole,
        where: { role_name: 'Stability_manager' }
      }],
      transaction
    });

    if (!stabilityManager) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Stability manager not found or does not have the correct role'
      });
    }

    // Calculate renewal date (5 years after stability date, minus 1 day)
    const stabilityDateObj = new Date(stability_date);
    const renewalDate = new Date(stabilityDateObj);
    renewalDate.setFullYear(renewalDate.getFullYear() + 5);
    renewalDate.setDate(renewalDate.getDate() - 1);

    console.log('📅 Calculated renewal date:', renewalDate.toISOString().split('T')[0]);

    // Move original stability to previous table
    const previousStabilityData = {
      original_stability_id: originalStability.id,
      factory_quotation_id: originalStability.factory_quotation_id,
      stability_manager_id: originalStability.stability_manager_id,
      status: originalStability.status,
      load_type: originalStability.load_type,
      stability_date: originalStability.stability_date,
      renewal_date: originalStability.renewal_date,
      remarks: originalStability.remarks,
      files: originalStability.files,
      submitted_at: originalStability.submitted_at,
      reviewed_at: originalStability.reviewed_at,
      reviewed_by: originalStability.reviewed_by,
      renewed_at: new Date(),
      created_at: originalStability.created_at,
      updated_at: originalStability.updated_at
    };

    const previousStability = await PreviousStabilityManagement.create(previousStabilityData, { transaction });
    console.log('✅ Previous stability record created with ID:', previousStability.id);

    // Handle file upload if provided
    let uploadedFiles = [];
    if (req.file) {
      uploadedFiles = [{
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date()
      }];
      console.log('📁 File uploaded:', req.file.filename);
    }

    // Update original stability with new renewal data
    const updatedStabilityData = {
      stability_manager_id,
      load_type,
      stability_date,
      renewal_date: renewalDate.toISOString().split('T')[0],
      remarks: remarks || null,
      files: uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : originalStability.files,
      status: 'Approved', // Set to approved for renewed stability
      previous_stability_id: previousStability.id,
      reviewed_at: new Date(),
      reviewed_by: user.user_id,
      updated_at: new Date()
    };

    await originalStability.update(updatedStabilityData, { transaction });
    console.log('✅ Original stability record updated');

    // Create audit log entry
    await UserRoleWorkLog.create({
      user_id: user.user_id,
      target_user_id: stability_manager_id, // Use the stability manager as target user
      action: 'renewed_stability',
      details: `Renewed stability for ${originalStability.factoryQuotation?.companyName || 'Unknown Company'}. Previous stability ID: ${previousStability.id}, New stability date: ${stability_date}, New renewal date: ${renewalDate.toISOString().split('T')[0]}`,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent') || 'Unknown'
    }, { transaction });

    console.log('📝 Audit log created for stability renewal');

    await transaction.commit();
    console.log('✅ Stability renewal completed successfully');

    // Fetch updated record with associations
    const renewedStability = await StabilityManagement.findByPk(id, {
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Stability renewed successfully',
      data: renewedStability
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error renewing stability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew stability',
      error: error.message
    });
  }
};

// Get previous stabilities
const getPreviousStabilities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await PreviousStabilityManagement.findAndCountAll({
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      limit,
      offset,
      order: [['renewed_at', 'DESC']]
    });

    res.json({
      success: true,
      data: rows,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
      totalItems: count
    });
  } catch (error) {
    console.error('Error fetching previous stabilities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous stabilities',
      error: error.message
    });
  }
};

// Get previous stability by ID
const getPreviousStabilityById = async (req, res) => {
  try {
    const { id } = req.params;

    const previousStability = await PreviousStabilityManagement.findByPk(id, {
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ]
    });

    if (!previousStability) {
      return res.status(404).json({
        success: false,
        message: 'Previous stability record not found'
      });
    }

    res.json({
      success: true,
      data: previousStability
    });
  } catch (error) {
    console.error('Error fetching previous stability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous stability',
      error: error.message
    });
  }
};

// Get all stabilities grouped (running + previous)
const getAllStabilitiesGrouped = async (req, res) => {
  try {
    const { user } = req;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    // Handle both array and object formats for user roles
    let userRoles = [];
    if (Array.isArray(user.roles)) {
      userRoles = user.roles.map(role => role.role_name || role);
    } else if (user.roles) {
      userRoles = [user.roles];
    }
    
    const isAdmin = userRoles.includes('Admin');
    const isStabilityManager = userRoles.includes('Stability_manager');

    let whereClause = {};
    
    // If user is stability manager, only show their assigned records
    if (isStabilityManager && !isAdmin) {
      whereClause.stability_manager_id = user.user_id;
    }

    // Get running stabilities
    const runningStabilities = await StabilityManagement.findAll({
      where: whereClause,
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Get previous stabilities
    const previousStabilities = await PreviousStabilityManagement.findAll({
      where: whereClause,
      include: [
        {
          model: FactoryQuotation,
          as: 'factoryQuotation',
          attributes: ['id', 'companyName', 'companyAddress', 'email', 'phone']
        },
        {
          model: User,
          as: 'stabilityManager',
          attributes: ['user_id', 'username', 'email']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['user_id', 'username', 'email']
        }
      ],
      order: [['renewed_at', 'DESC']]
    });

    // Mark records with their type
    const runningWithType = runningStabilities.map(stability => ({
      ...stability.toJSON(),
      record_type: 'running'
    }));

    const previousWithType = previousStabilities.map(stability => ({
      ...stability.toJSON(),
      record_type: 'previous'
    }));

    // Combine and sort all records
    const allStabilities = [...runningWithType, ...previousWithType];
    allStabilities.sort((a, b) => {
      const dateA = new Date(a.record_type === 'running' ? a.created_at : a.renewed_at);
      const dateB = new Date(b.record_type === 'running' ? b.created_at : b.renewed_at);
      return dateB - dateA;
    });

    // Apply pagination
    const totalItems = allStabilities.length;
    const paginatedStabilities = allStabilities.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedStabilities,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(totalItems / limit),
      totalItems: totalItems
    });
  } catch (error) {
    console.error('Error fetching grouped stabilities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch grouped stabilities',
      error: error.message
    });
  }
};
// Delete stability file (Stability Manager and Admin only)
const deleteStabilityFile = async (req, res) => {
  try {
    const { id, filename } = req.params;
    const { user } = req;
    const isStabilityManager = user.roles.includes('Stability_manager');
    const isAdmin = user.roles.includes('Admin');

    if (!isStabilityManager && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only stability managers and admins can delete files'
      });
    }

    // Build where clause - admin can delete files for any stability record, stability manager only their own
    const whereClause = { id };
    if (isStabilityManager && !isAdmin) {
      whereClause.stability_manager_id = user.user_id;
    }

    const stabilityManagement = await StabilityManagement.findOne({ where: whereClause });

    if (!stabilityManagement) {
      return res.status(404).json({
        success: false,
        message: 'Stability management record not found'
      });
    }

    const files = stabilityManagement.files ? JSON.parse(stabilityManagement.files) : [];
    const fileIndex = files.findIndex(file => file.filename === filename);

    if (fileIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileToDelete = files[fileIndex];
    const filePath = fileToDelete.path;

    // Remove file from filesystem
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove file from database
    files.splice(fileIndex, 1);
    await stabilityManagement.update({
      files: JSON.stringify(files)
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stability file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
};

module.exports = {
  getStabilityManagers,
  getAllStabilityManagement,
  searchStabilityManagement,
  getStabilityManagementByQuotationId,
  createStabilityManagement,
  updateStabilityStatus,
  updateStabilityDates,
  uploadStabilityFiles,
  getStabilityFiles,
  deleteStabilityFile,
  getStatistics,
  renewStability,
  getPreviousStabilities,
  getPreviousStabilityById,
  getAllStabilitiesGrouped
}; 