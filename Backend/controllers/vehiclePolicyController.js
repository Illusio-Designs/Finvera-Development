const VehiclePolicy = require("../models/vehiclePolicyModel");
const PreviousVehiclePolicy = require("../models/previousVehiclePolicyModel");
const Company = require("../models/companyModel");
const Consumer = require("../models/consumerModel");
const InsuranceCompany = require("../models/insuranceCompanyModel");
const { validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { UserRoleWorkLog } = require("../models");

exports.logFormData = (req, res, next) => {
  console.log("=== Multer Processed FormData ===");
  console.log("Request Body:", req.body);
  console.log("Request File:", req.file);
  console.log("=== End Multer Processed FormData ===");
  next();
};

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

exports.getActiveConsumers = async (req, res) => {
  try {
    const consumers = await Consumer.findAll({
      where: { status: "Active" },
      attributes: [
        "consumer_id",
        "name",
        "email",
        "phone_number",
        "contact_address",
      ],
    });
    res.json(consumers);
  } catch (error) {
    console.error("Error fetching active consumers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllPolicies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit =
      parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * limit;

    const policies = await VehiclePolicy.findAndCountAll({
      where: {
        status: "active", // Only show active policies, exclude expired ones
      },
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
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.json({
      policies: policies.rows,
      totalPages: Math.ceil(policies.count / limit),
      currentPage: page,
      totalItems: policies.count,
    });
  } catch (error) {
    console.error("Error fetching vehicle policies:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPolicy = async (req, res) => {
  try {
    const policy = await VehiclePolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    res.json(policy);
  } catch (error) {
    console.error("Error fetching vehicle policy:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.createPolicy = async (req, res) => {
  try {
    console.log("=== Multer Processed FormData ===");
    console.log("Request Body:", req.body);
    console.log("Request File:", req.file);
    console.log("=== End Multer Processed FormData ===");

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate file upload
    if (!req.file) {
      console.error("[Vehicle] No file uploaded");
      return res.status(400).json({ message: "Policy document is required" });
    }

    // Store filename in database
    const filename = req.file.filename;
    console.log("[Vehicle] Storing filename:", filename);

    // Create policy with document filename
    const policyData = {
      ...req.body,
      policy_document_path: filename,
    };

    // Convert string 'null' or '' or undefined to actual null for company_id and consumer_id
    if (
      policyData.company_id === "" ||
      policyData.company_id === "null" ||
      policyData.company_id === undefined
    )
      policyData.company_id = null;
    if (
      policyData.consumer_id === "" ||
      policyData.consumer_id === "null" ||
      policyData.consumer_id === undefined
    )
      policyData.consumer_id = null;

    // Handle consumer_id and company_id based on customer_type
    if (policyData.customer_type === "Organisation") {
      if (!policyData.company_id) {
        console.error(
          "[Vehicle] Organisation selected but no company_id provided"
        );
        return res
          .status(400)
          .json({ message: "Company ID is required for Organisation type" });
      }
      policyData.consumer_id = null;
    } else if (policyData.customer_type === "Individual") {
      if (!policyData.consumer_id) {
        console.error(
          "[Vehicle] Individual selected but no consumer_id provided"
        );
        return res
          .status(400)
          .json({ message: "Consumer ID is required for Individual type" });
      }
      policyData.company_id = null;
    } else {
      console.error(
        "[Vehicle] Invalid customer_type:",
        policyData.customer_type
      );
      return res.status(400).json({ message: "Invalid customer type" });
    }

    console.log("[Vehicle] Creating policy with data:", policyData);

    const policy = await VehiclePolicy.create(policyData);

    // Fetch the created policy with associations
    const createdPolicy = await VehiclePolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    console.log("\n[Vehicle] Policy created successfully:", {
      id: createdPolicy.id,
      documentPath: createdPolicy.policy_document_path,
      company_id: createdPolicy.company_id,
      consumer_id: createdPolicy.consumer_id,
    });

    // Log the action
    try {
      let companyName = null;
      let targetUserId = null;

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
          action: "created_vehicle_policy",
          details: JSON.stringify({
            policy_id: createdPolicy.id,
            policy_number: createdPolicy.policy_number,
            customer_type: createdPolicy.customer_type,
            company_id: createdPolicy.company_id,
            consumer_id: createdPolicy.consumer_id,
            vehicle_number: createdPolicy.vehicle_number,
            idv: createdPolicy.idv,
            proposer_name: createdPolicy.proposer_name,
            company_name: companyName,
          }),
        });
      } else {
        console.warn(
          "[Vehicle LOG] Skipping log creation - no valid target_user_id found"
        );
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    res.status(201).json(createdPolicy);
  } catch (error) {
    console.error("[VehiclePolicyController] Error:", error.message);
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
      return res
        .status(400)
        .json({
          message: "Invalid company or consumer ID",
          details: error.message,
        });
    } else {
      return res
        .status(500)
        .json({ message: `Vehicle policy operation failed: ${error.message}` });
    }
  }
};

exports.updatePolicy = async (req, res) => {
  try {
    console.log("[Vehicle] Updating policy:", {
      id: req.params.id,
      body: req.body,
      file: req.file,
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const policy = await VehiclePolicy.findByPk(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    // Handle file upload
    if (req.file) {
      console.log("[Vehicle] New file uploaded:", {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });

      // Delete old file if exists
      if (policy.policy_document_path) {
        try {
          const oldFilePath = path.join(
            __dirname,
            "../uploads/vehicle_policies",
            policy.policy_document_path
          );
          await fs.access(oldFilePath);
          await fs.unlink(oldFilePath);
          console.log("[Vehicle] Old file deleted:", oldFilePath);
        } catch (error) {
          console.warn("[Vehicle] Could not delete old file:", error);
        }
      }

      // Store new filename in database
      req.body.policy_document_path = req.file.filename;
      console.log("[Vehicle] Storing new filename:", req.file.filename);
    }

    // Update policy
    await policy.update(req.body);

    // Fetch the updated policy with associations
    const updatedPolicy = await VehiclePolicy.findByPk(policy.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    console.log("\n[Vehicle] Policy updated successfully:", {
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
          action: "updated_vehicle_policy",
          details: JSON.stringify({
            policy_id: updatedPolicy.id,
            policy_number: updatedPolicy.policy_number,
            customer_type: updatedPolicy.customer_type,
            company_id: updatedPolicy.company_id,
            consumer_id: updatedPolicy.consumer_id,
            vehicle_number: updatedPolicy.vehicle_number,
            idv: updatedPolicy.idv,
            proposer_name: updatedPolicy.proposer_name,
            changes: req.body,
          }),
        });
      } else {
        console.warn(
          "[Vehicle LOG] Skipping log creation - no valid target_user_id found"
        );
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    res.json(updatedPolicy);
  } catch (error) {
    console.error("[Vehicle] Error updating policy:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Policy number must be unique" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deletePolicy = async (req, res) => {
  try {
    const policy = await VehiclePolicy.findByPk(req.params.id);
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
          action: "cancelled_vehicle_policy",
          details: JSON.stringify({
            policy_id: policy.id,
            policy_number: policy.policy_number,
            customer_type: policy.customer_type,
            company_id: policy.company_id,
            consumer_id: policy.consumer_id,
            vehicle_number: policy.vehicle_number,
            idv: policy.idv,
            proposer_name: policy.proposer_name,
          }),
        });
      } else {
        console.warn(
          "[Vehicle LOG] Skipping log creation - no valid target_user_id found"
        );
      }
    } catch (logErr) {
      console.error("Log error:", logErr);
    }

    res.json({ message: "Policy cancelled successfully" });
  } catch (error) {
    console.error("Error deleting vehicle policy:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.searchPolicies = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Missing search query" });
    }

    console.log(
      `[VehiclePolicyController] Searching policies with query: "${q}"`
    );

    // Search in main policy fields
    const policies = await VehiclePolicy.findAll({
      where: {
        [Op.or]: [
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("VehiclePolicy.policy_number")),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("VehiclePolicy.organisation_or_holder_name")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("VehiclePolicy.email")),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("VehiclePolicy.mobile_number")),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("VehiclePolicy.vehicle_number")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("VehiclePolicy.manufacturing_company")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
          sequelize.where(
            sequelize.fn("LOWER", sequelize.col("VehiclePolicy.model")),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
        ],
      },
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
        {
          model: InsuranceCompany,
          as: "provider",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Search for policies where company name matches
    const policiesByCompany = await VehiclePolicy.findAll({
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
          required: true,
          where: sequelize.where(
            sequelize.fn(
              "LOWER",
              sequelize.col("companyPolicyHolder.company_name")
            ),
            "LIKE",
            `%${q.toLowerCase()}%`
          ),
        },
        {
          model: Consumer,
          as: "consumerPolicyHolder",
          attributes: ["consumer_id", "name", "email", "phone_number"],
        },
        {
          model: InsuranceCompany,
          as: "provider",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // Search for policies where consumer name matches
    const policiesByConsumer = await VehiclePolicy.findAll({
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
          required: true,
          where: sequelize.where(
            sequelize.fn("LOWER", sequelize.col("consumerPolicyHolder.name")),
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
    const policiesByInsuranceCompany = await VehiclePolicy.findAll({
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
    });

    // Combine all results and remove duplicates
    const allPolicies = [
      ...policies,
      ...policiesByCompany,
      ...policiesByConsumer,
      ...policiesByInsuranceCompany,
    ];
    const uniquePolicies = allPolicies.filter(
      (policy, index, self) =>
        index === self.findIndex((p) => p.id === policy.id)
    );

    console.log(
      `[VehiclePolicyController] Found ${uniquePolicies.length} policies for query: "${q}"`
    );

    res.json({ success: true, policies: uniquePolicies });
  } catch (error) {
    console.error("Error searching vehicle policies:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getVehicleStatistics = async (req, res) => {
  try {
    // Get total policies count (all policies)
    const totalPolicies = await VehiclePolicy.count();

    // Get active policies count (policies with status active)
    const activePolicies = await VehiclePolicy.count({
      where: {
        status: "active",
      },
    });

    // Get recent policies count (last 30 days, active only)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPolicies = await VehiclePolicy.count({
      where: {
        status: "active",
        created_at: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });

    // Get monthly statistics for the current year (active only)
    const currentYear = new Date().getFullYear();
    const monthlyStats = await VehiclePolicy.findAll({
      attributes: [
        [
          sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%M"),
          "month",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: {
        status: "active",
        created_at: {
          [Op.gte]: new Date(currentYear, 0, 1),
          [Op.lt]: new Date(currentYear + 1, 0, 1),
        },
      },
      group: [sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%M")],
      order: [
        [sequelize.fn("DATE_FORMAT", sequelize.col("created_at"), "%M"), "ASC"],
      ],
    });

    res.json({
      total_policies: totalPolicies,
      active_policies: activePolicies,
      recent_policies: recentPolicies,
      monthly_stats: monthlyStats,
    });
  } catch (error) {
    console.error("Error fetching vehicle policy statistics:", error);
    res.status(500).json({
      message: "Failed to get vehicle policy statistics",
      error: error.message,
    });
  }
};

// Renew policy - Move current policy to PreviousPolicies and create new policy
exports.renewPolicy = async (req, res) => {
  try {
    console.log("[VehiclePolicy] Starting policy renewal process");
    console.log("[VehiclePolicy] Request details:", {
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
      console.log("[VehiclePolicy] Validation errors:", errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Get the current policy to be renewed
    const currentPolicy = await VehiclePolicy.findByPk(req.params.id, {
      include: [
        { model: Company, as: "companyPolicyHolder" },
        { model: Consumer, as: "consumerPolicyHolder" },
        { model: InsuranceCompany, as: "provider" },
      ],
    });

    if (!currentPolicy) {
      console.log("[VehiclePolicy] Policy not found:", req.params.id);
      return res.status(404).json({ message: "Policy not found" });
    }

    console.log("[VehiclePolicy] Found current policy:", {
      id: currentPolicy.id,
      policyNumber: currentPolicy.policy_number,
    });

    // Validate file upload for renewal
    if (!req.file) {
      console.error("[VehiclePolicy] No file uploaded for renewal");
      return res
        .status(400)
        .json({ message: "Policy document is required for renewal" });
    }

    // Start transaction to ensure data consistency
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Copy current policy data to PreviousVehiclePolicy
      const previousPolicyData = {
        original_policy_id: currentPolicy.id,
        business_type: currentPolicy.business_type,
        customer_type: currentPolicy.customer_type,
        insurance_company_id: currentPolicy.insurance_company_id,
        company_id: currentPolicy.company_id,
        consumer_id: currentPolicy.consumer_id,
        organisation_or_holder_name: currentPolicy.organisation_or_holder_name,
        policy_number: currentPolicy.policy_number,
        email: currentPolicy.email,
        mobile_number: currentPolicy.mobile_number,
        policy_start_date: currentPolicy.policy_start_date,
        policy_end_date: currentPolicy.policy_end_date,
        sub_product: currentPolicy.sub_product,
        vehicle_number: currentPolicy.vehicle_number,
        segment: currentPolicy.segment,
        manufacturing_company: currentPolicy.manufacturing_company,
        model: currentPolicy.model,
        manufacturing_year: currentPolicy.manufacturing_year,
        idv: currentPolicy.idv,
        net_premium: currentPolicy.net_premium,
        gst: currentPolicy.gst,
        gross_premium: currentPolicy.gross_premium,
        policy_document_path: currentPolicy.policy_document_path,
        remarks: currentPolicy.remarks,
        status: "expired", // Mark as expired when moved to previous
        renewed_at: new Date(),
      };

      console.log("[VehiclePolicy] Creating previous policy record...");
      const previousPolicy = await PreviousVehiclePolicy.create(
        previousPolicyData,
        { transaction }
      );
      console.log(
        "[VehiclePolicy] Previous policy created:",
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
          "[VehiclePolicy] Company or Consumer ID is required for renewal"
        );
        return res.status(400).json({
          message:
            "Company or Consumer selection is required for policy renewal",
        });
      }

      const renewalData = {
        ...req.body,
        business_type: "Renewal/Rollover", // Set business type to Renewal
        policy_document_path: req.file.filename,
        previous_policy_id: previousPolicy.id, // Link to the previous policy
        status: "active",
        // Explicitly set company_id and consumer_id from request body
        company_id: req.body.company_id || null,
        consumer_id: req.body.consumer_id || null,
      };

      console.log("[VehiclePolicy] Creating new renewal policy...");
      const newPolicy = await VehiclePolicy.create(renewalData, {
        transaction,
      });

      // Step 3: Delete the old policy from the main table (it's now in PreviousPolicies)
      console.log("[VehiclePolicy] Deleting old policy from main table...");
      
      // IMPORTANT: Preserve the policy file before deleting the policy record
      // The file path is already copied to previousPolicy.policy_document_path
      // The actual file remains in the same location and will be accessible
      // through the previous policy record for expired policy downloads
      console.log("[VehiclePolicy] File preservation: Policy document preserved at:", currentPolicy.policy_document_path);
      console.log("[VehiclePolicy] Previous policy can access file via path:", previousPolicy.policy_document_path);
      
      await currentPolicy.destroy({ transaction });
      console.log("[VehiclePolicy] Old policy deleted - file preserved for previous policy access");

      // Commit transaction
      await transaction.commit();

      // Fetch the new policy with associations
      const createdPolicy = await VehiclePolicy.findByPk(newPolicy.id, {
        include: [
          { model: Company, as: "companyPolicyHolder" },
          { model: Consumer, as: "consumerPolicyHolder" },
          { model: InsuranceCompany, as: "provider" },
        ],
      });

      console.log("\n[VehiclePolicy] Policy renewed successfully:", {
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
        } else if (createdPolicy.consumer_id) {
          const consumer = await Consumer.findByPk(createdPolicy.consumer_id);
          if (consumer) {
            targetUserId = consumer.user_id;
          }
        }

        if (targetUserId) {
          await UserRoleWorkLog.create({
            user_id: req.user?.user_id || null,
            target_user_id: targetUserId,
            role_id: null,
            action: "renewed_vehicle_policy",
            details: JSON.stringify({
              previous_policy_id: previousPolicy.id,
              new_policy_id: createdPolicy.id,
              policy_number: createdPolicy.policy_number,
              customer_type: createdPolicy.customer_type,
              company_id: createdPolicy.company_id,
              consumer_id: createdPolicy.consumer_id,
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
    console.error("[VehiclePolicy] Error renewing policy:", error);
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
        message: "Invalid company, consumer or insurance company ID",
        details: error.message,
      });
    } else {
      return res
        .status(500)
        .json({ message: `Failed to renew policy: ${error.message}` });
    }
  }
};

// Get all policies grouped by company/consumer
exports.getAllPoliciesGrouped = async (req, res) => {
  try {
    // Get all active policies
    const activePolicies = await VehiclePolicy.findAll({
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
    const previousPolicies = await PreviousVehiclePolicy.findAll({
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
            policy.policyHolder?.company_name ||
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
    console.error("Error fetching grouped vehicle policies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch grouped policies",
      error: error.message,
    });
  }
};
