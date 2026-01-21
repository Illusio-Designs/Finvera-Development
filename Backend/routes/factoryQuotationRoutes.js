const express = require('express');
const router = express.Router();
const factoryQuotationController = require('../controllers/factoryQuotationController');
const { auth } = require('../middleware/auth');
const checkUserRole = require('../middleware/checkUserRole');

// Apply authentication middleware first
router.use(auth);

// Get calculation options (no role restriction needed)
router.get('/options', factoryQuotationController.getCalculationOptions);

// Calculate amount (no role restriction needed)
router.post('/calculate', factoryQuotationController.calculateAmount);

// Restrict remaining routes to Admin and Compliance_manager
router.use(checkUserRole(['Admin', 'Compliance_manager']));

// Create a new quotation
router.post('/', factoryQuotationController.createQuotation);

// Get all quotations
router.get('/', factoryQuotationController.getAllQuotations);

// Search quotations
router.get('/search', factoryQuotationController.searchQuotations);

// Get statistics
router.get('/statistics', factoryQuotationController.getStatistics);

// Get all quotations grouped (running + previous) - must be before /:id
router.get('/all-grouped', factoryQuotationController.getAllQuotationsGrouped);

// Get a quotation by ID
router.get('/:id', factoryQuotationController.getQuotationById);

// Renew factory quotation
router.post('/:id/renew', factoryQuotationController.renewQuotation);

// Update a quotation
router.put('/:id', factoryQuotationController.updateQuotation);

// Update quotation status
router.put('/:id/status', factoryQuotationController.updateStatus);

// Generate PDF for a quotation
router.post('/:id/generate-pdf', factoryQuotationController.generatePDF);

// Download PDF for a quotation
router.get('/:id/download-pdf', factoryQuotationController.downloadPDF);

// Delete a quotation
router.delete('/:id', factoryQuotationController.deleteQuotation);

module.exports = router; 