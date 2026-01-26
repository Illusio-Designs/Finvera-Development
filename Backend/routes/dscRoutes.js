const express = require('express');
const router = express.Router();
const dscController = require('../controllers/dscController');
const { auth, checkRole } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Apply role check middleware to all routes
router.use(checkRole(['Admin', 'DSC_manager']));

// Get active companies and consumers for dropdown
router.get('/companies', dscController.getActiveCompanies);
router.get('/consumers', dscController.getActiveConsumers);

// Search DSCs (must be before /:id route)
router.get('/search', dscController.searchDSCs);

// DSC routes
router.get('/', dscController.getAllDSCs);

// Statistics endpoint
router.get('/statistics', dscController.getDSCStatistics);

// Get all DSCs grouped (running + previous) - must be before /:id
router.get('/all-grouped', dscController.getAllDSCsGrouped);

router.get('/:id', dscController.getDSCById);

// Renew DSC
router.post('/:id/renew', dscController.renewDSC);
router.post('/', dscController.createDSC);
router.put('/:id', dscController.updateDSC);
router.patch('/:id/status', dscController.changeDSCStatus);
router.delete('/:id', dscController.deleteDSC);

// Get DSCs by company or consumer
router.get('/company/:companyId', dscController.getDSCsByCompany);
router.get('/consumer/:consumerId', dscController.getDSCsByConsumer);

module.exports = router; 