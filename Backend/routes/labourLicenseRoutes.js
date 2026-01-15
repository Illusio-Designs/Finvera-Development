const express = require('express');
const router = express.Router();
const labourLicenseController = require('../controllers/labourLicenseController');
const { auth } = require('../middleware/auth');
const checkUserRole = require('../middleware/checkUserRole');
const { uploadLicenseFiles } = require('../config/multerConfig');

// Create labour license
router.post('/', auth, checkUserRole(['Admin', 'Compliance_manager', 'Labour_law_manager']), uploadLicenseFiles, labourLicenseController.createLabourLicense);

// Get labour license stats overview (must be before /:id)
router.get('/stats/overview', auth, labourLicenseController.getLabourLicenseStatsOverview);

// Get statistics (must be before /:id)
router.get('/statistics', auth, labourLicenseController.getStatistics);

// Search labour licenses (must be before /:id)
router.get('/search', auth, labourLicenseController.searchLabourLicenses);

// Get all licenses grouped (running + previous) (must be before /:id)
router.get('/all-grouped', auth, checkUserRole(['Admin', 'Compliance_manager', 'Labour_law_manager']), labourLicenseController.getAllLicensesGrouped);

// Check and update expired licenses (Admin only) (must be before /:id)
router.post('/check-expired', auth, checkUserRole(['Admin']), labourLicenseController.checkAndUpdateExpiredLicenses);

// Get all labour licenses
router.get('/', auth, labourLicenseController.getAllLabourLicenses);

// Get labour license by ID
router.get('/:id', auth, labourLicenseController.getLabourLicenseById);

// Update labour license
router.put('/:id', auth, checkUserRole(['Admin', 'Compliance_manager', 'Labour_law_manager']), uploadLicenseFiles, labourLicenseController.updateLabourLicense);

// Delete labour license
router.delete('/:id', auth, checkUserRole(['Admin']), labourLicenseController.deleteLabourLicense);

// Upload labour license documents (for existing records)
router.post('/:id/upload', auth, checkUserRole(['Admin', 'Compliance_manager', 'Labour_law_manager']), uploadLicenseFiles, labourLicenseController.uploadLicenseDocuments);

// Renew labour license
router.post('/:id/renew', auth, checkUserRole(['Admin', 'Compliance_manager', 'Labour_law_manager']), labourLicenseController.renewLabourLicense);

// Get previous licenses for a specific license
router.get('/:id/previous', auth, labourLicenseController.getPreviousLicenses);

module.exports = router;
