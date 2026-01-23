const { RenewalConfig } = require('../models');
const VehiclePolicy = require('../models/vehiclePolicyModel');
const HealthPolicies = require('../models/healthPolicyModel');
const EmployeeCompensationPolicy = require('../models/employeeCompensationPolicyModel');
const FirePolicy = require('../models/firePolicyModel');
const DSC = require('../models/dscModel');
const FactoryQuotation = require('../models/factoryQuotationModel');
const { LabourInspection } = require('../models');
const { LabourLicense } = require('../models');
const StabilityManagement = require('../models/stabilityManagementModel');
const Company = require('../models/companyModel');
const Consumer = require('../models/consumerModel');
const ReminderLog = require('../models/reminderLogModel');
const EmailService = require('./emailService');
const { Op } = require('sequelize');

class RenewalService {
  constructor() {
    this.emailService = new EmailService();
    // Define 5 reminder intervals: 30, 22, 15, 7, 1 days before expiry
    this.reminderIntervals = [30, 22, 15, 7, 1];
  }

  // Check if a reminder should be sent today based on days until expiry
  // Returns the reminder number (1-5) if today is the right day, or 0 if not
  shouldSendReminderToday(daysUntilExpiry) {
    // Check each interval with ±1 day tolerance to account for script timing
    // Intervals: 30, 22, 15, 7, 1 days before expiry
    for (let i = 0; i < this.reminderIntervals.length; i++) {
      const interval = this.reminderIntervals[i];
      const tolerance = 1; // Allow ±1 day
      
      // Check if daysUntilExpiry matches this interval (within tolerance)
      if (daysUntilExpiry >= interval - tolerance && daysUntilExpiry <= interval + tolerance) {
        // For intervals other than the last one, make sure we're not too close to the next interval
        if (i < this.reminderIntervals.length - 1) {
          const nextInterval = this.reminderIntervals[i + 1];
          // Only send if we're closer to this interval than the next one
          if (Math.abs(daysUntilExpiry - interval) <= Math.abs(daysUntilExpiry - nextInterval)) {
            return i + 1;
          }
        } else {
          // Last interval (1 day) - send if within tolerance
          return i + 1;
        }
      }
    }
    return 0; // No reminder due today
  }

  // Check if a reminder for a specific interval has already been sent
  async hasReminderBeenSent(policyId, policyType, targetDays) {
    try {
      // Check if a reminder was sent for this policy with reminder_day close to targetDays
      const existingReminder = await ReminderLog.findOne({
        where: {
          policy_id: policyId,
          policy_type: policyType,
          reminder_day: {
            [Op.between]: [targetDays - 1, targetDays + 1] // Allow ±1 day tolerance
          }
        }
      });
      return !!existingReminder;
    } catch (error) {
      console.error(`❌ Error checking existing reminder:`, error);
      return false;
    }
  }

  // Process all vehicle insurance renewals that need reminders
  async processVehicleInsuranceRenewals() {
    try {
      console.log('🔄 Starting vehicle insurance renewal processing...');
      
      // Get renewal configuration for vehicle insurance
      const config = await RenewalConfig.getConfigByService('vehicle');
      if (!config) {
        console.log('⚠️ No renewal configuration found for vehicle insurance');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get policies that need reminders
      const policies = await this.getVehiclePoliciesNeedingReminders();
      console.log(`📋 Found ${policies.length} policies needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const policy of policies) {
        try {
          const result = await this.processSingleVehiclePolicy(policy, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing policy ${policy.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Vehicle insurance renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in vehicle insurance renewal processing:', error);
      throw error;
    }
  }

  // Get vehicle policies that need reminders
  async getVehiclePoliciesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active policies expiring within 30 days
      const policies = await VehiclePolicy.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
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
          }
        ],
        order: [['policy_end_date', 'ASC']]
      });

      // Filter policies that need reminders today
      const policiesNeedingReminders = [];
      for (const policy of policies) {
        const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
        
        // Check if we should send a reminder today
        if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
          // Check if reminder was already sent today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const recentReminder = await ReminderLog.findOne({
            where: {
              policy_id: policy.id,
              policy_type: 'vehicle',
              sent_at: {
                [Op.gte]: todayStart
              }
            }
          });

          if (!recentReminder) {
            policiesNeedingReminders.push(policy);
          }
        }
      }

      return policiesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting vehicle policies needing reminders:', error);
      throw error;
    }
  }

  // Process a single vehicle policy for renewal reminders
  async processSingleVehiclePolicy(policy, config) {
    try {
      const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
      
      // Check if we should send a reminder today
      if (!config.shouldSendReminder(daysUntilExpiry)) {
        console.log(`⏭️ Policy ${policy.id}: No reminder needed today (${daysUntilExpiry} days until expiry)`);
        return { success: true, skipped: true, reason: 'No reminder scheduled for today' };
      }

      // Get client data
      const clientData = this.extractClientData(policy);
      if (!clientData) {
        console.log(`⚠️ Policy ${policy.id}: Client data not found`);
        return { success: false, reason: 'Client data not found' };
      }

      // Prepare reminder data
      const reminderData = {
        daysUntilExpiry: daysUntilExpiry,
        expiryDate: policy.policy_end_date,
        vehicleDetails: {
          vehicleNumber: policy.vehicle_number,
          vehicleType: policy.sub_product,
          vehicleMake: policy.manufacturing_company,
          vehicleModel: policy.model,
          insuranceCompany: policy.insurance_company_id // You might want to join with InsuranceCompany model
        },
        renewalAmount: policy.gross_premium
      };

      // Send email reminder
      const emailResult = await this.emailService.sendVehicleInsuranceReminder(clientData, reminderData);
      
      if (emailResult.success) {
        // Log the reminder
        await this.logReminder(policy, reminderData, emailResult);
        
        console.log(`✅ Policy ${policy.id}: Reminder sent successfully for ${daysUntilExpiry} days until expiry`);
        return { success: true, reminderSent: true, daysUntilExpiry };
      } else {
        console.log(`❌ Policy ${policy.id}: Failed to send reminder`);
        return { success: false, reason: 'Email sending failed' };
      }
    } catch (error) {
      console.error(`❌ Error processing policy ${policy.id}:`, error);
      return { success: false, reason: error.message };
    }
  }

  // Extract client data from policy
  extractClientData(policy) {
    try {
      if (policy.companyPolicyHolder) {
        return {
          id: policy.companyPolicyHolder.company_id,
          companyName: policy.companyPolicyHolder.company_name,
          name: policy.companyPolicyHolder.company_name,
          email: policy.companyPolicyHolder.company_email || policy.email,
          phone: policy.companyPolicyHolder.contact_number || policy.mobile_number
        };
      } else if (policy.consumerPolicyHolder) {
        return {
          id: policy.consumerPolicyHolder.consumer_id,
          companyName: policy.organisation_or_holder_name,
          name: policy.consumerPolicyHolder.name,
          email: policy.consumerPolicyHolder.email || policy.email,
          phone: policy.consumerPolicyHolder.phone_number || policy.mobile_number
        };
      } else {
        // Fallback to policy data
        return {
          id: policy.id,
          companyName: policy.organisation_or_holder_name,
          name: policy.organisation_or_holder_name,
          email: policy.email,
          phone: policy.mobile_number
        };
      }
    } catch (error) {
      console.error('❌ Error extracting client data:', error);
      return null;
    }
  }

  // Log reminder to ReminderLog table
  async logReminder(policy, reminderData, emailResult) {
    try {
      const logData = {
        policy_id: policy.id,
        policy_type: 'vehicle',
        client_name: reminderData.clientName || 'Unknown',
        client_email: reminderData.clientEmail || 'Unknown',
        reminder_type: 'email',
        reminder_day: reminderData.daysUntilExpiry,
        expiry_date: policy.policy_end_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `Vehicle Insurance Renewal Reminder - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown' } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`Renewal reminder logged for policy ${policy.id}`);
    } catch (error) {
      console.error('Error logging renewal reminder:', error);
    }
  }

  // Get days until expiry
  getDaysUntilExpiry(expiryDate) {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Handle edge cases
    if (isNaN(diffDays)) {
      return 0;
    }
    
    // Ensure we return a positive integer
    return Math.max(0, diffDays);
  }

  // Get renewal dashboard data
  async getRenewalDashboard() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const expiringSoon = await VehiclePolicy.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        order: [['policy_end_date', 'ASC']]
      });

