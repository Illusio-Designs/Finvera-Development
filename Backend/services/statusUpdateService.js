const { Op } = require('sequelize');
const VehiclePolicy = require('../models/vehiclePolicyModel');
const HealthPolicies = require('../models/healthPolicyModel');
const EmployeeCompensationPolicy = require('../models/employeeCompensationPolicyModel');
const FirePolicy = require('../models/firePolicyModel');
const LifePolicy = require('../models/lifePolicyModel');
const DSC = require('../models/dscModel');
const FactoryQuotation = require('../models/factoryQuotationModel');
const { LabourInspection, LabourLicense } = require('../models');
const StabilityManagement = require('../models/stabilityManagementModel');
const Company = require('../models/companyModel');
const Consumer = require('../models/consumerModel');
const InsuranceCompany = require('../models/insuranceCompanyModel');

class StatusUpdateService {
  constructor() {
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0); // Start of today
  }

  /**
   * Update all policy statuses based on expiry dates
   */
  async updateAllPolicyStatuses() {
    try {
      console.log('🔄 Starting automatic status updates for all policies...');
      
      const results = {
        vehiclePolicy: await this.updateVehiclePolicyStatuses(),
        healthPolicy: await this.updateHealthPolicyStatuses(),
        ecpPolicy: await this.updateECPPolicyStatuses(),
        firePolicy: await this.updateFirePolicyStatuses(),
        lifePolicy: await this.updateLifePolicyStatuses(),
        dsc: await this.updateDSCStatuses(),
        factoryQuotation: await this.updateFactoryQuotationStatuses(),
        labourInspection: await this.updateLabourInspectionStatuses(),
        labourLicense: await this.updateLabourLicenseStatuses(),
        stabilityManagement: await this.updateStabilityManagementStatuses()
      };

      const totalUpdated = Object.values(results).reduce((sum, result) => sum + result.updated, 0);
      
      console.log('✅ Automatic status updates completed');
      console.log(`📊 Total policies updated: ${totalUpdated}`);
      
      return {
        success: true,
        totalUpdated,
        details: results
      };
    } catch (error) {
      console.error('❌ Error in automatic status updates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update Vehicle Policy statuses
   */
  async updateVehiclePolicyStatuses() {
    try {
      // Update expired policies
      const [expiredCount] = await VehiclePolicy.update(
        { status: 'expired' },
        {
          where: {
            policy_end_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      // Update active policies (not yet expired)
      const [activeCount] = await VehiclePolicy.update(
        { status: 'active' },
        {
          where: {
            policy_end_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`🚗 Vehicle Policy: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Vehicle Policy statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Health Policy statuses
   */
  async updateHealthPolicyStatuses() {
    try {
      const [expiredCount] = await HealthPolicies.update(
        { status: 'expired' },
        {
          where: {
            policy_end_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      const [activeCount] = await HealthPolicies.update(
        { status: 'active' },
        {
          where: {
            policy_end_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`🏥 Health Policy: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Health Policy statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update ECP Policy statuses
   */
  async updateECPPolicyStatuses() {
    try {
      const [expiredCount] = await EmployeeCompensationPolicy.update(
        { status: 'expired' },
        {
          where: {
            policy_end_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      const [activeCount] = await EmployeeCompensationPolicy.update(
        { status: 'active' },
        {
          where: {
            policy_end_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`👷 ECP Policy: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating ECP Policy statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Fire Policy statuses
   */
  async updateFirePolicyStatuses() {
    try {
      const [expiredCount] = await FirePolicy.update(
        { status: 'expired' },
        {
          where: {
            policy_end_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      const [activeCount] = await FirePolicy.update(
        { status: 'active' },
        {
          where: {
            policy_end_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`🔥 Fire Policy: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Fire Policy statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Life Policy statuses
   */
  async updateLifePolicyStatuses() {
    try {
      const [expiredCount] = await LifePolicy.update(
        { status: 'expired' },
        {
          where: {
            policy_end_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      const [activeCount] = await LifePolicy.update(
        { status: 'active' },
        {
          where: {
            policy_end_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`💖 Life Policy: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Life Policy statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update DSC statuses
   */
  async updateDSCStatuses() {
    try {
      const [expiredCount] = await DSC.update(
        { status: 'expired' },
        {
          where: {
            expiry_date: { [Op.lt]: this.today },
            status: { [Op.notIn]: ['expired', 'out'] }
          }
        }
      );

      const [activeCount] = await DSC.update(
        { status: 'in' },
        {
          where: {
            expiry_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewed'] }
          }
        }
      );

      console.log(`🔐 DSC: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating DSC statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Factory Quotation statuses
   */
  async updateFactoryQuotationStatuses() {
    try {
      const [expiredCount] = await FactoryQuotation.update(
        { status: 'expired' },
        {
          where: {
            renewal_date: { [Op.lt]: this.today },
            status: { [Op.notIn]: ['expired', 'completed', 'closed'] }
          }
        }
      );

      const [activeCount] = await FactoryQuotation.update(
        { status: 'approved' },
        {
          where: {
            renewal_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'renewal'] }
          }
        }
      );

      console.log(`🏭 Factory Quotation: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Factory Quotation statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Labour Inspection statuses
   */
  async updateLabourInspectionStatuses() {
    try {
      const [expiredCount] = await LabourInspection.update(
        { status: 'expired' },
        {
          where: {
            expiry_date: { [Op.lt]: this.today },
            status: { [Op.notIn]: ['expired', 'completed', 'closed'] }
          }
        }
      );

      const [activeCount] = await LabourInspection.update(
        { status: 'running' },
        {
          where: {
            expiry_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'approved'] }
          }
        }
      );

      console.log(`👮 Labour Inspection: ${expiredCount} expired, ${activeCount} running`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Labour Inspection statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Labour License statuses
   */
  async updateLabourLicenseStatuses() {
    try {
      const [expiredCount] = await LabourLicense.update(
        { status: 'expired' },
        {
          where: {
            expiry_date: { [Op.lt]: this.today },
            status: { [Op.ne]: 'expired' }
          }
        }
      );

      const [activeCount] = await LabourLicense.update(
        { status: 'active' },
        {
          where: {
            expiry_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'approved'] }
          }
        }
      );

      console.log(`📋 Labour License: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Labour License statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Update Stability Management statuses
   */
  async updateStabilityManagementStatuses() {
    try {
      const [expiredCount] = await StabilityManagement.update(
        { status: 'expired' },
        {
          where: {
            renewal_date: { [Op.lt]: this.today },
            status: { [Op.notIn]: ['expired', 'completed', 'closed'] }
          }
        }
      );

      const [activeCount] = await StabilityManagement.update(
        { status: 'stability' },
        {
          where: {
            renewal_date: { [Op.gte]: this.today },
            status: { [Op.in]: ['pending', 'running', 'approved'] }
          }
        }
      );

      console.log(`⚖️ Stability Management: ${expiredCount} expired, ${activeCount} active`);
      return { updated: expiredCount + activeCount, expired: expiredCount, active: activeCount };
    } catch (error) {
      console.error('❌ Error updating Stability Management statuses:', error);
      return { updated: 0, expired: 0, active: 0 };
    }
  }

  /**
   * Get filtered policies based on status for frontend
   */
  async getFilteredPolicies(policyType, filterType = 'all') {
    try {
      let Model;
      let dateField = 'policy_end_date';
      let activeStatuses = ['active'];
      let expiredStatuses = ['expired'];
      let includeAssociations = [];

      // Map policy types to models and configurations
      switch (policyType) {
        case 'vehicle':
          Model = VehiclePolicy;
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'companyPolicyHolder',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              required: false,
              attributes: ['consumer_id', 'name', 'email', 'phone_number']
            },
            {
              model: InsuranceCompany,
              as: 'provider',
              required: false,
              attributes: ['id', 'name']
            }
          ];
          break;
        case 'health':
          Model = HealthPolicies;
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'companyPolicyHolder',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              required: false,
              attributes: ['consumer_id', 'name', 'email', 'phone_number']
            },
            {
              model: InsuranceCompany,
              as: 'provider',
              required: false,
              attributes: ['id', 'name']
            }
          ];
          break;
        case 'ecp':
          Model = EmployeeCompensationPolicy;
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'policyHolder',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: InsuranceCompany,
              as: 'provider',
              required: false,
              attributes: ['id', 'name']
            }
          ];
          break;
        case 'fire':
          Model = FirePolicy;
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'companyPolicyHolder',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              required: false,
              attributes: ['consumer_id', 'name', 'email', 'phone_number']
            },
            {
              model: InsuranceCompany,
              as: 'provider',
              required: false,
              attributes: ['id', 'name']
            }
          ];
          break;
        case 'life':
          Model = LifePolicy;
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'companyPolicyHolder',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: Consumer,
              as: 'consumerPolicyHolder',
              required: false,
              attributes: ['consumer_id', 'name', 'email', 'phone_number']
            },
            {
              model: InsuranceCompany,
              as: 'provider',
              required: false,
              attributes: ['id', 'name']
            }
          ];
          break;
        case 'dsc':
          Model = DSC;
          dateField = 'expiry_date';
          activeStatuses = ['in', 'running'];
          expiredStatuses = ['expired', 'out'];
          includeAssociations = [
            {
              model: Company,
              as: 'company',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            },
            {
              model: Consumer,
              as: 'consumer',
              required: false,
              attributes: ['consumer_id', 'name', 'email', 'phone_number']
            }
          ];
          break;
        case 'factory':
          Model = FactoryQuotation;
          dateField = 'renewal_date';
          activeStatuses = ['approved', 'running', 'renewal'];
          expiredStatuses = ['expired', 'completed'];
          includeAssociations = [
            {
              model: Company,
              as: 'company',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            }
          ];
          break;
        case 'labour_inspection':
          Model = LabourInspection;
          dateField = 'expiry_date';
          activeStatuses = ['running', 'pending'];
          expiredStatuses = ['expired', 'completed'];
          includeAssociations = [
            {
              model: Company,
              as: 'company',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            }
          ];
          break;
        case 'labour_license':
          Model = LabourLicense;
          dateField = 'expiry_date';
          activeStatuses = ['active', 'running'];
          includeAssociations = [
            {
              model: Company,
              as: 'company',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            }
          ];
          break;
        case 'stability':
          Model = StabilityManagement;
          dateField = 'renewal_date';
          activeStatuses = ['stability', 'approved', 'running'];
          expiredStatuses = ['expired', 'completed'];
          includeAssociations = [
            {
              model: Company,
              as: 'company',
              required: false,
              attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
            }
          ];
          break;
        default:
          throw new Error(`Unknown policy type: ${policyType}`);
      }

      let whereClause = {};

      if (filterType === 'running') {
        // Show only active/running policies
        whereClause.status = { [Op.in]: activeStatuses };
      } else if (filterType === 'expired') {
        // Show only expired policies
        whereClause.status = { [Op.in]: expiredStatuses };
      }
      // For 'all', no status filter is applied - show everything in date order

      const policies = await Model.findAll({
        where: whereClause,
        include: includeAssociations,
        order: [[dateField, 'DESC']] // Order by date (newest first) regardless of status
      });

      console.log(`📊 Found ${policies.length} ${filterType} ${policyType} policies with associations`);

      return {
        success: true,
        data: policies,
        count: policies.length
      };
    } catch (error) {
      console.error(`❌ Error getting filtered policies for ${policyType}:`, error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }
}

module.exports = StatusUpdateService;