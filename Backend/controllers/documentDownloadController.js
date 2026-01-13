const path = require('path');
const fs = require('fs');

// Download documents for different systems
exports.downloadDocument = async (req, res) => {
  try {
    const { system, recordId, documentType, filename } = req.params;
    
    console.log('📥 Download request:', { system, recordId, documentType, filename });
    
    if (!system || !recordId || !documentType || !filename) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    // Define upload directories for different systems
    const uploadDirs = {
      'employee-compensation': 'uploads/employee_policies',
      'vehicle-policies': 'uploads/vehicle_policies',
      'health-policies': 'uploads/health_policies',
      'fire-policies': 'uploads/fire_policies',
      'life-policies': 'uploads/life_policies',
      'dsc': 'uploads/dsc',
      'plan-management': 'uploads/plan',
      'stability-management': 'uploads/stability',
      'application-management': 'uploads/application',
      'renewal-status': 'uploads/renewal',
      'labour-inspection': 'uploads/labour_inspection',
      'labour-license': 'uploads/labour_license',
      'factory-quotations': 'uploads/pdfs'
    };

    const uploadDir = uploadDirs[system];
    if (!uploadDir) {
      return res.status(400).json({
        success: false,
        message: 'Invalid system type'
      });
    }

    // For stability-management, files are stored directly in uploads/stability/ directory
    // and filenames are stored in the database record
    let filePath;
    
    if (system === 'stability-management') {
      // Files are stored directly in uploads/stability/ (not in recordId subdirectory)
      filePath = path.join(__dirname, '..', uploadDir, filename);
      
      // Verify the file belongs to this record by checking the database
      try {
        const StabilityManagement = require('../models/stabilityManagementModel');
        const stabilityRecord = await StabilityManagement.findOne({ where: { id: recordId } });
        
        console.log('🔍 Stability record found:', !!stabilityRecord);
        console.log('📋 Record ID:', recordId);
        console.log('📁 Files field:', stabilityRecord?.files);
        
        if (!stabilityRecord) {
          return res.status(404).json({
            success: false,
            message: 'Stability record not found'
          });
        }

        if (!stabilityRecord.files) {
          return res.status(404).json({
            success: false,
            message: 'No files found for this stability record'
          });
        }

        // Parse files from database
        let recordFiles = [];
        try {
          let parsedFiles;
          if (typeof stabilityRecord.files === 'string') {
            console.log('🔧 Parsing JSON string:', stabilityRecord.files);
            parsedFiles = JSON.parse(stabilityRecord.files);
            console.log('✅ JSON parsed successfully:', parsedFiles);
          } else {
            console.log('📄 Files is not a string:', typeof stabilityRecord.files);
            parsedFiles = stabilityRecord.files;
          }
          
          // Ensure it's an array
          if (Array.isArray(parsedFiles)) {
            recordFiles = parsedFiles;
          } else if (parsedFiles && typeof parsedFiles === 'object') {
            // If it's a single object, wrap it in an array
            recordFiles = [parsedFiles];
          } else {
            recordFiles = [];
          }
          
          console.log('📋 Parsed files:', parsedFiles);
          console.log('📋 Final recordFiles:', recordFiles);
          console.log('📊 Is array:', Array.isArray(recordFiles));
          console.log('📏 Array length:', recordFiles.length);
        } catch (e) {
          console.error('❌ Error parsing stability files:', e);
          return res.status(500).json({
            success: false,
            message: 'Error parsing file data'
          });
        }

        // Verify the requested filename exists in this record's files
        console.log('🔍 About to check file existence. recordFiles type:', typeof recordFiles, 'isArray:', Array.isArray(recordFiles));
        
        if (!Array.isArray(recordFiles)) {
          console.error('❌ recordFiles is not an array:', recordFiles);
          return res.status(500).json({
            success: false,
            message: 'Invalid file data format'
          });
        }
        
        const fileExists = recordFiles.some(file => file && file.filename === filename);
        console.log('🔎 File exists in record:', fileExists, 'Looking for:', filename);
        
        if (!fileExists) {
          return res.status(404).json({
            success: false,
            message: `File '${filename}' not found for this record`
          });
        }
      } catch (error) {
        console.error('❌ Error verifying stability file:', error);
        return res.status(500).json({
          success: false,
          message: 'Error verifying file ownership'
        });
      }
    } else {
      // For other systems, try recordId subdirectory first, then direct directory
      filePath = path.join(__dirname, '..', uploadDir, recordId, filename);
      
      // If file doesn't exist in recordId subdirectory, try direct directory
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, '..', uploadDir, filename);
      }
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    
    // Set headers for download
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
      error: error.message
    });
  }
};

// Get list of available documents for a record
exports.getDocumentList = async (req, res) => {
  try {
    const { system, recordId } = req.params;
    
    if (!system || !recordId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    const uploadDirs = {
      'employee-compensation': 'uploads/employee_policies',
      'vehicle-policies': 'uploads/vehicle_policies',
      'health-policies': 'uploads/health_policies',
      'fire-policies': 'uploads/fire_policies',
      'life-policies': 'uploads/life_policies',
      'dsc': 'uploads/dsc',
      'plan-management': 'uploads/plan',
      'stability-management': 'uploads/stability',
      'application-management': 'uploads/application',
      'renewal-status': 'uploads/renewal',
      'labour-inspection': 'uploads/labour_inspection',
      'labour-license': 'uploads/labour_license',
      'factory-quotations': 'uploads/pdfs'
    };

    const uploadDir = uploadDirs[system];
    if (!uploadDir) {
      return res.status(400).json({
        success: false,
        message: 'Invalid system type'
      });
    }

    // For stability-management, get files from database record instead of filesystem
    if (system === 'stability-management') {
      try {
        const StabilityManagement = require('../models/stabilityManagementModel');
        const stabilityRecord = await StabilityManagement.findOne({ where: { id: recordId } });
        
        if (!stabilityRecord) {
          return res.json({
            success: true,
            data: []
          });
        }

        // Parse files from database
        let recordFiles = [];
        if (stabilityRecord.files) {
          try {
            recordFiles = typeof stabilityRecord.files === 'string' 
              ? JSON.parse(stabilityRecord.files) 
              : stabilityRecord.files;
          } catch (e) {
            console.error('Error parsing stability files:', e);
            recordFiles = [];
          }
        }

        // Return files with metadata
        const documents = recordFiles.map(file => ({
          filename: file.filename,
          originalName: file.originalName,
          size: file.size || 0,
          uploadDate: file.uploadedAt || new Date()
        }));

        return res.json({
          success: true,
          data: documents
        });
      } catch (error) {
        console.error('Error fetching stability files from database:', error);
        // Fall through to filesystem method as fallback
      }
    }

    // For other systems, use filesystem approach
    // Try both directory structures
    let recordPath = path.join(__dirname, '..', uploadDir, recordId);
    let files = [];
    
    if (fs.existsSync(recordPath)) {
      // Documents stored in recordId subdirectory
      files = fs.readdirSync(recordPath);
    } else {
      // Documents stored directly in upload directory
      recordPath = path.join(__dirname, '..', uploadDir);
      if (fs.existsSync(recordPath)) {
        files = fs.readdirSync(recordPath);
        // Filter files that might belong to this record (you can customize this logic)
        // For now, we'll return all files in the directory
      }
    }
    
    if (files.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const documents = files.map(filename => ({
      filename,
      size: fs.statSync(path.join(recordPath, filename)).size,
      uploadDate: fs.statSync(path.join(recordPath, filename)).mtime
    }));

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Error getting document list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document list',
      error: error.message
    });
  }
};
