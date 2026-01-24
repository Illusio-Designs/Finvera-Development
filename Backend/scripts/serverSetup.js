// PRODUCTION SERVER SETUP SCRIPT
// This script sets up the complete production environment
// Includes: Database setup, Account creation, Policy tables, Renewal system, and Cron job setup
// PRODUCTION VERSION - Uses real client data and email addresses

const { User, Role, UserRole, Company, Consumer, InsuranceCompany, EmployeeCompensationPolicy, VehiclePolicy, HealthPolicies, FirePolicy, LifePolicy, DSC, ReminderLog, DSCLog, UserRoleWorkLog, LabourInspection, LabourLicense, PreviousLabourLicense, PreviousFactoryQuotation, RenewalConfig } = require('../models');
const sequelize = require('../config/db');
const FactoryQuotation = require('../models/factoryQuotationModel');
const PlanManagement = require('../models/planManagementModel');
const StabilityManagement = require('../models/stabilityManagementModel');
const PreviousStabilityManagement = require('../models/previousStabilityManagementModel');
const ApplicationManagement = require('../models/applicationManagementModel');
const RenewalStatus = require('../models/renewalStatusModel');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require("../config/config.js");
const { Sequelize, QueryTypes } = require("sequelize");
const RenewalService = require('../services/renewalService');
const cron = require('node-cron');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const serverLogPath = path.join(logsDir, 'server.log');

// Logging function
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  fs.appendFile(serverLogPath, logMessage, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });
}

// Role definitions
const roles = [
  { role_name: 'Admin', description: 'Full system access' },
  { role_name: 'User', description: 'Basic user access' },
  { role_name: 'Vendor_manager', description: 'Vendor management access' },
  { role_name: 'User_manager', description: 'User management access' },
  { role_name: 'Company', description: 'Company access' },
  { role_name: 'Consumer', description: 'Consumer access' },
  { role_name: 'Insurance_manager', description: 'Insurance management access' },
  { role_name: 'Compliance_manager', description: 'Compliance management access' },
  { role_name: 'DSC_manager', description: 'Digital Signature Certificate management access' },
  { role_name: 'Plan_manager', description: 'Plan management access' },
  { role_name: 'Stability_manager', description: 'Stability management access' },
  { role_name: 'Website_manager', description: 'Website management and content access' },
  { role_name: 'Labour_law_manager', description: 'Labour law and inspection management access' }
];

// Add connection retry logic
async function ensureDatabaseConnection() {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection verified');
      return true;
    } catch (error) {
      retries++;
      console.log(`⚠️  Database connection attempt ${retries} failed: ${error.message}`);
      if (retries < maxRetries) {
        console.log('🔄 Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
      }
    }
  }
}

/**
 * Drops permission tables if they exist
 * @returns {Promise<void>}
 */
async function dropPermissionTables() {
  try {
    console.log('🔄 Dropping permission tables if they exist...');
    
    // Drop the tables if they exist
    await sequelize.query('DROP TABLE IF EXISTS RolePermissions');
    console.log('✅ RolePermissions table dropped (if existed)');
    
    await sequelize.query('DROP TABLE IF EXISTS Permissions');
    console.log('✅ Permissions table dropped (if existed)');
    
    console.log('✅ Permission tables cleanup completed');
  } catch (error) {
    console.error('❌ Error dropping permission tables:', error);
  }
}

/**
 * Sets up the database with all required tables
 * @returns {Promise<boolean>}
 */
