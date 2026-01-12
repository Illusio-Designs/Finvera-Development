const FirePolicy = require('../models/firePolicyModel');
const Company = require('../models/companyModel');
const Consumer = require('../models/consumerModel');
const InsuranceCompany = require('../models/insuranceCompanyModel');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const { UserRoleWorkLog } = require('../models');

exports.logFormData = (req, res, next) => {
  console.log('=== Multer Processed FormData ===');
  console.log('Request Body:', req.body);
  console.log('Request File:', req.file);
  console.log('=== End Multer Processed FormData ===');
  next();
};

exports.getActiveCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { status: 'Active' },
      attributes: [
        'company_id',
        'company_name',
        'company_email',
        'contact_number',
        'gst_number',
        'pan_number'
      ]
    });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching active companies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getActiveConsumers = async (req, res) => {
  try {
    const consumers = await Consumer.findAll({
      where: { status: 'Active' },
      attributes: [
        'consumer_id',
        'name',
        'email',
        'phone_number',
        'contact_address'
      ]
    });
    res.json(consumers);
  } catch (error) {
    console.error('Error fetching active consumers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getActiveInsuranceCompanies = async (req, res) => {
  try {
    const companies = await InsuranceCompany.findAll({
      attributes: ['id', 'name']
    });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching insurance companies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllPolicies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    const policies = await FirePolicy.findAndCountAll({
      include: [
        { model: Company, as: 'companyPolicyHolder', attributes: ['company_id', 'company_name', 'company_email', 'contact_number', 'gst_number', 'pan_number'] },
        { model: Consumer, as: 'consumerPolicyHolder', attributes: ['consumer_id', 'name', 'email', 'phone_number'] },
        { model: InsuranceCompany, as: 'provider' }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({
      policies: policies.rows,
      totalPages: Math.ceil(policies.count / limit),
      currentPage: page,
      totalItems: policies.count
    });
  } catch (error) {
    console.error('Error fetching fire policies:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getPolicy = async (req, res) => {
  try {
    const policy = await FirePolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: 'companyPolicyHolder' },
        { model: Consumer, as: 'consumerPolicyHolder' },
        { model: InsuranceCompany, as: 'provider' }
      ]
    });

    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json(policy);
  } catch (error) {
    console.error('Error fetching fire policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createPolicy = async (req, res) => {
  try {
    console.log('=== Multer Processed FormData ===');
    console.log('Request Body:', req.body);
    console.log('Request File:', req.file);
    console.log('=== End Multer Processed FormData ===');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      console.error('[Fire] No file uploaded');
      return res.status(400).json({ message: 'Policy document is required' });
    }

    const filename = req.file.filename;
    console.log('[Fire] Storing filename:', filename);

    const policyData = {
      ...req.body,
      policy_document_path: filename
    };

    // Sanitize gst and gross_premium fields
    let { gst, gross_premium } = policyData;
    if (Array.isArray(gst)) gst = gst[gst.length - 1];
    if (Array.isArray(gross_premium)) gross_premium = gross_premium[gross_premium.length - 1];
    policyData.gst = gst !== undefined ? parseFloat(gst) : 0;
    policyData.gross_premium = gross_premium !== undefined ? parseFloat(gross_premium) : 0;

    // Convert string 'null' or '' or undefined to actual null for company_id and consumer_id
    if (policyData.company_id === '' || policyData.company_id === 'null' || policyData.company_id === undefined) policyData.company_id = null;
    if (policyData.consumer_id === '' || policyData.consumer_id === 'null' || policyData.consumer_id === undefined) policyData.consumer_id = null;
    // Validate customer type and IDs
    if (policyData.customer_type === 'Organisation') {
      if (!policyData.company_id) {
        console.error('[Fire] Organisation selected but no company_id provided');
        return res.status(400).json({ message: 'Company ID is required for Organisation type' });
      }
      policyData.consumer_id = null;
    } else if (policyData.customer_type === 'Individual') {
      if (!policyData.consumer_id) {
        console.error('[Fire] Individual selected but no consumer_id provided');
        return res.status(400).json({ message: 'Consumer ID is required for Individual type' });
      }
      policyData.company_id = null;
    } else {
      console.error('[Fire] Invalid customer_type:', policyData.customer_type);
      return res.status(400).json({ message: 'Invalid customer type' });
    }
    console.log('[Fire] Final company_id:', policyData.company_id, 'Final consumer_id:', policyData.consumer_id);
    console.log('[Fire] Creating policy with data:', policyData);

    const policy = await FirePolicy.create(policyData);
    const createdPolicy = await FirePolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: 'companyPolicyHolder' },
        { model: Consumer, as: 'consumerPolicyHolder' },
        { model: InsuranceCompany, as: 'provider' }
      ]
    });

    console.log('\n[Fire] Policy created successfully:', {
      id: createdPolicy.id,
      documentPath: createdPolicy.policy_document_path,
      company_id: createdPolicy.company_id,
      consumer_id: createdPolicy.consumer_id
    });

    // Log the action
    try {
      let companyName = null;
      if (createdPolicy.company_id) {
        const company = await Company.findByPk(createdPolicy.company_id);
        if (company) {
          companyName = company.company_name;
          targetUserId = company.user_id; // Use the company's user_id instead of company_id
        }
      }
      
      // Only create log if we have a valid target_user_id
      if (targetUserId) {
      await UserRoleWorkLog.create({
        user_id: req.user?.user_id || null,
          target_user_id: targetUserId, // Use the company's user_id
        role_id: null,
        action: 'created_fire_policy',
        details: JSON.stringify({
          policy_id: createdPolicy.id,
          policy_number: createdPolicy.policy_number,
          customer_type: createdPolicy.customer_type,
          company_id: createdPolicy.company_id,
          consumer_id: createdPolicy.consumer_id,
          sum_insured: createdPolicy.sum_insured,
          proposer_name: createdPolicy.proposer_name,
          company_name: companyName
        })
      });
      } else {
        console.warn('[Fire LOG] Skipping log creation - no valid target_user_id found');
      }
    } catch (logErr) { console.error('Log error:', logErr); }

    res.status(201).json(createdPolicy);
  } catch (error) {
    console.error('[FirePolicyController] Error:', error.message);
    if (error.name === 'SequelizeUniqueConstraintError') {
      const fields = error.errors ? error.errors.map(e => e.path).join(', ') : 'unknown';
      return res.status(400).json({ message: `Duplicate entry: ${fields} must be unique.` });
    } else if (error.name === 'SequelizeValidationError') {
      const details = error.errors ? error.errors.map(e => e.message).join('; ') : error.message;
      return res.status(400).json({ message: `Validation error: ${details}` });
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ message: 'Invalid company or consumer ID', details: error.message });
    } else {
      return res.status(500).json({ message: `Fire policy operation failed: ${error.message}` });
    }
  }
};

