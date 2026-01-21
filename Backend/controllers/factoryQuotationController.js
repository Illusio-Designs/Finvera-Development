const FactoryQuotation = require('../models/factoryQuotationModel');
const PlanManagement = require('../models/planManagementModel');
const StabilityManagement = require('../models/stabilityManagementModel');
const ApplicationManagement = require('../models/applicationManagementModel');
const User = require('../models/userModel');
const Role = require('../models/roleModel');
const UserRole = require('../models/userRoleModel');
const sequelize = require('../config/db');
const { QueryTypes } = require('sequelize');
const path = require('path');
const { 
  calculateBaseAmount, 
  calculateTotalAmount, 
  getHorsePowerOptions, 
  getNoOfWorkersOptions 
} = require('../utils/factoryQuotationCalculator');
const FactoryQuotationPDFGenerator = require('../utils/pdfGenerator');
const EmailService = require('../services/emailService');

// Get calculation options
exports.getCalculationOptions = async (req, res) => {
  try {
    const horsePowerOptions = getHorsePowerOptions();
    const noOfWorkersOptions = getNoOfWorkersOptions();
    
    res.json({ 
      success: true, 
      data: {
        horsePowerOptions,
        noOfWorkersOptions
      }
    });
  } catch (error) {
    console.error('Error getting calculation options:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Calculate amount based on horse power and number of workers
exports.calculateAmount = async (req, res) => {
  try {
    const { horsePower, noOfWorkers } = req.body;
    
    if (!horsePower || !noOfWorkers) {
      return res.status(400).json({ 
        success: false, 
        message: 'Horse power and number of workers are required' 
      });
    }
    
    const calculatedAmount = calculateBaseAmount(horsePower, noOfWorkers);
    
    res.json({ 
      success: true, 
      data: { calculatedAmount }
    });
  } catch (error) {
    console.error('Error calculating amount:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Create a new quotation
exports.createQuotation = async (req, res) => {
  try {
    const quotationData = {
      ...req.body,
      createdBy: req.user.user_id, // Add the user ID from the authenticated user
      assignedToRole: req.user.roles?.[0] || 'Admin' // Assign to the user's primary role
    };
    
    const quotation = await FactoryQuotation.create(quotationData);
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    console.error('Error creating factory quotation:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get a quotation by ID
exports.getQuotationById = async (req, res) => {
  try {
    const quotation = await FactoryQuotation.findByPk(req.params.id, {
      include: [
        {
          model: PlanManagement,
          as: 'planManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'planManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: StabilityManagement,
          as: 'stabilityManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'stabilityManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: ApplicationManagement,
          as: 'applicationManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'applicationManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        }
      ]
    });
    
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all quotations
exports.getAllQuotations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await FactoryQuotation.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PlanManagement,
          as: 'planManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'planManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: StabilityManagement,
          as: 'stabilityManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'stabilityManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: ApplicationManagement,
          as: 'applicationManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'complianceManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({ 
      success: true, 
      quotations: rows,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
      totalItems: count
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Search quotations
exports.searchQuotations = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 3 characters long'
      });
    }

    const searchQuery = query.trim();
    
    const quotations = await FactoryQuotation.findAll({
      where: {
        [require('sequelize').Op.or]: [
          {
            '$company.companyName$': {
              [require('sequelize').Op.like]: `%${searchQuery}%`
            }
          },
          {
            status: {
              [require('sequelize').Op.like]: `%${searchQuery}%`
            }
          },
          {
            '$complianceManager.username$': {
              [require('sequelize').Op.like]: `%${searchQuery}%`
            }
          }
        ]
      },
      include: [
        {
          model: require('../models/companyModel'),
          as: 'company',
          attributes: ['company_id', 'company_name', 'company_code']
        },
        {
          model: require('../models/userModel'),
          as: 'complianceManager',
          attributes: ['user_id', 'username']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, data: quotations });
  } catch (error) {
    console.error('Error searching quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search quotations',
      error: error.message
    });
  }
};

// Update a quotation
exports.updateQuotation = async (req, res) => {
  try {
    const [updated] = await FactoryQuotation.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Quotation not found' });
    
    const updatedQuotation = await FactoryQuotation.findByPk(req.params.id, {
      include: [
        {
          model: PlanManagement,
          as: 'planManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'planManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: StabilityManagement,
          as: 'stabilityManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'stabilityManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: ApplicationManagement,
          as: 'applicationManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'complianceManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        }
      ]
    });
    
    res.json({ success: true, data: updatedQuotation });
  } catch (error) {
    console.error('Error updating factory quotation:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update quotation status
exports.updateStatus = async (req, res) => {
  try {
    console.log('updateStatus - req.body:', req.body);
    console.log('updateStatus - req.params:', req.params);
    
    const { status } = req.body;
    const quotationId = req.params.id;
    
    console.log('updateStatus - extracted status:', status);
    console.log('updateStatus - quotationId:', quotationId);
    
    const [updated] = await FactoryQuotation.update(
      { status },
      { where: { id: quotationId } }
    );
    
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // If status is changed to 'application', automatically create application management record
    if (status === 'application') {
      try {
        // Check if application management record already exists
        const existingApplication = await ApplicationManagement.findOne({
          where: { factory_quotation_id: quotationId }
        });

        if (!existingApplication) {
          // Get the first available compliance manager
          const complianceManager = await User.findOne({
            include: [
              {
                model: Role,
                as: 'roles',
                through: UserRole,
                where: { role_name: 'Compliance_manager' }
              }
            ],
            attributes: ['user_id', 'username', 'email']
          });

          if (complianceManager) {
            // Create application management record
            await ApplicationManagement.create({
              factory_quotation_id: quotationId,
              compliance_manager_id: complianceManager.user_id,
              status: 'application'
            });
            console.log('✅ Application management record created automatically for quotation:', quotationId);
          } else {
            console.log('⚠️ No compliance manager found for automatic assignment');
          }
        } else {
          console.log('✅ Application management record already exists for quotation:', quotationId);
        }
      } catch (appError) {
        console.error('Error creating application management record:', appError);
        // Don't fail the status update if application creation fails
      }
    }
    
    const updatedQuotation = await FactoryQuotation.findByPk(quotationId, {
      include: [
        {
          model: PlanManagement,
          as: 'planManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'planManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: StabilityManagement,
          as: 'stabilityManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'stabilityManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        },
        {
          model: ApplicationManagement,
          as: 'applicationManagement',
          include: [
            {
              model: require('../models/userModel'),
              as: 'complianceManager',
              attributes: ['user_id', 'username', 'email']
            },
            {
              model: require('../models/userModel'),
              as: 'reviewer',
              attributes: ['user_id', 'username', 'email']
            }
          ]
        }
      ]
    });
    
    // Send status update email to client
    try {
      const emailService = new EmailService();
      await emailService.sendFactoryQuotationStatusUpdate({
        companyName: updatedQuotation.companyName,
        email: updatedQuotation.email,
        status: updatedQuotation.status,
        quotationId: `FQ-${updatedQuotation.year}-${String(updatedQuotation.id).padStart(3, '0')}`,
        totalAmount: updatedQuotation.totalAmount,
        assignedToRole: updatedQuotation.assignedToRole || 'Admin',
        year: updatedQuotation.year,
        quotationDbId: updatedQuotation.id
      });
      console.log(`✅ Factory Quotation status update email sent to: ${updatedQuotation.email}`);
    } catch (emailError) {
      console.error('❌ Error sending status update email:', emailError);
      // Don't fail the status update if email fails
    }
    
    res.json({ success: true, data: updatedQuotation });
  } catch (error) {
    console.error('Error updating quotation status:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a quotation
exports.deleteQuotation = async (req, res) => {
  try {
    const deleted = await FactoryQuotation.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    console.error('Error deleting factory quotation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Legacy PDF generation endpoint - now redirects to download
exports.generatePDF = async (req, res) => {
  try {
    const quotationId = req.params.id;
    
    // Check if quotation exists
    const quotation = await FactoryQuotation.findByPk(quotationId);
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Return success with download URL - PDF will be generated fresh on download
    res.json({
      success: true,
      message: 'PDF will be generated fresh on download',
      data: {
        downloadUrl: `/api/factory-quotations/${quotationId}/download-pdf`
      }
    });
  } catch (error) {
    console.error('Error in generatePDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Download PDF for a quotation - Generate fresh PDF on each download
exports.downloadPDF = async (req, res) => {
  try {
    const quotationId = req.params.id;
    
    // Get the quotation with all details
    const quotation = await FactoryQuotation.findByPk(quotationId);
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    console.log('Generating fresh PDF for download - quotation:', quotationId);

    // Generate PDF
    const pdfGenerator = new FactoryQuotationPDFGenerator();
    
    // Prepare data for the PDF generator
    const pdfData = {
      id: quotation.id,
      companyName: quotation.companyName,
      companyAddress: quotation.companyAddress,
      phone: quotation.phone,
      email: quotation.email,
      date: new Date(quotation.createdAt).toLocaleDateString('en-GB'),
      calculatedAmount: (quotation.calculatedAmount || 0) * (quotation.year || 1),
      // Additional charges
      planCharge: quotation.planCharge || 0,
      stabilityCertificateAmount: quotation.stabilityCertificateAmount || 0,
      administrationCharge: quotation.administrationCharge || 0,
      consultancyFees: quotation.consultancyFees || 0,
      items: [
        {
          srNo: '',
          particular: 'Factory License Compliance',
          workDetails: `${quotation.horsePower || 'N/A'} HP, ${quotation.noOfWorkers || quotation.numberOfWorkers || 'N/A'} Workers`,
          year: `${quotation.year || 'N/A'} Year(s)`,
          total: ((quotation.calculatedAmount || 0) * (quotation.year || 1)).toString()
        }
      ]
    };

    // Create temporary file for download
    const fs = require('fs');
    const outputDir = path.join(__dirname, '../uploads/pdfs');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create unique filename for this download
    const timestamp = Date.now();
    const filename = `factory_quotation_${quotationId}_${timestamp}.pdf`;
    const outputPath = path.join(outputDir, filename);
    
    console.log('Generating fresh PDF at:', outputPath);
    
    // Generate PDF
    await pdfGenerator.generateQuotationPDF(pdfData, outputPath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factory_quotation_${quotationId}.pdf"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    // Clean up the temporary file after streaming
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log('Cleaned up temporary PDF:', outputPath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temporary PDF:', cleanupError);
        }
      }, 1000); // Wait 1 second before cleanup
    });
    
  } catch (error) {
    console.error('Error generating/downloading PDF:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}; 

exports.getStatistics = async (req, res) => {
  try {
    // Get total quotations count
    const total = await FactoryQuotation.count();

    // Get count by status
    const pending = await FactoryQuotation.count({
      where: { status: 'maked' }
    });

    const approved = await FactoryQuotation.count({
      where: { status: 'approved' }
    });

    const rejected = await FactoryQuotation.count({
      where: { status: 'reject' }
    });

    const plan = await FactoryQuotation.count({
      where: { status: 'plan' }
    });

    const stability = await FactoryQuotation.count({
      where: { status: 'stability' }
    });

    const application = await FactoryQuotation.count({
      where: { status: 'application' }
    });

    const renewal = await FactoryQuotation.count({
      where: { status: 'renewal' }
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        plan,
        stability,
        application,
        renewal
      }
    });
  } catch (error) {
    console.error('Error fetching factory quotation statistics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get factory quotation statistics',
      error: error.message 
    });
  }
}; 

// Renew factory quotation
exports.renewQuotation = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const renewalData = req.body;

    console.log('🔄 Starting factory quotation renewal for ID:', id);

    // Validate required fields
    if (!renewalData.renewal_date) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required field: renewal_date'
      });
    }

    // Get the current quotation using raw query (FactoryQuotations has snake_case columns)
    const [currentQuotation] = await sequelize.query(
      'SELECT * FROM FactoryQuotations WHERE id = ?',
      { 
        replacements: [id],
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (!currentQuotation) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Factory quotation not found'
      });
    }

    console.log('📋 Current quotation found:', currentQuotation.id);
    console.log('📋 Current quotation company_id:', currentQuotation.company_id);
    console.log('📋 Current quotation data:', JSON.stringify(currentQuotation, null, 2));

    // Check if company_id exists, if not, we need to handle it
    if (!currentQuotation.company_id) {
      console.log('⚠️ Warning: Quotation does not have a company_id, using default value 1');
    }

    // Check for null/undefined values in important fields (FactoryQuotations uses snake_case)
    const importantFields = ['company_name', 'company_address', 'phone', 'email', 'no_of_workers', 'horse_power', 'total_amount'];
    importantFields.forEach(field => {
      if (!currentQuotation[field]) {
        console.log(`⚠️ Warning: Field '${field}' is null/undefined in original quotation`);
      }
    });



    console.log('✅ Quotation renewed successfully with new renewal date');

    // Update current quotation using raw SQL (FactoryQuotations uses snake_case columns)
    await sequelize.query(
      'UPDATE FactoryQuotations SET renewal_date = ?, status = ? WHERE id = ?',
      {
        replacements: [renewalData.renewal_date, 'maked', id],
        type: QueryTypes.UPDATE,
        transaction
      }
    );

    console.log('✅ Current quotation updated with new renewal date and status changed to maked');

    await transaction.commit();
    console.log('✅ Factory quotation renewal completed successfully');

    // Fetch updated quotation using raw query for response
    const [updatedQuotation] = await sequelize.query(
      'SELECT * FROM FactoryQuotations WHERE id = ?',
      { 
        replacements: [id],
        type: QueryTypes.SELECT
      }
    );

    res.json({
      success: true,
      message: 'Factory quotation renewed successfully',
      data: updatedQuotation
    });

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error renewing factory quotation:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to renew factory quotation',
      error: error.message
    });
  }
};

// Get quotations for renewal page (only status='renewal')

// Get quotations for renewal page (only status='renewal')
exports.getAllQuotationsGrouped = async (req, res) => {
  try {
    const { page = 1, limit = 10, pageSize } = req.query;
    const actualLimit = parseInt(limit) || parseInt(pageSize) || 10;
    const offset = (page - 1) * actualLimit;

    console.log('📋 Fetching renewal quotations...');
    console.log('📋 Page:', page, 'Limit:', actualLimit, 'Offset:', offset);

    // Get only quotations with status='renewal' (ready to be renewed)
    const renewalQuotations = await sequelize.query(
      "SELECT * FROM FactoryQuotations WHERE status = 'renewal' ORDER BY created_at DESC",
      { type: QueryTypes.SELECT }
    );

    console.log(`✅ Found ${renewalQuotations.length} quotations with status='renewal'`);

    // Apply pagination
    const totalItems = renewalQuotations.length;
    const paginatedQuotations = renewalQuotations.slice(offset, offset + actualLimit);

    console.log(`✅ Returning ${paginatedQuotations.length} renewal quotations (page ${page}/${Math.ceil(totalItems / actualLimit)})`);

    res.json({
      success: true,
      data: paginatedQuotations,
      currentPage: parseInt(page),
      pageSize: actualLimit,
      totalPages: Math.ceil(totalItems / actualLimit),
      totalItems: totalItems
    });
  } catch (error) {
    console.error('❌ Error fetching renewal quotations:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch renewal quotations',
      error: error.message
    });
  }
};
