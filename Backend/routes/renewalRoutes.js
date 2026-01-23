const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const renewalConfigController = require('../controllers/renewalConfigController');

// Renewal Configuration Routes
router.get('/configs', auth, renewalConfigController.getAllConfigs);
router.get('/configs/:serviceType', auth, renewalConfigController.getConfigByService);
router.post('/configs', auth, renewalConfigController.createConfig);
router.put('/configs/:id', auth, renewalConfigController.updateConfig);
router.delete('/configs/:id', auth, renewalConfigController.deleteConfig);

// Get default service types for easy configuration
router.get('/service-types', auth, renewalConfigController.getDefaultServiceTypes);

// Get renewal logs
router.get('/logs', auth, renewalConfigController.getLogs);

// Get renewal counts
router.get('/counts', auth, renewalConfigController.getCounts);

// Get live renewal data for dashboard
router.get('/live-data', auth, renewalConfigController.getLiveRenewalData);

// Get renewal list by type and period
router.get('/list', auth, renewalConfigController.getListByTypeAndPeriod);

// Search renewals
router.get('/search', auth, renewalConfigController.searchRenewals);

// Trigger renewal processing manually
router.post('/trigger', auth, async (req, res) => {
  try {
    const RenewalService = require('../services/renewalService');
    const renewalService = new RenewalService();
    
    console.log('🚀 Manual renewal trigger initiated - ALL SYSTEMS');
    
    // Process ALL renewal systems
    const results = {
      vehicle: await renewalService.processVehicleInsuranceRenewals(),
      health: await renewalService.processHealthInsuranceRenewals(),
      fire: await renewalService.processFirePolicyRenewals(),
      life: await renewalService.processLifeInsuranceRenewals(),
      ecp: await renewalService.processECPRenewals(),
      dsc: await renewalService.processDSCRenewals(),
      factory: await renewalService.processFactoryQuotationRenewals(),
      labourLicense: await renewalService.processLabourLicenseReminders(),
      labourInspection: await renewalService.processLabourInspectionReminders(),
      stability: await renewalService.processStabilityManagementReminders()
    };
    
    console.log('✅ All renewal systems processing completed');
    
    // Calculate totals
    const totalSent = Object.values(results).reduce((sum, r) => sum + (r.successful || 0), 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + (r.errors || 0), 0);
    
    res.json({
      success: true,
      message: `All renewal reminders processed successfully - ${totalSent} emails sent`,
      totalSent,
      totalErrors,
      results
    });
  } catch (error) {
    console.error('❌ Error triggering renewals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 