const express = require('express');
const router = express.Router();
const stabilityManagementController = require('../controllers/stabilityManagementController');
const { auth } = require('../middleware/auth');
const checkUserRole = require('../middleware/checkUserRole');
const { uploadStabilityFiles } = require('../config/multerConfig');
const { body } = require('express-validator');

// Apply authentication middleware
router.use(auth);

// Get stability managers (users with Stability_manager role)
router.get('/managers', stabilityManagementController.getStabilityManagers);

// Get all stability management records (Admin can see all, Stability Manager sees only their own)
router.get('/', stabilityManagementController.getAllStabilityManagement);

// Search stability management records
router.get('/search', checkUserRole(['Admin', 'Stability_manager']), stabilityManagementController.searchStabilityManagement);

// Get stability management by factory quotation ID
router.get('/quotation/:quotationId', stabilityManagementController.getStabilityManagementByQuotationId);

// Create stability management (assign to stability manager) - Admin and Compliance Manager only
router.post('/', checkUserRole(['Admin', 'Compliance_manager']), stabilityManagementController.createStabilityManagement);

// Update stability status - Stability Manager and Admin only
router.put('/:id/status', checkUserRole(['Stability_manager', 'Admin']), stabilityManagementController.updateStabilityStatus);

// Update stability dates - Stability Manager and Admin only
router.put('/:id/dates', checkUserRole(['Stability_manager', 'Admin']), stabilityManagementController.updateStabilityDates);

// Upload files for stability - Stability Manager and Admin only
router.put('/:id/upload-files', checkUserRole(['Stability_manager', 'Admin']), uploadStabilityFiles, stabilityManagementController.uploadStabilityFiles);

// Get stability files - Stability Manager and Admin only
router.get('/:id/files', checkUserRole(['Stability_manager', 'Admin']), stabilityManagementController.getStabilityFiles);

// Delete stability file - Stability Manager and Admin only
router.delete('/:id/files/:filename', checkUserRole(['Stability_manager', 'Admin']), stabilityManagementController.deleteStabilityFile);

// Get statistics
router.get('/statistics', auth, stabilityManagementController.getStatistics);

// ===== RENEWAL SYSTEM ROUTES =====

// Renew stability - Admin and Stability Manager only
router.post('/:id/renew', 
  checkUserRole(['Admin', 'Stability_manager']),
  uploadStabilityFiles,
  [
    body('stability_manager_id').notEmpty().withMessage('Stability manager ID is required'),
    body('load_type').isIn(['with_load', 'without_load']).withMessage('Load type must be with_load or without_load'),
    body('stability_date').isISO8601().withMessage('Valid stability date is required'),
    body('remarks').optional().isString()
  ],
  stabilityManagementController.renewStability
);

// Get previous stabilities
router.get('/previous', checkUserRole(['Admin', 'Stability_manager']), stabilityManagementController.getPreviousStabilities);

// Get previous stability by ID
router.get('/previous/:id', checkUserRole(['Admin', 'Stability_manager']), stabilityManagementController.getPreviousStabilityById);

// Get all stabilities grouped (running + previous)
router.get('/all-grouped', checkUserRole(['Admin', 'Stability_manager']), stabilityManagementController.getAllStabilitiesGrouped);

module.exports = router; 