exports.updatePolicy = async (req, res) => {
  try {
    console.log('[Fire] Updating policy:', {
      id: req.params.id,
      body: req.body,
      file: req.file
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const policy = await FirePolicy.findByPk(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    if (req.file) {
      if (policy.policy_document_path) {
        try {
          const oldFilePath = path.join(__dirname, '../uploads/fire_policies', policy.policy_document_path);
          await fs.access(oldFilePath);
          await fs.unlink(oldFilePath);
        } catch (error) {
          console.warn('[Fire] Could not delete old file:', error);
        }
      }
      req.body.policy_document_path = req.file.filename;
    }

    // Convert string 'null' or '' or undefined to actual null for company_id and consumer_id
    if (req.body.company_id === '' || req.body.company_id === 'null' || req.body.company_id === undefined) req.body.company_id = null;
    if (req.body.consumer_id === '' || req.body.consumer_id === 'null' || req.body.consumer_id === undefined) req.body.consumer_id = null;
    // Validate customer type and IDs
    if (req.body.customer_type === 'Organisation') {
      if (!req.body.company_id) {
        console.error('[Fire] Organisation selected but no company_id provided');
        return res.status(400).json({ message: 'Company ID is required for Organisation type' });
      }
      req.body.consumer_id = null;
    } else if (req.body.customer_type === 'Individual') {
      if (!req.body.consumer_id) {
        console.error('[Fire] Individual selected but no consumer_id provided');
        return res.status(400).json({ message: 'Consumer ID is required for Individual type' });
      }
      req.body.company_id = null;
    } else {
      console.error('[Fire] Invalid customer_type:', req.body.customer_type);
      return res.status(400).json({ message: 'Invalid customer type' });
    }
    console.log('[Fire] (Update) Final company_id:', req.body.company_id, 'Final consumer_id:', req.body.consumer_id);

    await policy.update(req.body);
    const updatedPolicy = await FirePolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: 'companyPolicyHolder' },
        { model: Consumer, as: 'consumerPolicyHolder' },
        { model: InsuranceCompany, as: 'provider' }
      ]
    });

    console.log('\n[Fire] Policy updated successfully:', {
      id: updatedPolicy.id,
      documentPath: updatedPolicy.policy_document_path,
      company_id: updatedPolicy.company_id,
      consumer_id: updatedPolicy.consumer_id
    });

    // Log the action
    try {
      let targetUserId = null;
      
      if (updatedPolicy.company_id) {
        const company = await Company.findByPk(updatedPolicy.company_id);
        if (company) {
          targetUserId = company.user_id; // Use the company's user_id instead of company_id
        }
      }
      
      // Only create log if we have a valid target_user_id
      if (targetUserId) {
      await UserRoleWorkLog.create({
        user_id: req.user?.user_id || null,
          target_user_id: targetUserId, // Use the company's user_id
        role_id: null,
        action: 'updated_fire_policy',
        details: JSON.stringify({
          policy_id: updatedPolicy.id,
          policy_number: updatedPolicy.policy_number,
          customer_type: updatedPolicy.customer_type,
          company_id: updatedPolicy.company_id,
          consumer_id: updatedPolicy.consumer_id,
          sum_insured: updatedPolicy.sum_insured,
          proposer_name: updatedPolicy.proposer_name,
          changes: req.body
        })
      });
      } else {
        console.warn('[Fire LOG] Skipping log creation - no valid target_user_id found');
      }
    } catch (logErr) { console.error('Log error:', logErr); }

    res.json(updatedPolicy);
  } catch (error) {
    console.error('[Fire] Error updating policy:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Policy number must be unique' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deletePolicy = async (req, res) => {
  try {
    const policy = await FirePolicy.findByPk(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: 'Policy not found' });
    }
    await policy.update({ status: 'cancelled' });

    // Log the action
    try {
      let targetUserId = null;
      
      if (policy.company_id) {
        const company = await Company.findByPk(policy.company_id);
        if (company) {
          targetUserId = company.user_id; // Use the company's user_id instead of company_id
        }
      }
      
      // Only create log if we have a valid target_user_id
      if (targetUserId) {
      await UserRoleWorkLog.create({
        user_id: req.user?.user_id || null,
          target_user_id: targetUserId, // Use the company's user_id
        role_id: null,
        action: 'cancelled_fire_policy',
        details: JSON.stringify({
          policy_id: policy.id,
          policy_number: policy.policy_number,
          customer_type: policy.customer_type,
          company_id: policy.company_id,
          consumer_id: policy.consumer_id,
          sum_insured: policy.sum_insured,
          proposer_name: policy.proposer_name
        })
      });
      } else {
        console.warn('[Fire LOG] Skipping log creation - no valid target_user_id found');
      }
    } catch (logErr) { console.error('Log error:', logErr); }

    res.json({ message: 'Policy cancelled successfully' });
  } catch (error) {
    console.error('Error deleting fire policy:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.searchPolicies = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    console.log(`[FirePolicyController] Searching policies with query: "${q}"`);

    // Search in main policy fields
    const policies = await FirePolicy.findAll({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.policy_number')), 'LIKE', `%${q.toLowerCase()}%`),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.proposer_name')), 'LIKE', `%${q.toLowerCase()}%`),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.email')), 'LIKE', `%${q.toLowerCase()}%`),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.mobile_number')), 'LIKE', `%${q.toLowerCase()}%`),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.property_address')), 'LIKE', `%${q.toLowerCase()}%`),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('FirePolicy.property_type')), 'LIKE', `%${q.toLowerCase()}%`)
        ]
      },
      include: [
        {
          model: Company,
          as: 'companyPolicyHolder',
          attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
        },
        {
          model: Consumer,
          as: 'consumerPolicyHolder',
          attributes: ['consumer_id', 'name', 'email', 'phone_number']
        },
        {
          model: InsuranceCompany,
          as: 'provider',
          attributes: ['id', 'name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Search for policies where company name matches
    const policiesByCompany = await FirePolicy.findAll({
      include: [
        {
          model: Company,
          as: 'companyPolicyHolder',
          attributes: ['company_id', 'company_name', 'company_email', 'contact_number'],
          required: true,
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('companyPolicyHolder.company_name')), 'LIKE', `%${q.toLowerCase()}%`)
        },
        {
          model: Consumer,
          as: 'consumerPolicyHolder',
          attributes: ['consumer_id', 'name', 'email', 'phone_number']
        },
        {
          model: InsuranceCompany,
          as: 'provider',
          attributes: ['id', 'name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Search for policies where consumer name matches
    const policiesByConsumer = await FirePolicy.findAll({
      include: [
        {
          model: Company,
          as: 'companyPolicyHolder',
          attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
        },
        {
          model: Consumer,
          as: 'consumerPolicyHolder',
          attributes: ['consumer_id', 'name', 'email', 'phone_number'],
          required: true,
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('consumerPolicyHolder.name')), 'LIKE', `%${q.toLowerCase()}%`)
        },
        {
          model: InsuranceCompany,
          as: 'provider',
          attributes: ['id', 'name']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Search for policies where insurance company name matches
    const policiesByInsuranceCompany = await FirePolicy.findAll({
      include: [
        {
          model: Company,
          as: 'companyPolicyHolder',
          attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
        },
        {
          model: Consumer,
          as: 'consumerPolicyHolder',
          attributes: ['consumer_id', 'name', 'email', 'phone_number']
        },
        {
          model: InsuranceCompany,
          as: 'provider',
          attributes: ['id', 'name'],
          required: true,
          where: sequelize.where(sequelize.fn('LOWER', sequelize.col('provider.name')), 'LIKE', `%${q.toLowerCase()}%`)
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Combine all results and remove duplicates
    const allPolicies = [...policies, ...policiesByCompany, ...policiesByConsumer, ...policiesByInsuranceCompany];
    const uniquePolicies = allPolicies.filter((policy, index, self) => 
      index === self.findIndex(p => p.id === policy.id)
    );

    console.log(`[FirePolicyController] Found ${uniquePolicies.length} policies for query: "${q}"`);

    res.json({ success: true, policies: uniquePolicies });
  } catch (error) {
    console.error('Error searching fire policies:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}; 

exports.getFireStatistics = async (req, res) => {
  try {
    // Get total policies count
    const totalPolicies = await FirePolicy.count();

    // Get active policies count (policies with end date in future)
    const activePolicies = await FirePolicy.count({
      where: {
        policy_end_date: {
          [Op.gte]: new Date()
        }
      }
    });

    // Get recent policies count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPolicies = await FirePolicy.count({
      where: {
        created_at: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    // Get monthly statistics for the current year
    const currentYear = new Date().getFullYear();
    const monthlyStats = await FirePolicy.findAll({
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%M'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        created_at: {
          [Op.gte]: new Date(currentYear, 0, 1),
          [Op.lt]: new Date(currentYear + 1, 0, 1)
        }
      },
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%M')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%M'), 'ASC']]
    });

    res.json({
      totalPolicies,
      activePolicies,
      recentPolicies,
      monthlyStats
    });
  } catch (error) {
    console.error('Error fetching fire policy statistics:', error);
    res.status(500).json({ 
      message: 'Failed to get fire policy statistics',
      error: error.message 
    });
  }
}; 
// Renew policy - Move current policy to PreviousPolicies and create new policy
exports.renewPolicy = async (req, res) => {
  try {
    console.log("[FirePolicy] Starting policy renewal process");
    console.log("[FirePolicy] Request details:", {
      id: req.params.id,
      body: JSON.stringify(req.body, null, 2),
      file: req.file
        ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            encoding: req.file.encoding,
            mimetype: req.file.mimetype,
            destination: req.file.destination,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
          }
        : "No file uploaded",
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[FirePolicy] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Get the current policy to be renewed
    const currentPolicy = await FirePolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    if (!currentPolicy) {
      console.log("[FirePolicy] Policy not found:", req.params.id);
      return res.status(404).json({ message: "Policy not found" });
    }

    console.log("[FirePolicy] Found current policy:", {
      id: currentPolicy.id,
      policyNumber: currentPolicy.policy_number,
    });

    // Validate file upload for renewal
    if (!req.file) {
      console.error("[FirePolicy] No file uploaded for renewal");
      return res
        .status(400)
        .json({ message: "Policy document is required for renewal" });
    }

    // Import PreviousFirePolicy model
    const { PreviousFirePolicy } = require('../models');

    // Start transaction to ensure data consistency
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Copy current policy data to PreviousFirePolicy
      const previousPolicyData = {
        original_policy_id: currentPolicy.id,
        business_type: currentPolicy.business_type,
        customer_type: currentPolicy.customer_type,
        insurance_company_id: currentPolicy.insurance_company_id,
        company_id: currentPolicy.company_id,
        consumer_id: currentPolicy.consumer_id,
        proposer_name: currentPolicy.proposer_name,
        policy_number: currentPolicy.policy_number,
        email: currentPolicy.email,
        mobile_number: currentPolicy.mobile_number,
        policy_start_date: currentPolicy.policy_start_date,
        policy_end_date: currentPolicy.policy_end_date,
        total_sum_insured: currentPolicy.total_sum_insured,
        gst_number: currentPolicy.gst_number,
        pan_number: currentPolicy.pan_number,
        net_premium: currentPolicy.net_premium,
        gst: currentPolicy.gst,
        gross_premium: currentPolicy.gross_premium,
        policy_document_path: currentPolicy.policy_document_path,
        remarks: currentPolicy.remarks,
        status: "expired", // Mark as expired when moved to previous
        renewed_at: new Date(),
      };

      console.log("[FirePolicy] Creating previous policy record...");
      const previousPolicy = await PreviousFirePolicy.create(
        previousPolicyData,
        { transaction }
      );
      console.log(
        "[FirePolicy] Previous policy created:",
        previousPolicy.id
      );

      // Step 2: Create new policy with renewal data
      // Validate that company_id or consumer_id is provided in the request
      if (
        (!req.body.company_id ||
          req.body.company_id === "" ||
          req.body.company_id === "undefined") &&
        (!req.body.consumer_id ||
          req.body.consumer_id === "" ||
          req.body.consumer_id === "undefined")
      ) {
        await transaction.rollback();
        console.error(
          "[FirePolicy] Company or Consumer ID is required for renewal"
        );
        return res.status(400).json({
          message:
            "Company or Consumer selection is required for policy renewal",
        });
      }

      const renewalData = {
        business_type: "Renewal/Rollover",
        customer_type: req.body.customer_type,
        insurance_company_id: req.body.insurance_company_id,
        company_id: req.body.customer_type === 'Organisation' ? req.body.company_id : null,
        consumer_id: req.body.customer_type === 'Individual' ? req.body.consumer_id : null,
        proposer_name: req.body.proposer_name,
        policy_number: req.body.policy_number,
        email: req.body.email,
        mobile_number: req.body.mobile_number,
        policy_start_date: req.body.policy_start_date,
        policy_end_date: req.body.policy_end_date,
        total_sum_insured: parseFloat(req.body.total_sum_insured),
        gst_number: req.body.gst_number,
        pan_number: req.body.pan_number,
        net_premium: parseFloat(req.body.net_premium),
        gst: parseFloat(req.body.gst),
        gross_premium: parseFloat(req.body.gross_premium),
        policy_document_path: req.file.filename,
        remarks: req.body.remarks || "",
        status: "active",
        previous_policy_id: previousPolicy.id,
      };

      console.log("[FirePolicy] Creating new policy with renewal data...");
      const newPolicy = await FirePolicy.create(renewalData, { transaction });
      console.log("[FirePolicy] New policy created:", newPolicy.id);

      // Step 3: Delete old policy from main table
      console.log("[FirePolicy] Deleting old policy from main table...");
      
      // IMPORTANT: Preserve the policy file before deleting the policy record
      // The file path is already copied to previousPolicy.policy_document_path
      // The actual file remains in the same location and will be accessible
      // through the previous policy record for expired policy downloads
      console.log("[FirePolicy] File preservation: Policy document preserved at:", currentPolicy.policy_document_path);
      console.log("[FirePolicy] Previous policy can access file via path:", previousPolicy.policy_document_path);
      
      await currentPolicy.destroy({ transaction });
      console.log("[FirePolicy] Old policy deleted - file preserved for previous policy access");

      // Step 4: Log the renewal action
      const targetUserId = currentPolicy.companyPolicyHolder?.user_id || currentPolicy.consumerPolicyHolder?.user_id;
      if (targetUserId) {
        await UserRoleWorkLog.create({
          user_id: req.user?.user_id || null,
          target_user_id: targetUserId,
          action: 'renewed_fire_policy',
          details: JSON.stringify({
            old_policy_id: currentPolicy.id,
            old_policy_number: currentPolicy.policy_number,
            new_policy_id: newPolicy.id,
            new_policy_number: newPolicy.policy_number,
            renewal_date: new Date(),
            premium_change: {
              old_premium: currentPolicy.gross_premium,
              new_premium: newPolicy.gross_premium,
              difference: newPolicy.gross_premium - currentPolicy.gross_premium
            }
          })
        }, { transaction });
        console.log("[FirePolicy] Renewal action logged");
      }

      // Commit transaction
      await transaction.commit();
      console.log("[FirePolicy] Transaction committed successfully");

      // Fetch the complete new policy with associations for response
      const completeNewPolicy = await FirePolicy.findByPk(newPolicy.id, {
        include: [
          { model: Company, as: "companyPolicyHolder" },
          { model: Consumer, as: "consumerPolicyHolder" },
          { model: InsuranceCompany, as: "provider" },
        ],
      });

      console.log("[FirePolicy] Policy renewal completed successfully");
      res.status(200).json({
        success: true,
        message: "Fire policy renewed successfully. Previous policy file preserved for download.",
        previousPolicy,
        newPolicy: completeNewPolicy,
        filePreservation: {
          previousPolicyFile: currentPolicy.policy_document_path,
          newPolicyFile: req.file.filename,
          preserved: true,
          note: "Expired policy document remains accessible for download"
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      console.error("[FirePolicy] Transaction rolled back due to error:", error);
      throw error;
    }
  } catch (error) {
    console.error("[FirePolicy] Error renewing policy:", error);
    res.status(500).json({
      success: false,
      message: "Failed to renew fire policy",
      error: error.message,
    });
  }
};

// Get previous policies
exports.getPreviousPolicies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { PreviousFirePolicy } = require('../models');

    const { count, rows: policies } = await PreviousFirePolicy.findAndCountAll({
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
      order: [['renewed_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: policies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching previous fire policies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous fire policies',
      error: error.message,
    });
  }
};

// Get specific previous policy by ID
exports.getPreviousPolicyById = async (req, res) => {
  try {
    const { PreviousFirePolicy } = require('../models');

    const policy = await PreviousFirePolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Previous fire policy not found',
      });
    }

    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    console.error('Error fetching previous fire policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous fire policy',
      error: error.message,
    });
  }
};

// Get all policies (active + previous) grouped by company/consumer
exports.getAllPoliciesGrouped = async (req, res) => {
  try {
    // Get all active policies
    const activePolicies = await FirePolicy.findAll({
      where: { status: "active" },
      include: [
        {
          model: Company,
          as: "companyPolicyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        {
          model: Consumer,
          as: "consumerPolicyHolder",
          attributes: ["consumer_id", "name", "email", "phone_number"],
        },
        { model: InsuranceCompany, as: "provider" },
      ],
      order: [["created_at", "DESC"]],
    });

    // Get all previous policies
    const { PreviousFirePolicy } = require('../models');
    const previousPolicies = await PreviousFirePolicy.findAll({
      include: [
        {
          model: Company,
          as: "companyPolicyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        {
          model: Consumer,
          as: "consumerPolicyHolder",
          attributes: ["consumer_id", "name", "email", "phone_number"],
        },
        { model: InsuranceCompany, as: "provider" },
      ],
      order: [["renewed_at", "DESC"]],
    });

    // Group by company_id or consumer_id
    const groupedPolicies = {};

    // Add active policies
    activePolicies.forEach((policy) => {
      const groupKey = policy.company_id
        ? `company_${policy.company_id}`
        : `consumer_${policy.consumer_id}`;

      if (!groupedPolicies[groupKey]) {
        groupedPolicies[groupKey] = {
          company_id: policy.company_id,
          consumer_id: policy.consumer_id,
          company_name:
            policy.companyPolicyHolder?.company_name ||
            policy.consumerPolicyHolder?.name ||
            "Unknown",
          running: [],
          previous: [],
        };
      }
      groupedPolicies[groupKey].running.push({
        ...policy.toJSON(),
        status: "active", // Ensure status is active for running policies
        policy_type: "running",
      });
    });

    // Add previous policies
    previousPolicies.forEach((policy) => {
      const groupKey = policy.company_id
        ? `company_${policy.company_id}`
        : `consumer_${policy.consumer_id}`;

      if (!groupedPolicies[groupKey]) {
        groupedPolicies[groupKey] = {
          company_id: policy.company_id,
          consumer_id: policy.consumer_id,
          company_name:
            policy.companyPolicyHolder?.company_name ||
            policy.consumerPolicyHolder?.name ||
            "Unknown",
          running: [],
          previous: [],
        };
      }
      groupedPolicies[groupKey].previous.push({
        ...policy.toJSON(),
        status: "expired", // Ensure status is expired for previous policies
        policy_type: "previous",
      });
    });

    // Convert to array and sort by company/consumer name
    const policiesArray = Object.values(groupedPolicies).sort((a, b) =>
      a.company_name.localeCompare(b.company_name)
    );

    res.json({
      success: true,
      policies: policiesArray,
    });
  } catch (error) {
    console.error("Error fetching grouped fire policies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch grouped policies",
      error: error.message,
    });
  }
};