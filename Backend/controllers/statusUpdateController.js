const StatusUpdateService = require('../services/statusUpdateService');

/**
 * Manually trigger status updates for all policies
 */
const updateAllStatuses = async (req, res) => {
  try {
    console.log('🔄 Manual status update triggered by user');
    
    const statusUpdateService = new StatusUpdateService();
    const result = await statusUpdateService.updateAllPolicyStatuses();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully updated ${result.totalUpdated} policy statuses`,
        data: result.details
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update policy statuses',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in manual status update:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating policy statuses',
      error: error.message
    });
  }
};

/**
 * Get filtered policies based on status
 */
const getFilteredPolicies = async (req, res) => {
  try {
    const { policyType, filter = 'all' } = req.params;
    const { page = 1, pageSize = 10, limit } = req.query;
    
    // Use pageSize if provided, otherwise use limit, otherwise default to 10
    const itemsPerPage = parseInt(pageSize) || parseInt(limit) || 10;
    const currentPage = parseInt(page);
    
    console.log(`🔍 Getting ${filter} ${policyType} policies - Page: ${currentPage}, PageSize: ${itemsPerPage}`);
    
    const statusUpdateService = new StatusUpdateService();
    
    // First update statuses to ensure data is current
    await statusUpdateService.updateAllPolicyStatuses();
    
    const result = await statusUpdateService.getFilteredPolicies(policyType, filter);
    
    if (result.success) {
      // Apply pagination
      const offset = (currentPage - 1) * itemsPerPage;
      const paginatedData = result.data.slice(offset, offset + itemsPerPage);
      
      console.log(`📊 Returning ${paginatedData.length} policies out of ${result.count} total`);
      
      res.json({
        success: true,
        data: paginatedData,
        pagination: {
          total: result.count,
          page: currentPage,
          pageSize: itemsPerPage,
          limit: itemsPerPage, // Keep for backward compatibility
          totalPages: Math.ceil(result.count / itemsPerPage)
        },
        filter: filter,
        policyType: policyType
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get filtered policies',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error getting filtered policies:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting filtered policies',
      error: error.message
    });
  }
};

/**
 * Get status summary for all policy types
 */
const getStatusSummary = async (req, res) => {
  try {
    const statusUpdateService = new StatusUpdateService();
    
    // Update all statuses first
    await statusUpdateService.updateAllPolicyStatuses();
    
    const policyTypes = [
      'vehicle', 'health', 'ecp', 'fire', 'life', 
      'dsc', 'factory', 'labour_inspection', 'labour_license', 'stability'
    ];
    
    const summary = {};
    
    for (const policyType of policyTypes) {
      const allResult = await statusUpdateService.getFilteredPolicies(policyType, 'all');
      const runningResult = await statusUpdateService.getFilteredPolicies(policyType, 'running');
      const expiredResult = await statusUpdateService.getFilteredPolicies(policyType, 'expired');
      
      summary[policyType] = {
        total: allResult.count,
        running: runningResult.count,
        expired: expiredResult.count
      };
    }
    
    res.json({
      success: true,
      data: summary,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting status summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting status summary',
      error: error.message
    });
  }
};

module.exports = {
  updateAllStatuses,
  getFilteredPolicies,
  getStatusSummary
};