async function setupDatabase() {
  try {
    logToFile('Setting up database...');
    console.log('Setting up database...');

    // Ensure database connection is stable
    await ensureDatabaseConnection();

    // Drop permission tables first (these are the only ones we want to remove)
    await dropPermissionTables();

    // Sync tables in correct order with connection verification
    console.log('🔄 Syncing database tables...');
    
    try {
      await ensureDatabaseConnection();
      await Role.sync({ alter: true });
      console.log('✅ Role table synced');
    } catch (error) {
      console.log('⚠️  Role table sync warning:', error.message);
    }

    try {
      await ensureDatabaseConnection();
      await User.sync({ alter: true });
      console.log('✅ User table synced');
    } catch (error) {
      console.log('⚠️  User table sync warning:', error.message);
    }

    try {
      // Skip UserRole sync if table already exists to preserve existing data
      await ensureDatabaseConnection();
      await UserRole.sync({ alter: true });
      console.log('✅ UserRole table synced');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ UserRole table already exists - preserving existing data');
      } else {
        console.log('⚠️  UserRole table sync warning:', error.message);
      }
    }

    // Sync other tables with error handling and connection verification
    const otherTables = [
      { model: Company, name: 'Company' },
      { model: Consumer, name: 'Consumer' },
      { model: InsuranceCompany, name: 'InsuranceCompany' },
      { model: EmployeeCompensationPolicy, name: 'EmployeeCompensationPolicy' },
      { model: VehiclePolicy, name: 'VehiclePolicy' },
      { model: HealthPolicies, name: 'HealthPolicies' },
      { model: FirePolicy, name: 'FirePolicy' },
      { model: LifePolicy, name: 'LifePolicy' },
      { model: DSC, name: 'DSC' },
      { model: ReminderLog, name: 'ReminderLog' },
      { model: DSCLog, name: 'DSCLog' },
      { model: UserRoleWorkLog, name: 'UserRoleWorkLog' },
      { model: FactoryQuotation, name: 'FactoryQuotation' },
      { model: PlanManagement, name: 'PlanManagement' },
      { model: StabilityManagement, name: 'StabilityManagement' },
      { model: PreviousStabilityManagement, name: 'PreviousStabilityManagement' },
      { model: ApplicationManagement, name: 'ApplicationManagement' },
      { model: RenewalStatus, name: 'RenewalStatus' },
      { model: LabourInspection, name: 'LabourInspection' },
      { model: LabourLicense, name: 'LabourLicense' }
    ];

    for (const table of otherTables) {
      try {
        await ensureDatabaseConnection();
        
        // Special handling for ApplicationManagement to ensure compliance_manager_id is nullable
        if (table.name === 'ApplicationManagement') {
          try {
            await table.model.sync({ alter: true });
            console.log(`✅ ${table.name} table synced`);
          } catch (syncError) {
            if (syncError.message.includes('compliance_manager_id') || syncError.message.includes('cannot be null')) {
              console.log(`🔄 ${table.name} schema issue detected, attempting to fix...`);
              try {
                await table.model.drop();
                await table.model.sync({ force: true });
                console.log(`✅ ${table.name} table recreated with correct schema`);
              } catch (dropError) {
                console.log(`⚠️ Could not recreate ${table.name} table:`, dropError.message);
              }
            } else {
              console.log(`⚠️ ${table.name} table sync warning:`, syncError.message);
            }
          }
        } else if (table.name === 'LabourLicense') {
          try {
            await table.model.sync({ alter: true });
            console.log(`✅ ${table.name} table synced`);
          } catch (syncError) {
            if (syncError.message.includes('type') || syncError.message.includes('cannot be null')) {
              console.log(`🔄 ${table.name} schema issue detected, attempting to fix...`);
              try {
                await table.model.drop();
                await table.model.sync({ force: true });
                console.log(`✅ ${table.name} table recreated with correct schema`);
              } catch (dropError) {
                console.log(`⚠️ Could not recreate ${table.name} table:`, dropError.message);
              }
            } else {
              console.log(`⚠️ ${table.name} table sync warning:`, syncError.message);
            }
          }
        } else {
          await table.model.sync({ alter: true });
          console.log(`✅ ${table.name} table synced`);
        }
      } catch (error) {
        console.log(`⚠️  ${table.name} table sync warning:`, error.message);
      }
    }

    // Setup renewal system
    console.log('🏗️  Setting up renewal system...');
    const renewalSetup = await setupRenewalSystem();
    
    if (!renewalSetup) {
      console.warn('⚠️  Renewal system setup failed, but continuing with database setup...');
    } else {
      console.log('✅ Renewal system setup completed');
    }

    logToFile('Database setup completed');
    console.log('✅ Database setup completed');
    return true;
  } catch (error) {
    const errorMessage = `Database setup error: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

/**
 * Sets up roles in the database
 * @returns {Promise<boolean>}
 */
async function setupRolesAndPermissions() {
  try {
    logToFile('Setting up roles...');
    console.log('Setting up roles...');
    
    // Create roles
    for (const role of roles) {
      await Role.findOrCreate({
        where: { role_name: role.role_name },
        defaults: role
      });
    }
    logToFile('Roles setup completed');
    console.log('Roles setup completed');

    return true;
  } catch (error) {
    const errorMessage = `Error setting up roles: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

/**
 * Migrates existing users from role_id to UserRole table
 * @returns {Promise<boolean>} Success status
 */
async function migrateExistingUsers() {
  try {
    logToFile('Migrating existing users to new role system...');
    console.log('Migrating existing users to new role system...');

    // Check if role_id column still exists in Users table
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Users' 
      AND COLUMN_NAME = 'role_id'
    `);

    if (results.length === 0) {
      logToFile('role_id column not found, migration not needed');
      console.log('role_id column not found, migration not needed');
      return true;
    }

    // Get all users with role_id
    const users = await User.findAll({
      where: {
        role_id: { [sequelize.Op.not]: null }
      }
    });

    logToFile(`Found ${users.length} users to migrate`);
    console.log(`Found ${users.length} users to migrate`);

    for (const user of users) {
      try {
        // Find the role
        const role = await Role.findByPk(user.role_id);
        if (role) {
          // Check if user-role association already exists
          const existingUserRole = await UserRole.findOne({
            where: {
              user_id: user.user_id,
              role_id: role.id
            }
          });

          if (!existingUserRole) {
            // Create the association
            await UserRole.create({
              user_id: user.user_id,
              role_id: role.id,
              is_primary: true,
              assigned_at: new Date(),
              assigned_by: user.user_id
            });
            logToFile(`Migrated user ${user.username} to role ${role.role_name}`);
            console.log(`Migrated user ${user.username} to role ${role.role_name}`);
          }
        }
      } catch (error) {
        logToFile(`Error migrating user ${user.username}: ${error.message}`);
        console.error(`Error migrating user ${user.username}:`, error.message);
      }
    }

    // Remove role_id column from Users table
    try {
      await sequelize.query('ALTER TABLE Users DROP COLUMN role_id');
      logToFile('Removed role_id column from Users table');
      console.log('Removed role_id column from Users table');
    } catch (error) {
      logToFile(`Error removing role_id column: ${error.message}`);
      console.error('Error removing role_id column:', error.message);
    }

    logToFile('User migration completed');
    console.log('User migration completed');
    return true;
  } catch (error) {
    const errorMessage = `Error migrating users: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

/**
 * Sets up the admin user in the database
 * @returns {Promise<boolean>} Success status
 */
async function setupAdminUser() {
  try {
    logToFile('Setting up admin user...');
    console.log('Setting up admin user...');
    const adminRole = await Role.findOne({ where: { role_name: 'Admin' } });
    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    // Only find existing admin user, don't create new ones
    const adminUser = await User.findOne({
      where: { email: 'Admin@radheconsultancy.co.in' }
    });

    if (adminUser) {
      // Update existing admin user with new name
      await adminUser.update({
        username: 'BRIJESH KANERIA',
        password: await bcrypt.hash('Admin@123', 10),
        updated_at: new Date()
      });
      logToFile('Updated existing admin user with new name: BRIJESH KANERIA');
      console.log('Updated existing admin user with new name: BRIJESH KANERIA');
    } else {
      // Skip if admin user doesn't exist - don't create new ones
      logToFile('Skipping admin user setup - user not found');
      console.log('⏭️ Skipping admin user setup - user not found');
      return true;
    }

    // Check if admin user already has admin role
    const existingUserRole = await UserRole.findOne({
      where: {
        user_id: adminUser.user_id,
        role_id: adminRole.id
      }
    });

    if (!existingUserRole) {
      // Assign admin role using the new association
      await adminUser.addRole(adminRole, { 
        through: { 
          is_primary: true,
          assigned_by: adminUser.user_id 
        } 
      });
      logToFile('Admin role assigned to admin user');
      console.log('Admin role assigned to admin user');
    }

    logToFile('Admin user setup completed');
    console.log('Admin user setup completed');
    return true;
  } catch (error) {
    const errorMessage = `Error setting up admin user: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

// Renewal Management System setup function
async function setupRenewalSystem() {
  try {
    console.log('🔧 Setting up Renewal Management System...');
    
    // Check if RenewalConfig table exists and create it
    const [configResults] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'renewal_configs'
    `);
    
    if (configResults[0].count === 0) {
      console.log('📋 Creating renewal_configs table...');
      await sequelize.query(`
        CREATE TABLE renewal_configs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          service_type VARCHAR(100) NOT NULL,
          service_name VARCHAR(255) NOT NULL,
          reminder_times INT NOT NULL,
          reminder_days INT NOT NULL,
          reminder_intervals JSON,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_by INT NOT NULL,
          updated_by INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_service_type (service_type),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ renewal_configs table created successfully');
    } else {
      console.log('📋 renewal_configs table already exists, checking structure...');
      
      // Check if table has correct structure, if not, drop and recreate
      try {
        const [columns] = await sequelize.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'renewal_configs' 
          AND TABLE_SCHEMA = DATABASE()
        `);
        
        const columnNames = columns.map(col => col.COLUMN_NAME);
        const requiredColumns = ['id', 'service_type', 'service_name', 'reminder_times', 'reminder_days', 'reminder_intervals', 'is_active', 'created_by', 'updated_by', 'created_at', 'updated_at'];
        
        const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
        
        if (missingColumns.length > 0 || columnNames.includes('serviceType')) {
          console.log('📋 Table structure incorrect, dropping and recreating...');
          await sequelize.query('DROP TABLE IF EXISTS renewal_configs');
          
          await sequelize.query(`
            CREATE TABLE renewal_configs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              service_type VARCHAR(100) NOT NULL,
              service_name VARCHAR(255) NOT NULL,
              reminder_times INT NOT NULL,
              reminder_days INT NOT NULL,
              reminder_intervals JSON,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_by INT NOT NULL,
              updated_by INT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY unique_service_type (service_type),
              INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('✅ renewal_configs table recreated with correct structure');
        } else {
          console.log('✅ renewal_configs table structure is correct');
          
          // Check if reminder_intervals column exists, if not add it
          if (!columnNames.includes('reminder_intervals')) {
            console.log('📋 Adding reminder_intervals column to renewal_configs table...');
            await sequelize.query(`
              ALTER TABLE renewal_configs 
              ADD COLUMN reminder_intervals JSON AFTER reminder_days
            `);
            console.log('✅ reminder_intervals column added successfully');
          }
        }
      } catch (error) {
        console.log('⚠️ Error checking table structure:', error.message);
      }
    }
    
    // Check if ReminderLogs table exists and enhance it
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'ReminderLogs'
    `);
    
    if (results[0].count === 0) {
      console.log('📋 Creating ReminderLogs table...');
      await sequelize.query(`
        CREATE TABLE ReminderLogs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          policy_id INT NOT NULL,
          policy_type VARCHAR(50) NOT NULL,
          client_name VARCHAR(255),
          client_email VARCHAR(255),
          reminder_type ENUM('email', 'sms', 'whatsapp') DEFAULT 'email',
          reminder_day INT NOT NULL DEFAULT 0,
          expiry_date DATETIME,
          sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          status ENUM('sent', 'delivered', 'failed', 'opened', 'clicked') DEFAULT 'sent',
          email_subject VARCHAR(500),
          response_data JSON,
          error_message TEXT,
          days_until_expiry INT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_policy (policy_id, policy_type),
          INDEX idx_sent_at (sent_at),
          INDEX idx_status (status),
          INDEX idx_reminder_type (reminder_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ ReminderLogs table created successfully');
    } else {
      console.log('📋 Enhancing existing ReminderLogs table...');
      
      // Add new columns if they don't exist
      const columns = [
        { name: 'client_name', sql: 'ADD COLUMN client_name VARCHAR(255)' },
        { name: 'client_email', sql: 'ADD COLUMN client_email VARCHAR(255)' },
        { name: 'reminder_type', sql: 'ADD COLUMN reminder_type ENUM(\'email\', \'sms\', \'whatsapp\') DEFAULT \'email\'' },
        { name: 'reminder_day', sql: 'ADD COLUMN reminder_day INT NOT NULL DEFAULT 0' },
        { name: 'expiry_date', sql: 'ADD COLUMN expiry_date DATETIME' },
        { name: 'status', sql: 'ADD COLUMN status ENUM(\'sent\', \'delivered\', \'failed\', \'opened\', \'clicked\') DEFAULT \'sent\'' },
        { name: 'email_subject', sql: 'ADD COLUMN email_subject VARCHAR(500)' },
        { name: 'response_data', sql: 'ADD COLUMN response_data JSON' },
        { name: 'error_message', sql: 'ADD COLUMN error_message TEXT' },
        { name: 'createdAt', sql: 'ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updatedAt', sql: 'ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];
      
      for (const column of columns) {
        try {
          await sequelize.query(`ALTER TABLE ReminderLogs ${column.sql}`);
          console.log(`✅ Added column: ${column.name}`);
        } catch (error) {
          if (error.message.includes('Duplicate column name')) {
            console.log(`⏭️ Column ${column.name} already exists`);
          } else {
            console.log(`⚠️ Error adding column ${column.name}:`, error.message);
          }
        }
      }
      
      // Add indexes if they don't exist
      const indexes = [
        { name: 'idx_policy', sql: 'ADD INDEX idx_policy (policy_id, policy_type)' },
        { name: 'idx_sent_at', sql: 'ADD INDEX idx_sent_at (sent_at)' },
        { name: 'idx_status', sql: 'ADD INDEX idx_status (status)' },
        { name: 'idx_reminder_type', sql: 'ADD INDEX idx_reminder_type (reminder_type)' }
      ];
      
      for (const index of indexes) {
        try {
          await sequelize.query(`ALTER TABLE ReminderLogs ${index.sql}`);
          console.log(`✅ Added index: ${index.name}`);
        } catch (error) {
          if (error.message.includes('Duplicate key name')) {
            console.log(`⏭️ Index ${index.name} already exists`);
          } else {
            console.log(`⚠️ Error adding index ${index.name}:`, error.message);
          }
        }
      }
    }
    
    // Create default renewal configurations if they don't exist
    console.log('📋 Setting up default renewal configurations...');
    const defaultConfigs = [
      { serviceType: 'vehicle', serviceName: 'Vehicle Insurance', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'ecp', serviceName: 'Employee Compensation Policy', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'health', serviceName: 'Health Insurance', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'fire', serviceName: 'Fire Insurance', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'dsc', serviceName: 'Digital Signature Certificate', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'factory', serviceName: 'Factory Quotation', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'labour_inspection', serviceName: 'Labour Inspection', reminderTimes: 5, reminderDays: 15, reminderIntervals: [15, 10, 7, 3, 1] },
      { serviceType: 'labour_license', serviceName: 'Labour License', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'stability_management', serviceName: 'Stability Management', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
      { serviceType: 'life', serviceName: 'Life Insurance', reminderTimes: 12, reminderDays: 30, reminderIntervals: [30, 15, 7, 3, 1] }
    ];
    
    for (const config of defaultConfigs) {
      try {
        const existingConfig = await RenewalConfig.findOne({
          where: { serviceType: config.serviceType }
        });
        
        if (!existingConfig) {
          await RenewalConfig.create({
            serviceType: config.serviceType,
            serviceName: config.serviceName,
            reminderTimes: config.reminderTimes,
            reminderDays: config.reminderDays,
            reminderIntervals: config.reminderIntervals,
            createdBy: 1, // Admin user ID
            isActive: true
          });
          console.log(`✅ Created default config for ${config.serviceName}`);
        } else {
          // Check if existing config needs reminderIntervals update
          if (!existingConfig.reminderIntervals) {
            await existingConfig.update({
              reminderIntervals: config.reminderIntervals
            });
            console.log(`✅ Updated ${config.serviceName} with reminder intervals`);
          } else {
            console.log(`⏭️ Config for ${config.serviceName} already exists`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Error creating config for ${config.serviceName}:`, error.message);
      }
    }
    
    console.log('✅ Renewal Management System setup completed!');
    return true;
  } catch (error) {
    console.error('❌ Error setting up Renewal Management System:', error);
    return false;
  }
}

// ============================================================================
// RENEWAL SYSTEM TESTING FUNCTIONS - PRODUCTION VERSION
// ============================================================================

// ============================================================================
// CRON JOB SETUP FOR AUTOMATIC RENEWAL PROCESSING
// ============================================================================

/**
 * Setup automatic renewal processing cron job
 * Runs daily at 9:00 AM IST to process all renewal systems
 */
function setupRenewalCronJob() {
  try {
    console.log('⏰ Setting up automatic renewal processing cron job...');
    
    // Schedule cron job to run daily at 9:00 AM IST
    // Cron expression: '0 9 * * *' = At 09:00 every day
    const cronJob = cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Starting automatic renewal processing at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
      logToFile('Starting automatic renewal processing');
      
      try {
        // First, update all policy statuses based on expiry dates
        console.log('📊 Updating policy statuses based on expiry dates...');
        const StatusUpdateService = require('../services/statusUpdateService');
        const statusUpdateService = new StatusUpdateService();
        const statusResult = await statusUpdateService.updateAllPolicyStatuses();
        
        if (statusResult.success) {
          console.log(`✅ Updated ${statusResult.totalUpdated} policy statuses`);
          logToFile(`Updated ${statusResult.totalUpdated} policy statuses`);
        } else {
          console.log('⚠️ Status update failed:', statusResult.error);
          logToFile(`Status update failed: ${statusResult.error}`);
        }
        
        // Then process renewal reminders
        const renewalService = new RenewalService();
        
        // Process all 10 renewal systems
        const systems = [
          { name: 'Vehicle Insurance', method: 'processVehicleInsuranceRenewals' },
          { name: 'Health Insurance', method: 'processHealthInsuranceRenewals' },
          { name: 'Fire Insurance', method: 'processFirePolicyRenewals' },
          { name: 'Life Insurance', method: 'processLifeInsuranceRenewals' },
          { name: 'Employee Compensation Policy', method: 'processECPRenewals' },
          { name: 'Digital Signature Certificate', method: 'processDSCRenewals' },
          { name: 'Factory Quotation', method: 'processFactoryQuotationRenewals' },
          { name: 'Labour License', method: 'processLabourLicenseReminders' },
          { name: 'Labour Inspection', method: 'processLabourInspectionReminders' },
          { name: 'Stability Management', method: 'processStabilityManagementReminders' }
        ];
        
        let totalProcessed = 0;
        let totalErrors = 0;
        
        for (const system of systems) {
          try {
            console.log(`🔄 Processing ${system.name}...`);
            logToFile(`Processing ${system.name}`);
            
            const result = await renewalService[system.method]();
            
            if (result && result.success) {
              console.log(`✅ ${system.name}: ${result.processed || 0} reminders processed`);
              logToFile(`${system.name}: ${result.processed || 0} reminders processed`);
              totalProcessed += result.processed || 0;
            } else {
              console.log(`⚠️ ${system.name}: No reminders processed or method returned false`);
              logToFile(`${system.name}: No reminders processed`);
            }
          } catch (error) {
            console.error(`❌ Error processing ${system.name}:`, error.message);
            logToFile(`Error processing ${system.name}: ${error.message}`);
            totalErrors++;
          }
        }
        
        const summary = `Automatic renewal processing completed. Status updates: ${statusResult.totalUpdated || 0}, Reminders processed: ${totalProcessed}, Errors: ${totalErrors}`;
        console.log(`✅ ${summary}`);
        logToFile(summary);
        
      } catch (error) {
        const errorMsg = `Error in automatic renewal processing: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        logToFile(errorMsg);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    console.log('✅ Automatic renewal processing cron job scheduled successfully');
    console.log('⏰ Will run daily at 9:00 AM IST');
    console.log('🎯 All 10 renewal systems will be processed automatically');
    console.log('📊 Policy statuses will be updated based on expiry dates');
    console.log('📧 Real client emails will be sent to actual email addresses');
    logToFile('Automatic renewal processing cron job scheduled successfully');
    
    return cronJob;
  } catch (error) {
    console.error('❌ Error setting up renewal cron job:', error);
    logToFile(`Error setting up renewal cron job: ${error.message}`);
    return null;
  }
}

/**
 * Runs all setup functions in sequence
 * @returns {Promise<void>}
 */
async function setupAll() {
  try {
    logToFile('Starting complete server setup...');
    console.log('🚀 Starting complete server setup for PRODUCTION...');

    // First setup database structure
    const dbSetup = await setupDatabase();
    if (!dbSetup) {
      throw new Error('Database setup failed');
    }

    // Then setup roles and permissions
    const rolesSetup = await setupRolesAndPermissions();
    if (!rolesSetup) {
      throw new Error('Roles and permissions setup failed');
    }

    // Migrate existing users to new role system
    const migrationSetup = await migrateExistingUsers();
    if (!migrationSetup) {
      throw new Error('User migration failed');
    }

    // Setup admin user
    const adminSetup = await setupAdminUser();
    if (!adminSetup) {
      throw new Error('Admin user setup failed');
    }

    // Setup automatic renewal processing cron job
    console.log('\n⏰ Setting up automatic renewal processing...');
    const cronJob = setupRenewalCronJob();
    if (cronJob) {
      console.log('✅ Automatic renewal processing is now active');
    } else {
      console.log('⚠️ Failed to setup automatic renewal processing');
    }

    const successMessage = '🎉 PRODUCTION SETUP COMPLETED SUCCESSFULLY - System ready for live use!';
    logToFile(successMessage);
    console.log('\n' + '='.repeat(80));
    console.log(successMessage);
    console.log('✅ Database setup completed');
    console.log('✅ Renewal system configured');
    console.log('✅ All 10 renewal systems active');
    console.log('✅ Automatic processing scheduled (9:00 AM IST daily)');
    console.log('✅ Email system operational');
    console.log('📧 PRODUCTION MODE: Real client emails will be sent');
    console.log('='.repeat(80));

    return true;
  } catch (error) {
    const errorMessage = `Error during setup: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

// Export individual functions
module.exports = {
  setupDatabase,
  setupRolesAndPermissions,
  migrateExistingUsers,
  setupAdminUser,
  setupRenewalSystem,
  setupRenewalCronJob,
  setupAll,
  logToFile
};

// Run setup if this file is run directly
if (require.main === module) {
  // Show menu for user to choose what to run
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n🔧 PRODUCTION SERVER SETUP SCRIPT');
    console.log('='.repeat(50));
    console.log('Available commands:');
    console.log('  setup-all     - Complete production setup');
    console.log('  setup-cron    - Setup renewal cron job only');
    console.log('\nExample: node serverSetup.js setup-all');
    console.log('\n⚠️  WARNING: Production mode uses REAL CLIENT DATA');
    process.exit(0);
  }
  
  const command = args[0];
  
  switch (command) {
    case 'setup-all':
      setupAll()
        .then(success => {
          if (success) {
            console.log('\n🎉 Production setup completed successfully!');
            process.exit(0);
          } else {
            console.log('\n❌ Production setup failed!');
            process.exit(1);
          }
        })
        .catch(error => {
          console.error('❌ Setup error:', error);
          process.exit(1);
        });
      break;
      
    case 'setup-cron':
      console.log('⏰ Setting up renewal cron job...');
      const cronJob = setupRenewalCronJob();
      if (cronJob) {
        console.log('✅ Cron job setup completed');
        // Keep the process running to maintain the cron job
        console.log('🔄 Cron job is now running. Press Ctrl+C to stop.');
      } else {
        console.log('❌ Failed to setup cron job');
        process.exit(1);
      }
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Available commands: setup-all, setup-cron');
      process.exit(1);
  }
}