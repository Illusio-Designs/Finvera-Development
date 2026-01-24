const express = require('express');
const router = express.Router();
const { updateAllStatuses, getFilteredPolicies, getStatusSummary } = require('../controllers/statusUpdateController');
const { auth } = require('../middleware/auth');

/**
 * @route POST /api/status-update/test-update
 * @desc Test status updates without authentication (for testing only)
 * @access Public
 */
router.post('/test-update', updateAllStatuses);

/**
 * @route GET /api/status-update/test-policies/:policyType/:filter
 * @desc Test filtered policies without authentication (for testing only)
 * @access Public
 */
router.get('/test-policies/:policyType/:filter', getFilteredPolicies);

/**
 * @route GET /api/status-update/test-summary
 * @desc Test status summary without authentication (for testing only)
 * @access Public
 */
router.get('/test-summary', getStatusSummary);

// Apply authentication middleware to protected routes
router.use(auth);

/**
 * @route POST /api/status-update/update-all
 * @desc Manually trigger status updates for all policies
 * @access Private
 */
router.post('/update-all', updateAllStatuses);

/**
 * @route GET /api/status-update/policies/:policyType/:filter
 * @desc Get filtered policies by type and status
 * @param {string} policyType - Type of policy (vehicle, health, ecp, etc.)
 * @param {string} filter - Filter type (all, running, expired)
 * @access Private
 */
router.get('/policies/:policyType/:filter', getFilteredPolicies);

/**
 * @route GET /api/status-update/summary
 * @desc Get status summary for all policy types
 * @access Private
 */
router.get('/summary', getStatusSummary);

module.exports = router;