      const totalActive = await VehiclePolicy.count({ where: { status: 'active' } });
      const totalExpired = await VehiclePolicy.count({ where: { status: 'expired' } });

      return {
        success: true,
        data: {
          expiringSoon: expiringSoon.length,
          totalActive,
          totalExpired,
          expiringPolicies: expiringSoon.map(policy => ({
            id: policy.id,
            policyNumber: policy.policy_number,
            vehicleNumber: policy.vehicle_number,
            vehicleType: policy.sub_product,
            expiryDate: policy.policy_end_date,
            daysUntilExpiry: this.getDaysUntilExpiry(policy.policy_end_date),
            status: policy.status,
            clientName: policy.organisation_or_holder_name
          }))
        }
      };
    } catch (error) {
      console.error('❌ Error getting renewal dashboard:', error);
      throw error;
    }
  }

  // Process all health insurance renewals that need reminders
  async processHealthInsuranceRenewals() {
    try {
      console.log('🔄 Starting health insurance renewal processing...');
      
      // Get renewal configuration for health insurance
      const config = await RenewalConfig.getConfigByService('health');
      if (!config) {
        console.log('⚠️ No renewal configuration found for health insurance');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get policies that need reminders
      const policies = await this.getHealthPoliciesNeedingReminders();
      console.log(`📋 Found ${policies.length} policies needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const policy of policies) {
        try {
          const result = await this.processSingleHealthPolicy(policy, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing health policy ${policy.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Health insurance renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in health insurance renewal processing:', error);
      throw error;
    }
  }

  // Get health policies that need reminders
  async getHealthPoliciesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active policies expiring within 30 days
      const policies = await HealthPolicies.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
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
          }
        ],
        order: [['policy_end_date', 'ASC']]
      });

      // Filter policies that need reminders today
      const policiesNeedingReminders = [];
      for (const policy of policies) {
        const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          policiesNeedingReminders.push(policy);
        }
      }

      return policiesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting health policies needing reminders:', error);
      throw error;
    }
  }

  // Process all ECP renewals that need reminders
  async processECPRenewals() {
    try {
      console.log('🔄 Starting ECP renewal processing...');
      
      // Get renewal configuration for ECP
      const config = await RenewalConfig.getConfigByService('ecp');
      if (!config) {
        console.log('⚠️ No renewal configuration found for ECP');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get policies that need reminders
      const policies = await this.getECPPoliciesNeedingReminders();
      console.log(`📋 Found ${policies.length} policies needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const policy of policies) {
        try {
          const result = await this.processSingleECPPolicy(policy, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing ECP policy ${policy.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ ECP renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in ECP renewal processing:', error);
      throw error;
    }
  }

  // Get ECP policies that need reminders
  async getECPPoliciesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active policies expiring within 30 days
      const policies = await EmployeeCompensationPolicy.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        include: [
          {
            model: Company,
            as: 'policyHolder',
            attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
          }
        ],
        order: [['policy_end_date', 'ASC']]
      });

      // Filter policies that need reminders today
      const policiesNeedingReminders = [];
      for (const policy of policies) {
        const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          policiesNeedingReminders.push(policy);
        }
      }

      return policiesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting ECP policies needing reminders:', error);
      throw error;
    }
  }

  // Get Fire Policy policies that need reminders
  async getFirePoliciesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active policies expiring within 30 days
      const policies = await FirePolicy.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
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
          }
        ],
        order: [['policy_end_date', 'ASC']]
      });

      // Filter policies that need reminders today
      const policiesNeedingReminders = [];
      for (const policy of policies) {
        const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          policiesNeedingReminders.push(policy);
        }
      }

      return policiesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting Fire Policy policies needing reminders:', error);
      throw error;
    }
  }

  // Get DSC certificates that need reminders
  async getDSCCertificatesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active certificates expiring within 30 days
      const certificates = await DSC.findAll({
        where: {
          status: 'in',
          expiry_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
          },
          {
            model: Consumer,
            as: 'consumer',
            attributes: ['consumer_id', 'name', 'email', 'phone_number']
          }
        ],
        order: [['expiry_date', 'ASC']]
      });

      // Filter certificates that need reminders today
      const certificatesNeedingReminders = [];
      for (const certificate of certificates) {
        const daysUntilExpiry = this.getDaysUntilExpiry(certificate.expiry_date);
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          certificatesNeedingReminders.push(certificate);
        }
      }

      return certificatesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting DSC certificates needing reminders:', error);
      throw error;
    }
  }

  // Process a single health policy renewal
  async processSingleHealthPolicy(policy, config) {
    try {
      console.log(`📋 Processing health policy ${policy.id}...`);
      
      // Check if reminder already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingReminder = await ReminderLog.findOne({
        where: {
          policy_id: policy.id,
          policy_type: 'health',
          sent_at: {
            [Op.gte]: today
          }
        }
      });

      if (existingReminder) {
        console.log(`⚠️ Reminder already sent today for health policy ${policy.id}`);
        return { success: false, message: 'Reminder already sent today' };
      }

      // Get client details
      const clientName = policy.companyPolicyHolder?.companyName || 
                        policy.consumerPolicyHolder?.name || 
                        policy.organisation_or_holder_name || 
                        'Unknown';
      
      const clientEmail = policy.companyPolicyHolder?.email || 
                         policy.consumerPolicyHolder?.email || 
                         policy.email;

      if (!clientEmail) {
        console.log(`⚠️ No email found for health policy ${policy.id}`);
        return { success: false, message: 'No email address found' };
      }

      // Calculate days until expiry
      const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
      
      // Prepare reminder data
      const reminderData = {
        policyId: policy.id,
        policyNumber: policy.policy_number,
        clientName,
        clientEmail,
        daysUntilExpiry,
        expiryDate: policy.policy_end_date,
        policyType: 'health',
                 policyDetails: {
           sumInsured: policy.medical_cover,
           premiumAmount: policy.gross_premium,
           policyStartDate: policy.policy_start_date,
           policyEndDate: policy.policy_end_date,
           insuranceCompany: policy.insurance_company_id,
           productType: policy.plan_name
         }
      };

      // Send email reminder
      const emailResult = await this.emailService.sendHealthInsuranceReminder(reminderData);
      
      // Log the reminder
      await this.logHealthPolicyReminder(policy, reminderData, emailResult);

      if (emailResult.success) {
        console.log(`✅ Health insurance renewal reminder sent successfully for policy ${policy.id}`);
        return { success: true, messageId: emailResult.messageId };
      } else {
        console.log(`❌ Failed to send health insurance renewal reminder for policy ${policy.id}`);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing health policy ${policy.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Log health policy renewal reminder
  async logHealthPolicyReminder(policy, reminderData, emailResult) {
    try {
      const logData = {
        policy_id: policy.id,
        policy_type: 'health',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: reminderData.daysUntilExpiry,
        expiry_date: policy.policy_end_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `Health Insurance Renewal Reminder - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown' } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`Health insurance renewal reminder logged for policy ${policy.id}`);
    } catch (error) {
      console.error('Error logging health insurance renewal reminder:', error);
    }
  }

  // Process a single ECP policy renewal
  async processSingleECPPolicy(policy, config) {
    try {
      console.log(`📋 Processing ECP policy ${policy.id}...`);
      
      // Check if reminder already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingReminder = await ReminderLog.findOne({
        where: {
          policy_id: policy.id,
          policy_type: 'ecp',
          sent_at: {
            [Op.gte]: today
          }
        }
      });

      if (existingReminder) {
        console.log(`⚠️ Reminder already sent today for ECP policy ${policy.id}`);
        return { success: false, message: 'Reminder already sent today' };
      }

      // Get client details
      const clientName = policy.company?.companyName || 'Unknown';
      const clientEmail = policy.company?.email;

      if (!clientEmail) {
        console.log(`⚠️ No email found for ECP policy ${policy.id}`);
        return { success: false, message: 'No email address found' };
      }

      // Calculate days until expiry
      const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
      
      // Prepare reminder data
      const reminderData = {
        policyId: policy.id,
        policyNumber: policy.policy_number,
        clientName,
        clientEmail,
        daysUntilExpiry,
        expiryDate: policy.policy_end_date,
        policyType: 'ecp',
        policyDetails: {
          policyNumber: policy.policy_number,
          businessType: policy.business_type,
          medicalCover: policy.medical_cover,
          policyStartDate: policy.policy_start_date,
          policyEndDate: policy.policy_end_date,
          insuranceCompany: policy.insurance_company_id,
          grossPremium: policy.gross_premium
        }
      };

      // Send email reminder
      const emailResult = await this.emailService.sendECPRenewalReminder(reminderData);
      
      // Log the reminder
      await this.logECPReminder(policy, reminderData, emailResult);

      if (emailResult.success) {
        console.log(`✅ ECP renewal reminder sent successfully for policy ${policy.id}`);
        return { success: true, messageId: emailResult.messageId };
      } else {
        console.log(`❌ Failed to send ECP renewal reminder for policy ${policy.id}`);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing ECP policy ${policy.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process all DSC renewals that need reminders
  async processDSCRenewals() {
    try {
      console.log('🔄 Starting DSC renewal processing...');
      
      // Get DSCs that need reminders
      const dscs = await this.getDSCsNeedingReminders();
      console.log(`📋 Found ${dscs.length} DSCs needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      const config = {}; // DSC doesn't need config

      for (const dsc of dscs) {
        try {
          const result = await this.processSingleDSC(dsc, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing DSC ${dsc.dsc_id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ DSC renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        sent: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in DSC renewal processing:', error);
      return {
        success: false,
        processed: 0,
        sent: 0,
        errors: 1,
        error: error.message
      };
    }
  }

  // Get DSCs that need reminders
  async getDSCsNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active DSCs expiring within 30 days
      const dscs = await DSC.findAll({
        where: {
          status: 'in',
          expiry_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
          },
          {
            model: Consumer,
            as: 'consumer',
            attributes: ['consumer_id', 'name', 'email', 'phone_number']
          }
        ],
        order: [['expiry_date', 'ASC']]
      });

      // Filter DSCs that need reminders today
      const dscsNeedingReminders = [];
      for (const dsc of dscs) {
        const daysUntilExpiry = this.getDaysUntilExpiry(dsc.expiry_date);
        
        if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
          dscsNeedingReminders.push(dsc);
        }
      }

      return dscsNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting DSCs needing reminders:', error);
      throw error;
    }
  }

  // Process a single DSC renewal
  async processSingleDSC(certificate, config) {
    try {
      console.log(`📋 Processing DSC ${certificate.dsc_id}...`);

      // Skip if already renewed/completed/closed
      if (['renewed', 'completed', 'closed', 'inactive', 'done'].includes((certificate.status || '').toLowerCase())) {
        console.log(`⏭️ DSC ${certificate.dsc_id}: Skipping, status is '${certificate.status}'`);
        return { success: false, skipped: true, reason: 'Already renewed/completed' };
      }

      // Get client details
      const clientName = certificate.company?.companyName || 
                        certificate.consumer?.name || 
                        'Unknown';
      const clientEmail = certificate.company?.email || 
                         certificate.consumer?.email;

      if (!clientEmail) {
        console.log(`⚠️ No email found for DSC ${certificate.dsc_id}`);
        return { success: false, message: 'No email address found' };
      }

      // Calculate days until expiry
      const daysUntilExpiry = this.getDaysUntilExpiry(certificate.expiry_date);
      
      // Check if today is the right day to send a reminder (one of the 5 intervals)
      const reminderNumber = this.shouldSendReminderToday(daysUntilExpiry);
      if (reminderNumber === 0) {
        console.log(`⏭️ DSC ${certificate.dsc_id}: No reminder due today (${daysUntilExpiry} days until expiry)`);
        return { success: false, message: 'Not a reminder day', skipped: true };
      }

      // Get the target days for this reminder
      const targetDays = this.reminderIntervals[reminderNumber - 1];
      
      // Check if this specific reminder has already been sent
      const alreadySent = await this.hasReminderBeenSent(certificate.dsc_id, 'dsc', targetDays);
      if (alreadySent) {
        console.log(`⚠️ DSC ${certificate.dsc_id}: Reminder #${reminderNumber} (${targetDays} days) already sent`);
        return { success: false, message: `Reminder #${reminderNumber} already sent` };
      }
      
      // Prepare reminder data
      const reminderData = {
        policyId: certificate.dsc_id,
        policyNumber: certificate.certification_name,
        clientName,
        clientEmail,
        daysUntilExpiry,
        expiryDate: certificate.expiry_date,
        policyType: 'dsc',
        reminderNumber,
        policyDetails: {
          certificateName: certificate.certification_name,
          status: certificate.status,
          certificateId: certificate.dsc_id
        }
      };

      // Send email reminder
      const emailResult = await this.emailService.sendDSCRenewalReminder(reminderData);
      
      // Log the reminder
      await this.logDSCReminder(certificate, reminderData, emailResult);

      if (emailResult.success) {
        console.log(`✅ DSC renewal reminder #${reminderNumber} sent successfully for certificate ${certificate.dsc_id}`);
        return { success: true, messageId: emailResult.messageId, reminderNumber };
      } else {
        console.log(`❌ Failed to send DSC renewal reminder for certificate ${certificate.dsc_id}`);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing DSC ${certificate.dsc_id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process a single Fire Policy renewal
  async processSingleFirePolicy(policy, config) {
    try {
      console.log(`📋 Processing Fire Policy ${policy.id}...`);
      
      // Check if reminder already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingReminder = await ReminderLog.findOne({
        where: {
          policy_id: policy.id,
          policy_type: 'fire',
          sent_at: {
            [Op.gte]: today
          }
        }
      });

      if (existingReminder) {
        console.log(`⚠️ Reminder already sent today for Fire Policy ${policy.id}`);
        return { success: false, message: 'Reminder already sent today' };
      }

      // Get client details
      const clientName = policy.companyPolicyHolder?.company_name || 
                        policy.consumerPolicyHolder?.name || 
                        policy.proposer_name || 
                        'Unknown';
      const clientEmail = policy.companyPolicyHolder?.company_email || 
                         policy.consumerPolicyHolder?.email || 
                         policy.email;

      if (!clientEmail) {
        console.log(`⚠️ No email found for Fire Policy ${policy.id}`);
        return { success: false, message: 'No email address found' };
      }

      // Calculate days until expiry
      const daysUntilExpiry = this.getDaysUntilExpiry(policy.policy_end_date);
      
      // Prepare reminder data
      const reminderData = {
        policyId: policy.id,
        policyNumber: policy.policy_number,
        clientName,
        clientEmail,
        daysUntilExpiry,
        expiryDate: policy.policy_end_date,
        policyType: 'fire',
        policyDetails: {
          policyNumber: policy.policy_number,
          businessType: policy.business_type,
          totalSumInsured: policy.total_sum_insured,
          policyStartDate: policy.policy_start_date,
          policyEndDate: policy.policy_end_date,
          insuranceCompany: policy.insurance_company_id,
          grossPremium: policy.gross_premium
        }
      };

      // Send email reminder
      const emailResult = await this.emailService.sendFirePolicyRenewalReminder(reminderData);
      
      // Log the reminder
      await this.logFirePolicyReminder(policy, reminderData, emailResult);

      if (emailResult.success) {
        console.log(`✅ Fire Policy renewal reminder sent successfully for policy ${policy.id}`);
        return { success: true, messageId: emailResult.messageId };
      } else {
        console.log(`❌ Failed to send Fire Policy renewal reminder for policy ${policy.id}`);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing Fire Policy ${policy.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Log ECP renewal reminder
  async logECPReminder(policy, reminderData, emailResult) {
    try {
      const logData = {
        policy_id: policy.id,
        policy_type: 'ecp',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: reminderData.daysUntilExpiry,
        expiry_date: policy.policy_end_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `ECP Renewal Reminder - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown' } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`📝 ECP renewal reminder logged successfully`);
    } catch (error) {
      console.error(`❌ Error logging ECP renewal reminder:`, error);
    }
  }

  // Log DSC renewal reminder
  async logDSCReminder(certificate, reminderData, emailResult) {
    try {
      const reminderNumber = reminderData.reminderNumber || 1;
      const targetDays = this.reminderIntervals[reminderNumber - 1] || reminderData.daysUntilExpiry;
      
      const logData = {
        policy_id: certificate.dsc_id,
        policy_type: 'dsc',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: targetDays, // Store the target interval, not the actual days until expiry
        expiry_date: certificate.expiry_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `DSC Renewal Reminder #${reminderNumber} - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown', reminderNumber } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`📝 DSC renewal reminder #${reminderNumber} logged successfully`);
    } catch (error) {
      console.error(`❌ Error logging DSC renewal reminder:`, error);
    }
  }

  // Log Fire Policy renewal reminder
  async logFirePolicyReminder(policy, reminderData, emailResult) {
    try {
      const logData = {
        policy_id: policy.id,
        policy_type: 'fire',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: reminderData.daysUntilExpiry,
        expiry_date: policy.policy_end_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `Fire Policy Renewal Reminder - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown' } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`📝 Fire Policy renewal reminder logged successfully`);
    } catch (error) {
      console.error(`❌ Error logging Fire Policy renewal reminder:`, error);
    }
  }

  // Process all Factory Quotation renewals that need reminders
  async processFactoryQuotationRenewals() {
    try {
      console.log('🏭 Starting Factory Quotation renewal processing...');
      
      // Get renewal configuration for factory quotation
      const config = await RenewalConfig.getConfigByService('factory');
      if (!config) {
        console.log('⚠️ No renewal configuration found for Factory Quotation');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get quotations that need reminders
      const quotations = await this.getFactoryQuotationsNeedingReminders();
      console.log(`📋 Found ${quotations.length} quotations needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const quotation of quotations) {
        try {
          const result = await this.processSingleFactoryQuotation(quotation, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing quotation ${quotation.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Factory Quotation renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in Factory Quotation renewal processing:', error);
      throw error;
    }
  }

  // Get Factory Quotations that need reminders
  async getFactoryQuotationsNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get quotations with status 'renewal' or that have renewal_date set
      const quotations = await FactoryQuotation.findAll({
        where: {
          [Op.or]: [
            {
              status: 'renewal'
            },
            {
              status: {
                [Op.in]: ['approved', 'plan', 'stability', 'application']
              },
              renewal_date: {
                [Op.ne]: null,
                [Op.lte]: thirtyDaysFromNow
              }
            }
          ]
        },
        order: [['renewal_date', 'ASC']]
      });

      console.log(`📋 Found ${quotations.length} factory quotations to check`);

      // Filter quotations that need reminders today
      const quotationsNeedingReminders = [];
      for (const quotation of quotations) {
        // If no renewal_date, set it to 30 days from now for processing
        const renewalDate = quotation.renewal_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const daysUntilExpiry = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        
        console.log(`   Checking quotation ${quotation.id}: status=${quotation.status}, daysUntilExpiry=${daysUntilExpiry}`);
        
        // Accept all quotations with status 'renewal' or if they're within 30 days
        if (quotation.status === 'renewal' || (daysUntilExpiry <= 30 && daysUntilExpiry >= -30)) {
          quotationsNeedingReminders.push(quotation);
        }
      }

      return quotationsNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting Factory Quotations needing reminders:', error);
      throw error;
    }
  }

  // Process a single Factory Quotation renewal
  async processSingleFactoryQuotation(quotation, config) {
    try {
      console.log(`🏭 Processing Factory Quotation ${quotation.id} for renewal...`);

      // Skip if already renewed/completed/closed
      if (['renewed', 'completed', 'closed', 'inactive', 'done'].includes((quotation.status || '').toLowerCase())) {
        console.log(`⏭️ Factory Quotation ${quotation.id}: Skipping, status is '${quotation.status}'`);
        return { success: false, skipped: true, reason: 'Already renewed/completed' };
      }

      // Calculate days until expiry
      const today = new Date();
      // If no renewal_date, set it to 30 days from now
      const renewalDate = quotation.renewal_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const daysUntilExpiry = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < -7) {
        console.log(`⚠️ Quotation ${quotation.id} has already expired`);
        return { success: false, message: 'Quotation already expired' };
      }

      // Check if today is the right day to send a reminder (one of the 5 intervals)
      const reminderNumber = this.shouldSendReminderToday(daysUntilExpiry);
      if (reminderNumber === 0) {
        console.log(`⏭️ Factory Quotation ${quotation.id}: No reminder due today (${daysUntilExpiry} days until expiry)`);
        return { success: false, message: 'Not a reminder day', skipped: true };
      }

      // Get the target days for this reminder
      const targetDays = this.reminderIntervals[reminderNumber - 1];
      
      // Check if this specific reminder has already been sent
      const alreadySent = await this.hasReminderBeenSent(quotation.id, 'factory', targetDays);
      if (alreadySent) {
        console.log(`⚠️ Factory Quotation ${quotation.id}: Reminder #${reminderNumber} (${targetDays} days) already sent`);
        return { success: false, message: `Reminder #${reminderNumber} already sent` };
      }

      // Extract client data
      const clientData = this.extractFactoryQuotationClientData(quotation);
      
      // Prepare reminder data
      const reminderData = {
        daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0,
        renewalDate: renewalDate.toLocaleDateString('en-IN'),
        reminderNumber,
        quotationDetails: {
          quotationId: quotation.id,
          companyName: quotation.companyName,
          status: quotation.status,
          totalAmount: quotation.totalAmount,
          year: quotation.year
        },
        clientName: clientData.clientName,
        clientEmail: clientData.clientEmail
      };

      // Send renewal reminder email
      const emailResult = await this.emailService.sendFactoryQuotationRenewalReminder(reminderData);
      
      // Log the reminder
      await this.logFactoryQuotationReminder(quotation, reminderData, emailResult);
      
      if (emailResult.success) {
        console.log(`✅ Factory Quotation renewal reminder #${reminderNumber} sent successfully to ${clientData.clientName}`);
        return { success: true, messageId: emailResult.messageId, reminderNumber };
      } else {
        console.error(`❌ Failed to send Factory Quotation renewal reminder:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing Factory Quotation renewal:`, error);
      throw error;
    }
  }


  // Extract client data from Factory Quotation
  extractFactoryQuotationClientData(quotation) {
    return {
      clientName: quotation.companyName || 'Unknown Company',
      clientEmail: quotation.email || 'No email provided'
    };
  }

  // Log Factory Quotation renewal reminder
  async logFactoryQuotationReminder(quotation, reminderData, emailResult) {
    try {
      const reminderNumber = reminderData.reminderNumber || 1;
      const targetDays = this.reminderIntervals[reminderNumber - 1] || reminderData.daysUntilExpiry;
      
      const logData = {
        policy_id: quotation.id,
        policy_type: 'factory',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: targetDays, // Store the target interval
        expiry_date: quotation.renewal_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `Factory Quotation Renewal Reminder #${reminderNumber} - ${reminderData.daysUntilExpiry} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown', reminderNumber } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilExpiry
      };

      await ReminderLog.create(logData);
      console.log(`📝 Factory Quotation renewal reminder #${reminderNumber} logged successfully`);
    } catch (error) {
      console.error(`❌ Error logging Factory Quotation renewal reminder:`, error);
    }
  }





  // Process all labour inspection reminders
  async processLabourInspectionReminders() {
    try {
      console.log('🔄 Starting labour inspection reminder processing...');
      
      // Get renewal configuration for labour inspection
      const config = await RenewalConfig.getConfigByService('labour_inspection');
      if (!config) {
        console.log('⚠️ No renewal configuration found for labour inspection');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get inspections that need reminders
      const inspections = await this.getLabourInspectionsNeedingReminders();
      console.log(`📋 Found ${inspections.length} inspections needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const inspection of inspections) {
        try {
          const result = await this.processSingleLabourInspection(inspection, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing inspection ${inspection.inspection_id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Labour inspection reminder processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in labour inspection reminder processing:', error);
      throw error;
    }
  }

  // Get labour inspections that need reminders
  async getLabourInspectionsNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active inspections expiring within 30 days
      const inspections = await LabourInspection.findAll({
        where: {
          status: {
            [Op.in]: ['pending', 'running']
          },
          expiry_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
          }
        ],
        order: [['expiry_date', 'ASC']]
      });

      return inspections;
    } catch (error) {
      console.error('❌ Error getting labour inspections needing reminders:', error);
      throw error;
    }
  }

  // Process single labour inspection reminder
  async processSingleLabourInspection(inspection, config) {
    try {
      const today = new Date();
      const expiryDate = new Date(inspection.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

      // Check if today is the right day to send a reminder (one of the 5 intervals)
      const reminderNumber = this.shouldSendReminderToday(daysUntilExpiry);
      if (reminderNumber === 0) {
        console.log(`⏭️ Labour Inspection ${inspection.inspection_id}: No reminder due today (${daysUntilExpiry} days until expiry)`);
        return { success: false, message: 'Not a reminder day', skipped: true };
      }

      // Get the target days for this reminder
      const targetDays = this.reminderIntervals[reminderNumber - 1];
      
      // Check if this specific reminder has already been sent
      const alreadySent = await this.hasReminderBeenSent(inspection.inspection_id, 'labour_inspection', targetDays);
      if (alreadySent) {
        console.log(`⚠️ Labour Inspection ${inspection.inspection_id}: Reminder #${reminderNumber} (${targetDays} days) already sent`);
        return { success: false, message: `Reminder #${reminderNumber} already sent` };
      }

      // Prepare reminder data - pass Date object for proper formatting in email service
      const reminderData = {
        daysUntilExpiry,
        expiryDate: expiryDate, // Pass Date object, format it in email service
        reminderNumber
      };

      // Send email reminder
      const emailResult = await this.emailService.sendLabourInspectionReminder(inspection, reminderData);
      
      if (emailResult.success) {
        // Log the reminder
        await ReminderLog.create({
          policy_id: inspection.inspection_id,
          policy_type: 'labour_inspection',
          client_name: inspection.company?.company_name || 'Unknown Company',
          client_email: inspection.company?.company_email || 'No email',
          reminder_type: 'email',
          reminder_day: targetDays, // Store the target interval
          expiry_date: inspection.expiry_date,
          sent_at: new Date(),
          status: 'sent',
          email_subject: `Labour Inspection Reminder #${reminderNumber} - ${daysUntilExpiry} Days Until Expiry`,
          days_until_expiry: daysUntilExpiry,
          response_data: { reminderNumber }
        });

        console.log(`✅ Labour inspection reminder #${reminderNumber} sent successfully for inspection ${inspection.inspection_id}`);
        return { success: true, reminderNumber, daysUntilExpiry };
      } else {
        console.error(`❌ Failed to send labour inspection reminder for inspection ${inspection.inspection_id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing labour inspection reminder for inspection ${inspection.inspection_id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process all Labour License reminders
  async processLabourLicenseReminders() {
    try {
      console.log('🔄 Starting labour license reminder processing...');
      
      // Get renewal configuration for labour license
      const config = await RenewalConfig.getConfigByService('labour_license');
      if (!config) {
        console.log('⚠️ No renewal configuration found for labour license');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get licenses that need reminders
      const licenses = await this.getLabourLicensesNeedingReminders();
      console.log(`📋 Found ${licenses.length} licenses needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const license of licenses) {
        try {
          const result = await this.processSingleLabourLicense(license, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing license ${license.license_id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Labour license reminder processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        sent: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in labour license reminder processing:', error);
      throw error;
    }
  }

  // Get Labour License licenses that need reminders
  async getLabourLicensesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active licenses expiring within 30 days
      const licenses = await LabourLicense.findAll({
        where: {
          status: 'active',
          expiry_date: {
            [Op.lte]: thirtyDaysFromNow
          }
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
          }
        ],
        order: [['expiry_date', 'ASC']]
      });

      return licenses;
    } catch (error) {
      console.error('❌ Error getting labour licenses needing reminders:', error);
      throw error;
    }
  }

  // Process single labour license reminder
  async processSingleLabourLicense(license, config) {
    try {
      // Skip if already renewed/completed/closed
      if (['renewed', 'completed', 'closed', 'inactive', 'done'].includes((license.status || '').toLowerCase())) {
        console.log(`⏭️ Labour License ${license.license_id}: Skipping, status is '${license.status}'`);
        return { success: false, skipped: true, reason: 'Already renewed/completed' };
      }

      const expiryDate = new Date(license.expiry_date);
      const daysUntilExpiry = this.getDaysUntilExpiry(expiryDate);

      // Check if today is the right day to send a reminder (one of the 5 intervals)
      const reminderNumber = this.shouldSendReminderToday(daysUntilExpiry);
      if (reminderNumber === 0) {
        console.log(`⏭️ Labour License ${license.license_id}: No reminder due today (${daysUntilExpiry} days until expiry)`);
        return { success: false, message: 'Not a reminder day', skipped: true };
      }

      // Get the target days for this reminder
      const targetDays = this.reminderIntervals[reminderNumber - 1];
      
      // Check if this specific reminder has already been sent
      const alreadySent = await this.hasReminderBeenSent(license.license_id, 'labour_license', targetDays);
      if (alreadySent) {
        console.log(`⚠️ Labour License ${license.license_id}: Reminder #${reminderNumber} (${targetDays} days) already sent`);
        return { success: false, message: `Reminder #${reminderNumber} already sent` };
      }

      // Prepare reminder data
      const reminderData = {
        daysUntilExpiry,
        expiryDate: expiryDate.toLocaleDateString('en-IN'),
        reminderNumber
      };

      // Send email reminder
      const emailResult = await this.emailService.sendLabourLicenseReminder(license, reminderData);
      
      if (emailResult.success) {
        // Log the reminder
        await ReminderLog.create({
          policy_id: license.license_id,
          policy_type: 'labour_license',
          client_name: license.company?.company_name || 'Unknown Company',
          client_email: license.company?.company_email || 'No email',
          reminder_type: 'email',
          reminder_day: targetDays, // Store the target interval
          expiry_date: license.expiry_date,
          sent_at: new Date(),
          status: 'sent',
          email_subject: `Labour License Reminder #${reminderNumber} - ${daysUntilExpiry} Days Until Expiry`,
          days_until_expiry: daysUntilExpiry,
          response_data: { reminderNumber }
        });

        console.log(`✅ Labour license reminder #${reminderNumber} sent successfully for license ${license.license_id}`);
        return { success: true, reminderNumber, daysUntilExpiry };
      } else {
        console.error(`❌ Failed to send labour license reminder for license ${license.license_id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing labour license reminder for license ${license.license_id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Process all Fire Policy renewals that need reminders
  async processFirePolicyRenewals() {
    try {
      console.log('🔥 Starting Fire Policy renewal processing...');
      
      // Get renewal configuration for fire policy
      const config = await RenewalConfig.getConfigByService('fire');
      if (!config) {
        console.log('⚠️ No renewal configuration found for Fire Policy');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get policies that need reminders
      const policies = await this.getFirePoliciesNeedingReminders();
      console.log(`📋 Found ${policies.length} policies needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const policy of policies) {
        try {
          const result = await this.processSingleFirePolicy(policy, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing Fire Policy ${policy.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Fire Policy renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in Fire Policy renewal processing:', error);
      throw error;
    }
  }

  // Process all Life Insurance renewals that need reminders
  async processLifeInsuranceRenewals() {
    try {
      console.log('💖 Starting Life Insurance renewal processing...');
      
      // Get renewal configuration for life insurance
      const config = await RenewalConfig.getConfigByService('life');
      if (!config) {
        console.log('⚠️ No renewal configuration found for Life Insurance');
        return { success: false, message: 'No renewal configuration found' };
      }

      // Get policies that need reminders
      const policies = await this.getLifePoliciesNeedingReminders();
      console.log(`📋 Found ${policies.length} policies needing reminders`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const policy of policies) {
        try {
          const result = await this.processSingleLifePolicy(policy, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
        } catch (error) {
          console.error(`❌ Error processing Life Policy ${policy.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Life Insurance renewal processing completed:`);
      console.log(`   - Total processed: ${processedCount}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return {
        success: true,
        processed: processedCount,
        successful: successCount,
        errors: errorCount
      };
    } catch (error) {
      console.error('❌ Error in Life Insurance renewal processing:', error);
      throw error;
    }
  }

  // Get Life policies that need reminders
  async getLifePoliciesNeedingReminders() {
    try {
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      // Get active policies with next payment due within 30 days
      const LifePolicy = require('../models/lifePolicyModel');
      const policies = await LifePolicy.findAll({
        where: {
          status: 'active',
          policy_end_date: {
            [Op.lte]: thirtyDaysFromNow
          }
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
          }
        ],
        order: [['policy_end_date', 'ASC']]
      });

      // Filter policies that need reminders today
      const policiesNeedingReminders = [];
      for (const policy of policies) {
        const daysUntilPayment = this.getDaysUntilExpiry(policy.policy_end_date);
        
        if (daysUntilPayment <= 30 && daysUntilPayment > 0) {
          policiesNeedingReminders.push(policy);
        }
      }

      return policiesNeedingReminders;
    } catch (error) {
      console.error('❌ Error getting Life policies needing reminders:', error);
      throw error;
    }
  }

  // Process a single Life Policy renewal
  async processSingleLifePolicy(policy, config) {
    try {
      console.log(`📋 Processing Life Policy ${policy.id}...`);
      
      // Check if reminder already sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingReminder = await ReminderLog.findOne({
        where: {
          policy_id: policy.id,
          policy_type: 'life',
          sent_at: {
            [Op.gte]: today
          }
        }
      });

      if (existingReminder) {
        console.log(`⚠️ Reminder already sent today for Life Policy ${policy.id}`);
        return { success: false, message: 'Reminder already sent today' };
      }

      // Get client details
      const clientName = policy.companyPolicyHolder?.company_name || 
                        policy.consumerPolicyHolder?.name || 
                        policy.proposer_name || 
                        'Unknown';
      const clientEmail = policy.companyPolicyHolder?.company_email || 
                         policy.consumerPolicyHolder?.email || 
                         policy.email;

      if (!clientEmail) {
        console.log(`⚠️ No email found for Life Policy ${policy.id}`);
        return { success: false, message: 'No email address found' };
      }

      // Calculate days until next payment
      const daysUntilPayment = this.getDaysUntilExpiry(policy.policy_end_date);
      
      // Prepare reminder data
      const reminderData = {
        policyId: policy.id,
        policyNumber: policy.current_policy_number,
        clientName,
        clientEmail,
        daysUntilPayment,
        nextPaymentDate: policy.policy_end_date,
        policyType: 'life',
        policyDetails: {
          policyNumber: policy.current_policy_number,
          planName: policy.plan_name,
          subProduct: policy.sub_product,
          policyStartDate: policy.policy_start_date,
          policyTerm: policy.policy_term,
          premiumPaymentTerm: policy.premium_payment_term,
          id: policy.id
        }
      };

      // Send email reminder
      const emailResult = await this.emailService.sendLifeInsuranceRenewalReminder(reminderData);
      
      // Log the reminder
      await this.logLifePolicyReminder(policy, reminderData, emailResult);

      if (emailResult.success) {
        console.log(`✅ Life Insurance renewal reminder sent successfully for policy ${policy.id}`);
        return { success: true, messageId: emailResult.messageId };
      } else {
        console.log(`❌ Failed to send Life Insurance renewal reminder for policy ${policy.id}`);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing Life Policy ${policy.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Log Life Policy renewal reminder
  async logLifePolicyReminder(policy, reminderData, emailResult) {
    try {
      const logData = {
        policy_id: policy.id,
        policy_type: 'life',
        client_name: reminderData.clientName,
        client_email: reminderData.clientEmail,
        reminder_type: 'email',
        reminder_day: reminderData.daysUntilPayment,
        expiry_date: policy.policy_end_date,
        sent_at: new Date(),
        status: emailResult.success ? 'sent' : 'failed',
        email_subject: `Life Insurance Payment Reminder - ${reminderData.daysUntilPayment} days remaining`,
        response_data: emailResult.success ? { messageId: emailResult.messageId || 'unknown' } : null,
        error_message: emailResult.success ? null : emailResult.error || 'Unknown error',
        days_until_expiry: reminderData.daysUntilPayment
      };

      await ReminderLog.create(logData);
      console.log(`📝 Life Insurance renewal reminder logged successfully`);
    } catch (error) {
      console.error(`❌ Error logging Life Insurance renewal reminder:`, error);
    }
  }

  // Process all Stability Certificate reminders
  async processStabilityManagementReminders() {
    try {
      console.log('🔄 Starting stability management reminder processing...');
      
      // Get renewal configuration for stability management
      const config = await RenewalConfig.getConfigByService('stability');
      if (!config || !config.isActive) {
        console.log('⚠️ Stability management renewals are not active');
        return { sent: 0, errors: 0, message: 'Service not active' };
      }

      // Get stability records that need reminders
      const stabilityRecords = await this.getStabilityRecordsNeedingReminders();
      console.log(`📋 Found ${stabilityRecords.length} stability records needing reminders`);

      let successCount = 0;
      let errorCount = 0;

      for (const record of stabilityRecords) {
        try {
          console.log(`📋 Processing Stability Certificate record ${record.id}...`);
          const result = await this.processSingleStabilityRecord(record, config);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing stability record ${record.id}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Stability management reminder processing completed:`);
      console.log(`   - Total processed: ${stabilityRecords.length}`);
      console.log(`   - Successful: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);

      return { sent: successCount, errors: errorCount, successful: successCount };
    } catch (error) {
      console.error('❌ Error in stability management reminder processing:', error);
      return { sent: 0, errors: 1, error: error.message };
    }
  }

  // Get stability records that need renewal reminders
  async getStabilityRecordsNeedingReminders() {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90); // Check 90 days ahead

      const records = await StabilityManagement.findAll({
        where: {
          renewal_date: {
            [Op.lte]: futureDate,
            [Op.gte]: today
          },
          status: {
            [Op.in]: ['Approved', 'stability']
          }
        },
        include: [
          {
            model: FactoryQuotation,
            as: 'factoryQuotation',
            attributes: ['id', 'companyName', 'email', 'phone', 'totalAmount', 'stabilityCertificateType', 'stabilityCertificateAmount', 'companyAddress', 'noOfWorkers', 'horsePower']
          }
        ]
      });

      return records;
    } catch (error) {
      console.error('❌ Error fetching stability records needing reminders:', error);
      return [];
    }
  }

  // Process a single stability record reminder
  async processSingleStabilityRecord(record, config) {
    try {
      // Check if factory quotation exists
      if (!record.factoryQuotation || !record.factoryQuotation.email) {
        console.log(`⚠️ No email found for stability record ${record.id}`);
        return { success: false, message: 'No email found' };
      }

      const renewalDate = new Date(record.renewal_date);
      const today = new Date();
      const daysUntilExpiry = this.getDaysUntilExpiry(renewalDate);

      // Check if today is the right day to send a reminder (one of the 5 intervals)
      const reminderNumber = this.shouldSendReminderToday(daysUntilExpiry);
      if (reminderNumber === 0) {
        console.log(`⏭️ Stability Record ${record.id}: No reminder due today (${daysUntilExpiry} days until expiry)`);
        return { success: false, message: 'Not a reminder day', skipped: true };
      }

      // Get the target days for this reminder
      const targetDays = this.reminderIntervals[reminderNumber - 1];
      
      // Check if this specific reminder has already been sent
      const alreadySent = await this.hasReminderBeenSent(record.id, 'stability_management', targetDays);
      if (alreadySent) {
        console.log(`⚠️ Stability Record ${record.id}: Reminder #${reminderNumber} (${targetDays} days) already sent`);
        return { success: false, message: `Reminder #${reminderNumber} already sent` };
      }

      // Prepare reminder data
      const reminderData = {
        daysUntilExpiry,
        renewalDate: renewalDate.toLocaleDateString('en-IN'),
        reminderNumber
      };

      // Send email reminder
      const emailResult = await this.emailService.sendStabilityManagementReminder(record, reminderData);
      
      if (emailResult.success) {
        // Log the reminder
        await ReminderLog.create({
          policy_id: record.id,
          policy_type: 'stability_management',
          client_name: record.factoryQuotation?.companyName || 'Unknown Company',
          client_email: record.factoryQuotation?.email || 'No email',
          reminder_type: 'email',
          reminder_day: targetDays, // Store the target interval
          expiry_date: record.renewal_date,
          sent_at: new Date(),
          status: 'sent',
          email_subject: `Stability Certificate Reminder #${reminderNumber} - ${daysUntilExpiry} Days Until Renewal`,
          days_until_expiry: daysUntilExpiry,
          response_data: { reminderNumber }
        });

        console.log(`✅ Stability Certificate reminder #${reminderNumber} sent successfully for record ${record.id}`);
        return { success: true, reminderNumber, daysUntilExpiry };
      } else {
        console.error(`❌ Failed to send Stability Certificate reminder for record ${record.id}:`, emailResult.error);
        return { success: false, error: emailResult.error };
      }
    } catch (error) {
      console.error(`❌ Error processing stability record reminder for record ${record.id}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = RenewalService;
