const { DSC, Company, Consumer, DSCLog } = require('../models');
const { Op } = require('sequelize');

// Get all DSCs
exports.getAllDSCs = async (req, res) => {
    try {
        // Debug log: who is requesting
        if (req.user) {
            console.log('[getAllDSC] Requested by user:', req.user.user_id, 'roles:', req.user.roles || req.user.role_name);
        } else {
            console.log('[getAllDSC] Requested by unknown user');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * limit;

        const { count, rows } = await DSC.findAndCountAll({
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
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        // Debug log: how many DSC records found
        console.log('[getAllDSC] Found DSC records:', count);
        res.json({ 
            success: true, 
            dscs: rows,
            currentPage: page,
            pageSize: limit,
            totalPages: Math.ceil(count / limit),
            totalItems: count
        });
    } catch (error) {
        console.error('Error in getAllDSCs:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get active companies for DSC
exports.getActiveCompanies = async (req, res) => {
    try {
        const companies = await Company.findAll({
            where: { status: 'Active' },
            attributes: [
                'company_id',
                'company_name',
                'company_email',
                'contact_number',
                'gst_number',
                'pan_number'
            ]
        });
        res.json(companies);
    } catch (error) {
        console.error('Error fetching active companies:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get active consumers for DSC
exports.getActiveConsumers = async (req, res) => {
    try {
        const consumers = await Consumer.findAll({
            where: { status: 'Active' },
            attributes: [
                'consumer_id',
                'name',
                'email',
                'phone_number',
                'contact_address'
            ]
        });
        res.json(consumers);
    } catch (error) {
        console.error('Error fetching active consumers:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get DSC by ID
exports.getDSCById = async (req, res) => {
    try {
        const dsc = await DSC.findByPk(req.params.id, {
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
                },
                {
                    model: Consumer,
                    as: 'consumer',
                    attributes: ['consumer_id', 'consumer_name', 'email', 'phone_number']
                }
            ]
        });
        if (!dsc) {
            return res.status(404).json({ success: false, message: 'DSC not found' });
        }
        res.json({ success: true, dsc });
    } catch (error) {
        console.error('Error in getDSCById:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create new DSC
exports.createDSC = async (req, res) => {
    try {
        const { company_id, consumer_id, certification_name, expiry_date, status, remarks } = req.body;
        
        // Validate required fields
        if (!certification_name || !expiry_date) {
            return res.status(400).json({ 
                success: false, 
                message: 'Certification name and expiry date are required' 
            });
        }

        // Validate that either company_id or consumer_id is provided
        if (!company_id && !consumer_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Either company_id or consumer_id must be provided' 
            });
        }

        const dsc = await DSC.create({
            company_id,
            consumer_id,
            certification_name,
            expiry_date,
            status: status || 'in',
            remarks
        });

        // Log creation
        try {
            await DSCLog.create({
                dsc_id: dsc.dsc_id || dsc.id,
                action: 'create',
                performed_by: req.user ? req.user.user_id : null,
                details: JSON.stringify(req.body)
            });
        } catch (logErr) {
            console.error('[DSCLog] Failed to log createDSC:', logErr);
        }

        res.status(201).json({ success: true, dsc });
    } catch (error) {
        console.error('[DSCController] Error:', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            const fields = error.errors ? error.errors.map(e => e.path).join(', ') : 'unknown';
            return res.status(400).json({ message: `Duplicate entry: ${fields} must be unique.` });
        } else if (error.name === 'SequelizeValidationError') {
            const details = error.errors ? error.errors.map(e => e.message).join('; ') : error.message;
            return res.status(400).json({ message: `Validation error: ${details}` });
        } else {
            return res.status(500).json({ message: `DSC operation failed: ${error.message}` });
        }
    }
};

// Update DSC
exports.updateDSC = async (req, res) => {
    try {
        const { certification_name, expiry_date, status, remarks } = req.body;
        const dsc = await DSC.findByPk(req.params.id);
        
        if (!dsc) {
            return res.status(404).json({ success: false, message: 'DSC not found' });
        }

        await dsc.update({
            certification_name,
            expiry_date,
            status,
            remarks
        });

        // Log update
        try {
            await DSCLog.create({
                dsc_id: dsc.dsc_id || dsc.id,
                action: 'update',
                performed_by: req.user ? req.user.user_id : null,
                details: JSON.stringify(req.body)
            });
        } catch (logErr) {
            console.error('[DSCLog] Failed to log updateDSC:', logErr);
        }

        res.json({ success: true, dsc });
    } catch (error) {
        console.error('Error in updateDSC:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Change DSC status
exports.changeDSCStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const dsc = await DSC.findByPk(req.params.id);
        
        if (!dsc) {
            return res.status(404).json({ success: false, message: 'DSC not found' });
        }

        if (!['in', 'out'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Status must be either "in" or "out"' 
            });
        }

        await dsc.update({ status });
        res.json({ success: true, dsc });
    } catch (error) {
        console.error('Error in changeDSCStatus:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete DSC
exports.deleteDSC = async (req, res) => {
    try {
        const dsc = await DSC.findByPk(req.params.id);
        if (!dsc) {
            return res.status(404).json({ success: false, message: 'DSC not found' });
        }
        await dsc.destroy();
        res.json({ success: true, message: 'DSC deleted successfully' });
    } catch (error) {
        console.error('Error in deleteDSC:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get DSCs by company
exports.getDSCsByCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        if (!companyId || companyId === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid company ID is required' 
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * limit;

        const { count, rows } = await DSC.findAndCountAll({
            where: { company_id: companyId },
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
                },
                {
                    model: Consumer,
                    as: 'consumer',
                    attributes: ['consumer_id', 'consumer_name', 'email', 'phone_number']
                }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        res.json({ 
            success: true, 
            dscs: rows,
            currentPage: page,
            pageSize: limit,
            totalPages: Math.ceil(count / limit),
            totalItems: count
        });
    } catch (error) {
        console.error('Error in getDSCsByCompany:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get DSCs by consumer
exports.getDSCsByConsumer = async (req, res) => {
    try {
        const { consumerId } = req.params;
        
        if (!consumerId || consumerId === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid consumer ID is required' 
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * limit;

        const { count, rows } = await DSC.findAndCountAll({
            where: { consumer_id: consumerId },
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
                },
                {
                    model: Consumer,
                    as: 'consumer',
                    attributes: ['consumer_id', 'consumer_name', 'email', 'phone_number']
                }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        res.json({ 
            success: true, 
            dscs: rows,
            currentPage: page,
            pageSize: limit,
            totalPages: Math.ceil(count / limit),
            totalItems: count
        });
    } catch (error) {
        console.error('Error in getDSCsByConsumer:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Search DSCs
exports.searchDSCs = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Missing search query' });
        }

        console.log(`[DSCController] Searching DSCs with query: "${q}"`);

        // Search in main DSC fields
        const dscs = await DSC.findAll({
            where: {
                [Op.or]: [
                    { certification_name: { [Op.like]: `%${q}%` } }
                ]
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
            order: [['created_at', 'DESC']]
        });

        // Search for DSCs where company name matches
        const dscsByCompany = await DSC.findAll({
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['company_id', 'company_name', 'company_email', 'contact_number'],
                    required: true,
                    where: { company_name: { [Op.like]: `%${q}%` } }
                },
                {
                    model: Consumer,
                    as: 'consumer',
                    attributes: ['consumer_id', 'name', 'email', 'phone_number']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Search for DSCs where consumer name matches
        const dscsByConsumer = await DSC.findAll({
            include: [
                {
                    model: Company,
                    as: 'company',
                    attributes: ['company_id', 'company_name', 'company_email', 'contact_number']
                },
                {
                    model: Consumer,
                    as: 'consumer',
                    attributes: ['consumer_id', 'name', 'email', 'phone_number'],
                    required: true,
                    where: { name: { [Op.like]: `%${q}%` } }
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Combine all results and remove duplicates
        const allDSCs = [...dscs, ...dscsByCompany, ...dscsByConsumer];
        const uniqueDSCs = allDSCs.filter((dsc, index, self) => 
            index === self.findIndex(d => d.dsc_id === dsc.dsc_id)
        );

        console.log(`[DSCController] Found ${uniqueDSCs.length} DSCs for query: "${q}"`);

        res.json({ success: true, dscs: uniqueDSCs });
    } catch (error) {
        console.error('Error in searchDSCs:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDSCStatistics = async (req, res) => {
  try {
    // Get total DSCs count
    const totalDSCs = await DSC.count();

    // Get IN status DSCs count
    const inDSCs = await DSC.count({
      where: {
        status: 'in'
      }
    });

    // Get OUT status DSCs count
    const outDSCs = await DSC.count({
      where: {
        status: 'out'
      }
    });

    res.json({
      totalDSCs,
      inDSCs,
      outDSCs
    });
  } catch (error) {
    console.error('Error fetching DSC statistics:', error);
    res.status(500).json({ 
      message: 'Failed to get DSC statistics',
      error: error.message 
    });
  }
};

// Renew DSC (similar to Factory Quotation renewal)
exports.renewDSC = async (req, res) => {
  try {
    const { id } = req.params;
    const renewalData = req.body;

    console.log('🔄 Starting DSC renewal for ID:', id);

    // Validate required fields
    if (!renewalData.expiry_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: expiry_date'
      });
    }

    // Get the current DSC
    const currentDSC = await DSC.findByPk(id, {
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
      ]
    });

    if (!currentDSC) {
      return res.status(404).json({
        success: false,
        message: 'DSC not found'
      });
    }

    console.log('📋 Current DSC found:', currentDSC.dsc_id);

    // Update current DSC with new expiry date and set status to 'in'
    await currentDSC.update({
      expiry_date: renewalData.expiry_date,
      status: 'in',
      remarks: renewalData.remarks || currentDSC.remarks
    });

    console.log('✅ DSC renewed successfully with new expiry date');

    // Fetch updated DSC for response
    const updatedDSC = await DSC.findByPk(id, {
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
      ]
    });

    res.json({
      success: true,
      message: 'DSC renewed successfully',
      data: updatedDSC
    });

  } catch (error) {
    console.error('❌ Error renewing DSC:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew DSC',
      error: error.message
    });
  }
};

// Get DSCs for renewal page (similar to Factory Quotation grouped)
exports.getAllDSCsGrouped = async (req, res) => {
  try {
    const { page = 1, limit = 10, pageSize } = req.query;
    const actualLimit = parseInt(limit) || parseInt(pageSize) || 10;
    const offset = (page - 1) * actualLimit;

    console.log('📋 Fetching DSCs for renewal...');
    console.log('📋 Page:', page, 'Limit:', actualLimit, 'Offset:', offset);

    // Get DSCs that need renewal (expiring within 3 days only)
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const dscs = await DSC.findAll({
      where: {
        expiry_date: {
          [Op.lte]: threeDaysFromNow // Only expiring within 3 days
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

    console.log(`✅ Found ${dscs.length} DSCs needing renewal`);

    // Apply pagination
    const totalItems = dscs.length;
    const totalPages = Math.ceil(totalItems / actualLimit);
    const paginatedDSCs = dscs.slice(offset, offset + actualLimit);

    res.json({
      success: true,
      data: paginatedDSCs,
      currentPage: parseInt(page),
      pageSize: actualLimit,
      totalPages,
      totalItems
    });

  } catch (error) {
    console.error('❌ Error fetching grouped DSCs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DSCs for renewal',
      error: error.message
    });
  }
};