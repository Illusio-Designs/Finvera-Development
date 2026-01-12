const EmployeeCompensationPolicy = require("../models/employeeCompensationPolicyModel");
const PreviousEmployeeCompensationPolicy = require("../models/previousEmployeeCompensationPolicyModel");
const Company = require("../models/companyModel");
const InsuranceCompany = require("../models/insuranceCompanyModel");
const { validationResult } = require("express-validator");
const { uploadEmployeePolicyDocument } = require("../config/multerConfig");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { UserRoleWorkLog } = require("../models");

// Use the configured multer instance for employee policy documents
exports.upload = uploadEmployeePolicyDocument;

// Add middleware to log the request body after multer processing
exports.logFormData = (req, res, next) => {
  console.log("=== Multer Processed FormData ===");
  console.log("Request Body:", JSON.stringify(req.body, null, 2));
  console.log(
    "Request File:",
    req.file
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
      : "No file uploaded"
  );
  console.log("=== End Multer Processed FormData ===");
  next();
};

// Get active companies
exports.getActiveCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { status: "Active" },
      attributes: [
        "company_id",
        "company_name",
        "company_email",
        "contact_number",
        "gst_number",
        "pan_number",
      ],
    });
    res.json(companies);
  } catch (error) {
    console.error("Error fetching active companies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all policies with pagination
exports.getAllPolicies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit =
      parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    // Debug log: pagination parameters
    console.log("[getAllPolicies] Pagination parameters:", {
      page,
      limit,
      pageSize: req.query.pageSize,
      limitParam: req.query.limit,
      offset,
      query: req.query,
    });

    // Debug log: who is requesting and what roles
    if (req.user) {
      console.log(
        "[getAllPolicies] Requested by user:",
        req.user.user_id,
        "roles:",
        req.user.roles || req.user.role_name
      );
    } else {
      console.log("[getAllPolicies] Requested by unknown user");
    }

    const policies = await EmployeeCompensationPolicy.findAndCountAll({
      where: {
        status: "active", // Only show active policies, exclude expired ones
      },
      // All attributes are included by default, but we can explicitly list them if needed
      include: [
        {
          model: Company,
          as: "policyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        { model: InsuranceCompany, as: "provider" },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    // Debug log: how many policies found
    console.log("[getAllPolicies] Found policies:", policies.count);

    res.json({
      policies: policies.rows,
      totalPages: Math.ceil(policies.count / limit),
      currentPage: page,
      totalItems: policies.count,
    });
  } catch (error) {
    console.error("Error fetching policies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get single policy
exports.getPolicy = async (req, res) => {
  try {
    const policy = await EmployeeCompensationPolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: "policyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    res.json(policy);
  } catch (error) {
    console.error("Error fetching policy:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create policy
exports.createPolicy = async (req, res) => {
  try {
    console.log("[EmployeeCompensation] Creating new policy with data:", {
      body: req.body,
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
      files: req.files,
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[EmployeeCompensation] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate file upload
    if (!req.file) {
      console.error("[EmployeeCompensation] No file uploaded");
      console.log("[EmployeeCompensation] Request body:", req.body);
      console.log("[EmployeeCompensation] Request file:", req.file);
      console.log("[EmployeeCompensation] Request files:", req.files);
      return res.status(400).json({ message: "Policy document is required" });
    }

    // Store filename in database
    const filename = req.file.filename;
    console.log("[EmployeeCompensation] Storing filename:", filename);

    // Create policy with document filename
    const policyData = {
      ...req.body,
      policy_document_path: filename,
      status: "active", // Set default status
    };

    console.log(
      "[EmployeeCompensation] Creating policy with data:",
      policyData
    );

    const policy = await EmployeeCompensationPolicy.create(policyData);

    // Fetch the created policy with associations
    const createdPolicy = await EmployeeCompensationPolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: "policyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    console.log("\n[ECP] Policy created successfully:", {
      id: createdPolicy.id,
      documentPath: createdPolicy.policy_document_path,
      company_id: createdPolicy.company_id,
      consumer_id: createdPolicy.consumer_id,
    });

    // Log the action
    try {
      let companyName = null;

      if (createdPolicy.company_id) {
        const company = await Company.findByPk(createdPolicy.company_id);
        if (company) {
          companyName = company.company_name;
        }
      }

      const logDetails = {
        policy_id: createdPolicy.id,
        policy_number: createdPolicy.policy_number,
        customer_type: createdPolicy.customer_type,
        company_id: createdPolicy.company_id,
        consumer_id: createdPolicy.consumer_id,
        total_employees: createdPolicy.total_employees,
        total_wages: createdPolicy.total_wages,
        proposer_name: createdPolicy.proposer_name,
        company_name: companyName,
      };

      console.log("[ECP LOG DEBUG]", {
        company_id: createdPolicy.company_id,
        companyName,
        logDetails,
      });

      // Log the action
      try {
        let targetUserId = null;

        if (createdPolicy.company_id) {
          const company = await Company.findByPk(createdPolicy.company_id);
          if (company) {
            targetUserId = company.user_id; // Use the company's user_id instead of company_id
          }
        }

        if (targetUserId) {
          await UserRoleWorkLog.create({
            user_id: req.user?.user_id || null,
            target_user_id: targetUserId,
            role_id: null,
            action: "created_ecp_policy",
            details: JSON.stringify(logDetails),
          });
        }
      } catch (logErr) {
        console.error("Log error:", logErr);
        // Don't fail the main operation if logging fails
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
      // Don't fail the main operation if logging fails
    }

    res.status(201).json(createdPolicy);
  } catch (error) {
    console.error("[EmployeeCompensationController] Error:", error.message);
    if (error.name === "SequelizeUniqueConstraintError") {
      const fields = error.errors
        ? error.errors.map((e) => e.path).join(", ")
        : "unknown";
      return res
        .status(400)
        .json({ message: `Duplicate entry: ${fields} must be unique.` });
    } else if (error.name === "SequelizeValidationError") {
      const details = error.errors
        ? error.errors.map((e) => e.message).join("; ")
        : error.message;
      return res.status(400).json({ message: `Validation error: ${details}` });
    } else if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Invalid company or consumer ID",
        details: error.message,
      });
    } else {
      return res.status(500).json({
        message: `Employee compensation policy operation failed: ${error.message}`,
      });
    }
  }
};

// Update policy
exports.updatePolicy = async (req, res) => {
  try {
    console.log("[EmployeeCompensation] Starting policy update process");
    console.log("[EmployeeCompensation] Request details:", {
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
      console.log("[EmployeeCompensation] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const policy = await EmployeeCompensationPolicy.findByPk(req.params.id);
    if (!policy) {
      console.log("[EmployeeCompensation] Policy not found:", req.params.id);
      return res.status(404).json({ message: "Policy not found" });
    }

    console.log("[EmployeeCompensation] Found existing policy:", {
      id: policy.id,
      currentDocumentPath: policy.policy_document_path,
    });

    // Handle file upload
    if (req.file) {
      console.log("[EmployeeCompensation] Processing new file upload:", {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
      });

      // Delete old file if exists
      if (policy.policy_document_path) {
        try {
          const oldFilePath = path.join(
            __dirname,
            "..",
            "uploads",
            "employee_policies",
            policy.policy_document_path
          );
          console.log(
            "[EmployeeCompensation] Attempting to delete old file:",
            oldFilePath
          );

          // Check if file exists before trying to delete
          if (fs.existsSync(oldFilePath)) {
            await fs.promises.unlink(oldFilePath);
            console.log("[EmployeeCompensation] Old file deleted successfully");
          } else {
            console.log(
              "[EmployeeCompensation] Old file does not exist, skipping deletion"
            );
          }
        } catch (error) {
          console.warn(
            "[EmployeeCompensation] Could not delete old file:",
            error
          );
        }
      }

      // Store new filename in database
      req.body.policy_document_path = req.file.filename;
      console.log(
        "[EmployeeCompensation] Storing new filename in database:",
        req.file.filename
      );
    } else {
      console.log(
        "[EmployeeCompensation] No new file uploaded, keeping existing document"
      );
      // Remove policy_document_path from req.body to prevent overwriting existing file
      delete req.body.policy_document_path;
    }

    // Update policy
    console.log(
      "[EmployeeCompensation] Updating policy with data:",
      JSON.stringify(req.body, null, 2)
    );
    await policy.update(req.body);

    // Fetch the updated policy with associations
    const updatedPolicy = await EmployeeCompensationPolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: "policyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    console.log("\n[ECP] Policy updated successfully:", {
      id: updatedPolicy.id,
      documentPath: updatedPolicy.policy_document_path,
      company_id: updatedPolicy.company_id,
      consumer_id: updatedPolicy.consumer_id,
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
          action: "updated_ecp_policy",
          details: JSON.stringify({
            policy_id: updatedPolicy.id,
            policy_number: updatedPolicy.policy_number,
            customer_type: updatedPolicy.customer_type,
            company_id: updatedPolicy.company_id,
            consumer_id: updatedPolicy.consumer_id,
            total_employees: updatedPolicy.total_employees,
            total_wages: updatedPolicy.total_wages,
            proposer_name: updatedPolicy.proposer_name,
            changes: req.body,
          }),
        });
      } else {
        console.warn(
          "[ECP LOG] Skipping log creation - no valid target_user_id found"
        );
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    res.json(updatedPolicy);
  } catch (error) {
    console.error("[EmployeeCompensation] Error updating policy:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Policy number must be unique" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete policy
exports.deletePolicy = async (req, res) => {
  try {
    const policy = await EmployeeCompensationPolicy.findByPk(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    await policy.update({ status: "cancelled" });

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
          action: "cancelled_ecp_policy",
          details: JSON.stringify({
            policy_id: policy.id,
            policy_number: policy.policy_number,
            customer_type: policy.customer_type,
            company_id: policy.company_id,
            consumer_id: policy.consumer_id,
            total_employees: policy.total_employees,
            total_wages: policy.total_wages,
            proposer_name: policy.proposer_name,
          }),
        });
      } else {
        console.warn(
          "[ECP LOG] Skipping log creation - no valid target_user_id found"
        );
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    res.json({ message: "Policy cancelled successfully" });
  } catch (error) {
    console.error("Error deleting policy:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get ECP statistics
exports.getECPStatistics = async (req, res) => {
  try {
    console.log("[EmployeeCompensationController] Getting ECP statistics");

    // Get total policies count
    const totalPolicies = await EmployeeCompensationPolicy.count();
    console.log(
      "[EmployeeCompensationController] Total policies:",
      totalPolicies
    );

    // Get active policies count (all policies are considered active)
    const activePolicies = totalPolicies;

    // Get policies created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPolicies = await EmployeeCompensationPolicy.count({
      where: {
        created_at: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });
    console.log(
      "[EmployeeCompensationController] Recent policies:",
      recentPolicies
    );

    // Calculate percentages
    const percent = (val, total) =>
      total > 0 ? Math.round((val / total) * 100) : 0;
    const activePercentage = percent(activePolicies, totalPolicies);
    const recentPercentage = percent(recentPolicies, totalPolicies);

    // Get policies by month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await EmployeeCompensationPolicy.findAll({
      attributes: [
        [
          sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%Y-%m"),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        created_at: {
          [Op.gte]: sixMonthsAgo,
        },
      },
      group: [
        sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%Y-%m"),
      ],
      order: [
        [
          sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%Y-%m"),
          "ASC",
        ],
      ],
      raw: true,
    });

    const responseData = {
      total_policies: totalPolicies,
      active_policies: activePolicies,
      recent_policies: recentPolicies,
      percent_active: activePercentage,
      percent_recent: recentPercentage,
      monthly_stats: monthlyStats,
    };

    console.log(
      "[EmployeeCompensationController] ECP statistics:",
      responseData
    );

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error(
      "[EmployeeCompensationController] Error getting ECP statistics:",
      error
    );
    res.status(500).json({
      success: false,
      error: `Failed to get ECP statistics: ${error.message}`,
    });
  }
};

// Renew policy - Move current policy to PreviousPolicies and create new policy
exports.renewPolicy = async (req, res) => {
  try {
    console.log("[EmployeeCompensation] Starting policy renewal process");
    console.log("[EmployeeCompensation] Request details:", {
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
      console.log("[EmployeeCompensation] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Get the current policy to be renewed
    const currentPolicy = await EmployeeCompensationPolicy.findByPk(
      req.params.id,
      {
        include: [
          { model: Company, as: "policyHolder" },
          { model: InsuranceCompany, as: "provider" },
        ],
      }
    );

    if (!currentPolicy) {
      console.log("[EmployeeCompensation] Policy not found:", req.params.id);
      return res.status(404).json({ message: "Policy not found" });
    }

    console.log("[EmployeeCompensation] Found current policy:", {
      id: currentPolicy.id,
      policyNumber: currentPolicy.policy_number,
    });

    // Validate file upload for renewal
    if (!req.file) {
      console.error("[EmployeeCompensation] No file uploaded for renewal");
      return res
        .status(400)
        .json({ message: "Policy document is required for renewal" });
    }

    // Start transaction to ensure data consistency
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Copy current policy data to PreviousEmployeeCompensationPolicy
      const previousPolicyData = {
        original_policy_id: currentPolicy.id,
        business_type: currentPolicy.business_type,
        customer_type: currentPolicy.customer_type,
        insurance_company_id: currentPolicy.insurance_company_id,
        company_id: currentPolicy.company_id,
        policy_number: currentPolicy.policy_number,
        email: currentPolicy.email,
        mobile_number: currentPolicy.mobile_number,
        policy_start_date: currentPolicy.policy_start_date,
        policy_end_date: currentPolicy.policy_end_date,
        medical_cover: currentPolicy.medical_cover,
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

      console.log("[EmployeeCompensation] Creating previous policy record...");
      const previousPolicy = await PreviousEmployeeCompensationPolicy.create(
        previousPolicyData,
        { transaction }
      );
      console.log(
        "[EmployeeCompensation] Previous policy created:",
        previousPolicy.id
      );

      // Step 2: Create new policy with renewal data
      // Validate that company_id is provided in the request
      if (
        !req.body.company_id ||
        req.body.company_id === "" ||
        req.body.company_id === "undefined"
      ) {
        await transaction.rollback();
        console.error(
          "[EmployeeCompensation] Company ID is required for renewal"
        );
        return res.status(400).json({
          message: "Company selection is required for policy renewal",
        });
      }

      const renewalData = {
        ...req.body,
        business_type: "Renewal/Rollover", // Set business type to Renewal
        policy_document_path: req.file.filename,
        previous_policy_id: previousPolicy.id, // Link to the previous policy
        status: "active",
        // Explicitly set company_id from request body (don't use old policy's company_id)
        company_id: req.body.company_id,
      };

      console.log("[EmployeeCompensation] Creating new renewal policy...");
      const newPolicy = await EmployeeCompensationPolicy.create(renewalData, {
        transaction,
      });

      // Step 3: Delete the old policy from the main table (it's now in PreviousPolicies)
      console.log(
        "[EmployeeCompensation] Deleting old policy from main table..."
      );
      
      // IMPORTANT: Preserve the policy file before deleting the policy record
      // The file path is already copied to previousPolicy.policy_document_path
      // The actual file remains in the same location and will be accessible
      // through the previous policy record for expired policy downloads
      console.log("[EmployeeCompensation] File preservation: Policy document preserved at:", currentPolicy.policy_document_path);
      console.log("[EmployeeCompensation] Previous policy can access file via path:", previousPolicy.policy_document_path);
      
      await currentPolicy.destroy({ transaction });
      console.log("[EmployeeCompensation] Old policy deleted - file preserved for previous policy access");

      // Commit transaction
      await transaction.commit();

      // Fetch the new policy with associations
      const createdPolicy = await EmployeeCompensationPolicy.findByPk(
        newPolicy.id,
        {
          include: [
            { model: Company, as: "policyHolder" },
            { model: InsuranceCompany, as: "provider" },
          ],
          // All attributes are included by default
        }
      );

      console.log("\n[ECP] Policy renewed successfully:", {
        previousPolicyId: previousPolicy.id,
        newPolicyId: createdPolicy.id,
        documentPath: createdPolicy.policy_document_path,
        fileExists: createdPolicy.policy_document_path ? "Yes" : "No",
      });

      // Log the action
      try {
        let targetUserId = null;

        if (createdPolicy.company_id) {
          const company = await Company.findByPk(createdPolicy.company_id);
          if (company) {
            targetUserId = company.user_id;
          }
        }

        if (targetUserId) {
          await UserRoleWorkLog.create({
            user_id: req.user?.user_id || null,
            target_user_id: targetUserId,
            role_id: null,
            action: "renewed_ecp_policy",
            details: JSON.stringify({
              previous_policy_id: previousPolicy.id,
              new_policy_id: createdPolicy.id,
              policy_number: createdPolicy.policy_number,
              customer_type: createdPolicy.customer_type,
              company_id: createdPolicy.company_id,
            }),
          });
        }
      } catch (logErr) {
        console.error("Log error:", logErr);
        // Don't fail the main operation if logging fails
      }

      res.status(201).json({
        message: "Policy renewed successfully. Previous policy file preserved for download.",
        previousPolicy: previousPolicy,
        newPolicy: createdPolicy,
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
      throw error;
    }
  } catch (error) {
    console.error("[EmployeeCompensation] Error renewing policy:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      const fields = error.errors
        ? error.errors.map((e) => e.path).join(", ")
        : "unknown";
      return res
        .status(400)
        .json({ message: `Duplicate entry: ${fields} must be unique.` });
    } else if (error.name === "SequelizeValidationError") {
      const details = error.errors
        ? error.errors.map((e) => e.message).join("; ")
        : error.message;
      return res.status(400).json({ message: `Validation error: ${details}` });
    } else if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Invalid company or insurance company ID",
        details: error.message,
      });
    } else {
      return res
        .status(500)
        .json({ message: `Policy renewal failed: ${error.message}` });
    }
  }
};

// Get all policies (active + previous) grouped by company
exports.getAllPoliciesGrouped = async (req, res) => {
  try {
    // Get all active policies
    const activePolicies = await EmployeeCompensationPolicy.findAll({
      where: { status: "active" },
      include: [
        {
          model: Company,
          as: "policyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        { model: InsuranceCompany, as: "provider" },
      ],
      order: [["created_at", "DESC"]],
    });

    // Get all previous policies
    const previousPolicies = await PreviousEmployeeCompensationPolicy.findAll({
      include: [
        {
          model: Company,
          as: "policyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        { model: InsuranceCompany, as: "provider" },
      ],
      order: [["renewed_at", "DESC"]],
    });

    // Group by company_id
    const groupedPolicies = {};

    // Add active policies
    activePolicies.forEach((policy) => {
      const companyId = policy.company_id;
      if (!groupedPolicies[companyId]) {
        groupedPolicies[companyId] = {
          company_id: companyId,
          company_name: policy.policyHolder?.company_name || "Unknown",
          running: [],
          previous: [],
        };
      }
      groupedPolicies[companyId].running.push({
        ...policy.toJSON(),
        policy_type: "running",
      });
    });

    // Add previous policies
    previousPolicies.forEach((policy) => {
      const companyId = policy.company_id;
      if (!groupedPolicies[companyId]) {
        groupedPolicies[companyId] = {
          company_id: companyId,
          company_name: policy.policyHolder?.company_name || "Unknown",
          running: [],
          previous: [],
        };
      }
      groupedPolicies[companyId].previous.push({
        ...policy.toJSON(),
        status: "expired", // Ensure status is expired for previous policies
        policy_type: "previous",
      });
    });

    // Convert to array and sort by company name
    const result = Object.values(groupedPolicies).sort((a, b) =>
      a.company_name.localeCompare(b.company_name)
    );

    res.json({
      success: true,
      policies: result,
      totalCompanies: result.length,
    });
  } catch (error) {
    console.error("Error fetching grouped policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Search policies
exports.searchPolicies = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Missing search query" });
    }

    console.log(
      `[EmployeeCompensationController] Searching policies with query: "${q}"`
    );

    // Search in main policy fields
    const policies = await EmployeeCompensationPolicy.findAll({
      where: {
        [Op.or]: [
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.policy_number")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.email")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.mobile_number")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.medical_cover")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.gst_number")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("EmployeeCompensationPolicy.pan_number")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
        ],
      },
      include: [
        {
          model: Company,
          as: "policyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
        },
        {
          model: InsuranceCompany,
          as: "provider",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Search for policies where company name matches
    const policiesByCompany = await EmployeeCompensationPolicy.findAll({
      include: [
        {
          model: Company,
          as: "policyHolder",
          attributes: [
            "company_id",
            "company_name",
            "company_email",
            "contact_number",
          ],
          required: true,
          where: sequelize.where(
            sequelize.fn("LOWER", sequelize.col("policyHolder.company_name")),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
        },
        {
          model: InsuranceCompany,
          as: "provider",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Search for policies where insurance company name matches
    const policiesByInsuranceCompany = await EmployeeCompensationPolicy.findAll(
      {
        include: [
          {
            model: Company,
            as: "policyHolder",
            attributes: [
              "company_id",
              "company_name",
              "company_email",
              "contact_number",
            ],
          },
          {
            model: InsuranceCompany,
            as: "provider",
            attributes: ["id", "name"],
            required: true,
            where: sequelize.where(
              sequelize.fn("LOWER", sequelize.col("provider.name")),
              "LIKE",
              `%${q.toLowerCase()}%`
            ),
          },
        ],
        order: [["created_at", "DESC"]],
      }
    );

    // Combine all results and remove duplicates
    const allPolicies = [
      ...policies,
      ...policiesByCompany,
      ...policiesByInsuranceCompany,
    ];
    const uniquePolicies = allPolicies.filter(
      (policy, index, self) =>
        index === self.findIndex((p) => p.id === policy.id)
    );

    console.log(
      `[EmployeeCompensationController] Found ${uniquePolicies.length} policies for query: "${q}"`
    );

    res.json({ success: true, policies: uniquePolicies });
  } catch (error) {
    console.error("Error searching employee compensation policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
