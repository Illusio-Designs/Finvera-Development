// CONSOLIDATED SERVER SETUP SCRIPT
// This script combines all individual setup scripts into one main file
// Includes: Database setup, Account creation, Policy tables, Renewal system, and all other setup functions

const { User, Role, UserRole, Company, Consumer, InsuranceCompany, EmployeeCompensationPolicy, VehiclePolicy, HealthPolicies, FirePolicy, LifePolicy, DSC, ReminderLog, DSCLog, UserRoleWorkLog, LabourInspection, LabourLicense, RenewalConfig } = require('../models');
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

// Handle LifePolicy table setup
async function setupLifePolicyTable(sequelize) {
  try {
    // Drop existing indexes
    await sequelize.query(`
      ALTER TABLE LifePolicies
      DROP INDEX idx_policy_number,
      DROP INDEX idx_insurance_company,
      DROP INDEX idx_company,
      DROP INDEX idx_consumer,
      DROP INDEX idx_policy_dates;
    `).catch(err => {
      // Ignore errors if indexes don't exist
      console.log('Note: Some indexes may not exist, continuing...');
    });

    // Drop foreign keys
    await sequelize.query(`
      ALTER TABLE LifePolicies
      DROP FOREIGN KEY fk_insurance_company,
      DROP FOREIGN KEY fk_company,
      DROP FOREIGN KEY fk_consumer;
    `).catch(err => {
      // Ignore errors if foreign keys don't exist
      console.log('Note: Some foreign keys may not exist, continuing...');
    });

    // Add new constraints and indexes
    await sequelize.query(`
      ALTER TABLE LifePolicies
      ADD CONSTRAINT fk_insurance_company
      FOREIGN KEY (insurance_company_id)
      REFERENCES InsuranceCompanies(id)
      ON DELETE NO ACTION
      ON UPDATE CASCADE,
      ADD CONSTRAINT fk_company
      FOREIGN KEY (company_id)
      REFERENCES Companies(company_id)
      ON DELETE NO ACTION
      ON UPDATE CASCADE,
      ADD CONSTRAINT fk_consumer
      FOREIGN KEY (consumer_id)
      REFERENCES Consumers(consumer_id)
      ON DELETE NO ACTION
      ON UPDATE CASCADE;
    `).catch(err => {
      console.log('Note: Some constraints may already exist, continuing...');
    });

    // Add indexes
    await sequelize.query(`
      ALTER TABLE LifePolicies
      ADD UNIQUE INDEX idx_policy_number (current_policy_number),
      ADD INDEX idx_policy_dates (policy_start_date, issue_date);
    `).catch(err => {
      console.log('Note: Some indexes may already exist, continuing...');
    });

    console.log('LifePolicy table synced with constraints and indexes');
  } catch (error) {
    console.error('Error setting up LifePolicy table:', error);
    throw error;
  }
}

async function setupConsumerTable(sequelize) {
  try {
    // Drop existing indexes
    await sequelize.query(`
      ALTER TABLE Consumers
      DROP INDEX email,
      DROP INDEX user_id;
    `).catch(err => {
      // Ignore errors if indexes don't exist
      console.log('Note: Some indexes may not exist, continuing...');
    });

    // Drop foreign key
    await sequelize.query(`
      ALTER TABLE Consumers
      DROP FOREIGN KEY consumers_ibfk_1;
    `).catch(err => {
      // Ignore errors if foreign key doesn't exist
      console.log('Note: Foreign key may not exist, continuing...');
    });

    // Add new foreign key and index
    await sequelize.query(`
      ALTER TABLE Consumers
      ADD CONSTRAINT fk_consumer_user
      FOREIGN KEY (user_id)
      REFERENCES Users(user_id)
      ON DELETE CASCADE
      ON UPDATE CASCADE,
      ADD UNIQUE INDEX idx_consumer_email (email);
    `).catch(err => {
      console.log('Note: Some constraints may already exist, continuing...');
    });

    console.log('Consumer table synced with constraints and indexes');
  } catch (error) {
    console.error('Error setting up Consumer table:', error);
    throw error;
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

    // Setup policy tables and renewal system
    console.log('🏗️  Setting up policy tables and renewal system...');
    const policyTablesSetup = await setupPolicyTables();
    
    if (!policyTablesSetup) {
      console.warn('⚠️  Policy tables setup failed, but continuing with database setup...');
    } else {
      console.log('✅ Policy tables and renewal system setup completed');
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

/**
 * Sets up plan manager users
 * @returns {Promise<boolean>} Success status
 */
async function setupPlanManagers() {
  try {
    logToFile('Setting up plan managers...');
    console.log('Setting up plan managers...');
    
    const planManagerRole = await Role.findOne({ where: { role_name: 'Plan_manager' } });
    if (!planManagerRole) {
      throw new Error('Plan_manager role not found');
    }

    // REMOVED: Test accounts no longer created
    const planManagers = [];

    for (const manager of planManagers) {
      try {
        // Only find existing users by username, don't create new ones
        const user = await User.findOne({
          where: { username: manager.username }
        });

        if (user) {
          // Update existing user with new email and password
          await user.update({
            email: manager.email,
            password: await bcrypt.hash(manager.password, 10),
            updated_at: new Date()
          });
          logToFile(`Updated existing plan manager: ${manager.username} with new email: ${manager.email}`);
          console.log(`Updated existing plan manager: ${manager.username} with new email: ${manager.email}`);
        } else {
          // Skip if user doesn't exist - don't create new ones
          logToFile(`Skipping plan manager ${manager.username} - user not found`);
          console.log(`⏭️ Skipping plan manager ${manager.username} - user not found`);
          continue;
        }

        // Check if user already has plan manager role
        const existingUserRole = await UserRole.findOne({
          where: {
            user_id: user.user_id,
            role_id: planManagerRole.id
          }
        });

        if (!existingUserRole) {
          // Assign plan manager role
          await user.addRole(planManagerRole, { 
            through: { 
              is_primary: true,
              assigned_by: 1 // Admin user ID
            } 
          });
          logToFile(`Plan manager role assigned to ${manager.username}`);
          console.log(`Plan manager role assigned to ${manager.username}`);
        } else {
          logToFile(`Plan manager role already assigned to ${manager.username}`);
          console.log(`Plan manager role already assigned to ${manager.username}`);
        }
      } catch (userError) {
        logToFile(`Error setting up plan manager ${manager.username}: ${userError.message}`);
        console.error(`Error setting up plan manager ${manager.username}:`, userError);
        // Continue with other managers
      }
    }

    logToFile('Plan managers setup completed');
    console.log('Plan managers setup completed');
    return true;
  } catch (error) {
    const errorMessage = `Error setting up plan managers: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}



/**
 * Sets up stability manager users
 * @returns {Promise<boolean>} Success status
 */
async function setupStabilityManagers() {
  try {
    logToFile('Setting up stability managers...');
    console.log('Setting up stability managers...');
    
    const stabilityManagerRole = await Role.findOne({ where: { role_name: 'Stability_manager' } });
    if (!stabilityManagerRole) {
      throw new Error('Stability_manager role not found');
    }

    // REMOVED: Test accounts no longer created
    const stabilityManagers = [];

    for (const manager of stabilityManagers) {
      try {
        // Only find existing users by username, don't create new ones
        const user = await User.findOne({
          where: { username: manager.username }
        });

        if (user) {
          // Update existing user with new email and password
          await user.update({
            email: manager.email,
            password: await bcrypt.hash(manager.password, 10),
            updated_at: new Date()
          });
          logToFile(`Updated existing stability manager: ${manager.username} with new email: ${manager.email}`);
          console.log(`Updated existing stability manager: ${manager.username} with new email: ${manager.email}`);
        } else {
          // Skip if user doesn't exist - don't create new ones
          logToFile(`Skipping stability manager ${manager.username} - user not found`);
          console.log(`⏭️ Skipping stability manager ${manager.username} - user not found`);
          continue;
        }

        // Check if user already has stability manager role
        const existingUserRole = await UserRole.findOne({
          where: {
            user_id: user.user_id,
            role_id: stabilityManagerRole.id
          }
        });

        if (!existingUserRole) {
          // Assign stability manager role
          await user.addRole(stabilityManagerRole, { 
            through: { 
              is_primary: true,
              assigned_by: 1 // Admin user ID
            } 
          });
          logToFile(`Stability manager role assigned to ${manager.username}`);
          console.log(`Stability manager role assigned to ${manager.username}`);
        } else {
          logToFile(`Stability manager role already assigned to ${manager.username}`);
          console.log(`Stability manager role already assigned to ${manager.username}`);
        }
      } catch (userError) {
        logToFile(`Error setting up stability manager ${manager.username}: ${userError.message}`);
        console.error(`Error setting up stability manager ${manager.username}:`, userError);
        // Continue with other managers
      }
    }

    logToFile('Stability managers setup completed');
    console.log('Stability managers setup completed');
    return true;
  } catch (error) {
    const errorMessage = `Error setting up stability managers: ${error.message}`;
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
      { serviceType: 'stability', serviceName: 'Stability Management', reminderTimes: 3, reminderDays: 30, reminderIntervals: [30, 21, 14, 7, 1] },
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
  } catch (error) {
    console.error('❌ Error setting up Renewal Management System:', error);
  }
}

// Ensure ApplicationManagement schema is properly synced
async function ensureApplicationManagementSchema() {
  try {
    console.log('📋 Ensuring ApplicationManagement schema is correct...');
    
    // Force sync the ApplicationManagement model to ensure schema matches
    try {
      await ensureDatabaseConnection();
      await ApplicationManagement.sync({ alter: true, force: false });
      console.log('✅ ApplicationManagement schema synced successfully');
    } catch (error) {
      console.log('⚠️ ApplicationManagement sync warning:', error.message);
      
      // If alter fails, try to drop and recreate the table (only if it's safe)
      if (error.message.includes('compliance_manager_id') || error.message.includes('cannot be null')) {
        console.log('🔄 Attempting to fix ApplicationManagement schema...');
        try {
          // Drop the table and recreate it with correct schema
          await ApplicationManagement.drop();
          await ApplicationManagement.sync({ force: true });
          console.log('✅ ApplicationManagement table recreated with correct schema');
        } catch (dropError) {
          console.log('⚠️ Could not recreate table:', dropError.message);
        }
      }
    }
    
    console.log('✅ ApplicationManagement schema verification completed!');
  } catch (error) {
    console.error('❌ Error ensuring ApplicationManagement schema:', error);
  }
}

// Ensure RenewalStatus schema is properly synced
async function ensureRenewalStatusSchema() {
  try {
    console.log('📋 Ensuring RenewalStatus schema is correct...');
    
    // Force sync the RenewalStatus model to ensure schema matches
    try {
      await ensureDatabaseConnection();
      await RenewalStatus.sync({ alter: true, force: false });
      console.log('✅ RenewalStatus schema synced successfully');
    } catch (error) {
      console.log('⚠️ RenewalStatus sync warning:', error.message);
      
      // If alter fails, try to drop and recreate the table (only if it's safe)
      if (error.message.includes('created_by') || error.message.includes('cannot be null')) {
        console.log('🔄 Attempting to fix RenewalStatus schema...');
        try {
          // Drop the table and recreate it with correct schema
          await RenewalStatus.drop();
          await RenewalStatus.sync({ force: true });
          console.log('✅ RenewalStatus table recreated with correct schema');
        } catch (dropError) {
          console.log('⚠️ Could not recreate table:', dropError.message);
        }
      }
    }
    
    console.log('✅ RenewalStatus schema verification completed!');
  } catch (error) {
    console.error('❌ Error ensuring RenewalStatus schema:', error);
  }
}

// Verify that all required roles exist
async function verifyRequiredRoles() {
  try {
    logToFile('Verifying required roles exist...');
    console.log('Verifying required roles exist...');
    
    const requiredRoles = [
      'Admin',
      'Plan_manager', 
      'Stability_manager',
      'Website_manager',
      'Labour_law_manager'
    ];
    
    const missingRoles = [];
    
    for (const roleName of requiredRoles) {
      const role = await Role.findOne({ where: { role_name: roleName } });
      if (!role) {
        missingRoles.push(roleName);
        logToFile(`Missing role: ${roleName}`);
        console.log(`Missing role: ${roleName}`);
      } else {
        logToFile(`Role found: ${roleName} (ID: ${role.id})`);
        console.log(`Role found: ${roleName} (ID: ${role.id})`);
      }
    }
    
    if (missingRoles.length > 0) {
      throw new Error(`Missing required roles: ${missingRoles.join(', ')}`);
    }
    
    logToFile('All required roles verified successfully');
    console.log('All required roles verified successfully');
    return true;
  } catch (error) {
    const errorMessage = `Error verifying roles: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

/**
 * Runs all setup functions in sequence
 * @returns {Promise<void>}
 */
async function setupAll() {
  try {
    logToFile('Starting complete server setup...');
    console.log('Starting complete server setup...');

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

    // Verify that all required roles exist
    const rolesVerified = await verifyRequiredRoles();
    if (!rolesVerified) {
      throw new Error('Required roles verification failed');
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

    // Setup plan managers
    const planManagersSetup = await setupPlanManagers();
    if (!planManagersSetup) {
      throw new Error('Plan managers setup failed');
    }

    // Ensure ApplicationManagement schema is correct
    await ensureApplicationManagementSchema();
    
    // Ensure RenewalStatus schema is correct
    await ensureRenewalStatusSchema();



    // Setup stability managers
    const stabilityManagersSetup = await setupStabilityManagers();
    if (!stabilityManagersSetup) {
      throw new Error('Stability managers setup failed');
    }



    // Add this section for Renewal Management System setup
    await setupRenewalSystem();



    const successMessage = 'All setup completed successfully';
    logToFile(successMessage);
    console.log(successMessage);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    const errorMessage = `Error during setup: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    await sequelize.close();
    process.exit(1);
  }
}

// ============================================================================
// CONSOLIDATED FUNCTIONS FROM ALL SCRIPTS
// ============================================================================

// ===== LOGIN AND AUTHENTICATION SETUP FUNCTIONS =====

// Setup authentication system
async function setupAuthenticationSystem() {
  try {
    console.log('🔐 Setting up authentication system...');
    
    // Check if UserType table exists
    const [userTypeTableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserTypes'`,
      { type: QueryTypes.SELECT }
    );

    if (userTypeTableExists.count === 0) {
      console.log('📝 Creating UserTypes table...');
      await sequelize.query(`
        CREATE TABLE UserTypes (
          user_type_id INT AUTO_INCREMENT PRIMARY KEY,
          type_name VARCHAR(50) NOT NULL UNIQUE,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_type_name (type_name),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ UserTypes table created successfully');
    } else {
      console.log('ℹ️  UserTypes table already exists');
    }

    // Create default user types
    const defaultUserTypes = [
      { type_name: 'Office', description: 'Office staff and employees' },
      { type_name: 'Company', description: 'Company/Organization users' },
      { type_name: 'Consumer', description: 'Individual consumers' },
      { type_name: 'Vendor', description: 'Vendor/Supplier users' }
    ];

    for (const userType of defaultUserTypes) {
      try {
        await sequelize.query(
          `INSERT IGNORE INTO UserTypes (type_name, description) VALUES (?, ?)`,
          {
            replacements: [userType.type_name, userType.description],
            type: QueryTypes.INSERT
          }
        );
        console.log(`✅ UserType '${userType.type_name}' ensured`);
      } catch (error) {
        console.log(`⚠️ UserType '${userType.type_name}' may already exist:`, error.message);
      }
    }

    // Check if user_type_id column exists in Users table
    const [userTypeColumnExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'user_type_id'`,
      { type: QueryTypes.SELECT }
    );

    if (userTypeColumnExists.count === 0) {
      console.log('📝 Adding user_type_id column to Users table...');
      await sequelize.query(`
        ALTER TABLE Users 
        ADD COLUMN user_type_id INT NULL,
        ADD COLUMN google_id VARCHAR(255) NULL,
        ADD COLUMN profile_image VARCHAR(500) NULL,
        ADD INDEX idx_user_type_id (user_type_id),
        ADD INDEX idx_google_id (google_id)
      `);
      console.log('✅ Authentication columns added to Users table');
    } else {
      console.log('ℹ️  Authentication columns already exist in Users table');
    }

    // Set default user_type_id for existing users without one
    const [officeUserType] = await sequelize.query(
      `SELECT user_type_id FROM UserTypes WHERE type_name = 'Office'`,
      { type: QueryTypes.SELECT }
    );

    if (officeUserType) {
      await sequelize.query(
        `UPDATE Users SET user_type_id = ? WHERE user_type_id IS NULL`,
        {
          replacements: [officeUserType.user_type_id],
          type: QueryTypes.UPDATE
        }
      );
      console.log('✅ Default user type assigned to existing users');
    }

    console.log('✅ Authentication system setup completed');
    return true;
  } catch (error) {
    console.error('❌ Error setting up authentication system:', error);
    return false;
  }
}

// ===== ACCOUNT CHECKING AND CREATION FUNCTIONS =====

// Check existing accounts
async function checkExistingAccounts() {
  try {
    console.log('🔍 Checking existing accounts in database...\n');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Get all users
    const users = await User.findAll({
      include: [{
        model: Role,
        as: 'roles',
        attributes: ['id', 'role_name'],
        through: { attributes: ['is_primary'] }
      }],
      order: [['created_at', 'ASC']]
    });
    
    console.log(`📊 Found ${users.length} users in database:\n`);
    console.log('='.repeat(80));
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Updated: ${user.updated_at}`);
        
        if (user.roles && user.roles.length > 0) {
          console.log(`   Roles: ${user.roles.map(role => 
            `${role.role_name}${role.UserRole.is_primary ? ' (Primary)' : ''}`
          ).join(', ')}`);
        } else {
          console.log(`   Roles: None assigned`);
        }
        console.log('');
      });
    }
    
    // Check specific required accounts
    console.log('🎯 Checking for required accounts:\n');
    console.log('='.repeat(80));
    
    const requiredAccounts = [
      { name: 'Admin', email: 'Admin@radheconsultancy.co.in', role: 'Admin' },
    ];
    
    for (const account of requiredAccounts) {
      const user = await User.findOne({ 
        where: { email: account.email },
        include: [{
          model: Role,
          as: 'roles',
          attributes: ['role_name']
        }]
      });
      
      if (user) {
        const hasRole = user.roles.some(role => role.role_name === account.role);
        if (hasRole) {
          console.log(`✅ ${account.name} (${account.email}) - ${account.role} role assigned`);
        } else {
          console.log(`⚠️  ${account.name} (${account.email}) - EXISTS but NO ${account.role} role`);
        }
      } else {
        console.log(`❌ ${account.name} (${account.email}) - MISSING`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 Account verification completed!');
    
    return true;
  } catch (error) {
    console.error('❌ Error checking accounts:', error.message);
    return false;
  }
}

// Account definitions
const requiredAccounts = {
  admin: {
    username: 'BRIJESH KANERIA',
    email: 'Admin@radheconsultancy.co.in',
    password: 'Admin@123',
    role: 'Admin'
  },
  planManagers: [],
  stabilityManagers: [],
  websiteManagers: [
    {
      username: 'Website Manager',
      email: 'website@radheconsultancy.co.in',
      password: 'Website@123',
      role: 'Website_manager'
    }
  ],
  labourLawManagers: [
    {
      username: 'Labour Law Manager',
      email: 'labour@radheconsultancy.co.in',
      password: 'Labour@123',
      role: 'Labour_law_manager'
    }
  ]
};

// Check if account exists
async function checkAccount(email) {
  try {
    const user = await User.findOne({ where: { email } });
    if (user) {
      return { exists: true, user, needsUpdate: false };
    }
    return { exists: false, user: null, needsUpdate: false };
  } catch (error) {
    console.error(`Error checking account ${email}:`, error.message);
    return { exists: false, user: null, needsUpdate: false };
  }
}

// Create or update account
async function createOrUpdateAccount(accountData) {
  try {
    const { username, email, password, role } = accountData;
    
    // Check if account exists
    const { exists, user } = await checkAccount(email);
    
    if (exists) {
      // Account exists, don't update - just return success
      logToFile(`ℹ️  Account already exists: ${username} (${email}) - skipping update`);
      console.log(`ℹ️  Account already exists: ${username} (${email}) - skipping update`);
      
      return { success: true, action: 'exists', user };
    } else {
      // Create new account only if it doesn't exist
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await User.create({
        username,
        email,
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      logToFile(`✅ Created new account: ${username} (${email})`);
      console.log(`✅ Created new account: ${username} (${email})`);
      
      return { success: true, action: 'created', user: newUser };
    }
  } catch (error) {
    const errorMessage = `❌ Error creating account ${accountData.username}: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return { success: false, action: 'error', error: error.message };
  }
}

// Assign role to user
async function assignRoleToUser(user, roleName) {
  try {
    // Find the role
    const role = await Role.findOne({ where: { role_name: roleName } });
    if (!role) {
      throw new Error(`Role '${roleName}' not found`);
    }
    
    // Check if user already has this role
    const existingUserRole = await UserRole.findOne({
      where: {
        user_id: user.user_id,
        role_id: role.id
      }
    });
    
    if (!existingUserRole) {
      // Assign role
      await user.addRole(role, { 
        through: { 
          is_primary: true,
          assigned_by: 1 // Admin user ID
        } 
      });
      
      logToFile(`✅ Role '${roleName}' assigned to ${user.username}`);
      console.log(`✅ Role '${roleName}' assigned to ${user.username}`);
      return true;
    } else {
      logToFile(`ℹ️  Role '${roleName}' already assigned to ${user.username}`);
      console.log(`ℹ️  Role '${roleName}' already assigned to ${user.username}`);
      return true;
    }
  } catch (error) {
    const errorMessage = `❌ Error assigning role '${roleName}' to ${user.username}: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

// Main function to create all accounts
async function createAllAccounts() {
  try {
    logToFile('🚀 Starting account creation process...');
    console.log('🚀 Starting account creation process...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Process admin account
    console.log('\n📋 Processing Admin Account...');
    const adminResult = await createOrUpdateAccount(requiredAccounts.admin);
    if (adminResult.success) {
      if (adminResult.action === 'created') {
        await assignRoleToUser(adminResult.user, 'Admin');
      } else if (adminResult.action === 'exists') {
        console.log(`ℹ️  Admin account already exists, checking role assignment...`);
        const existingRole = await UserRole.findOne({
          where: { user_id: adminResult.user.user_id }
        });
        if (existingRole) {
          console.log(`ℹ️  Admin role already assigned to ${adminResult.user.username}`);
        } else {
          await assignRoleToUser(adminResult.user, 'Admin');
        }
      }
    }

    // Process website managers
    console.log('\n📋 Processing Website Managers...');
    for (const manager of requiredAccounts.websiteManagers) {
      const result = await createOrUpdateAccount(manager);
      if (result.success) {
        if (result.action === 'created') {
          await assignRoleToUser(result.user, 'Website_manager');
        } else if (result.action === 'exists') {
          console.log(`ℹ️  Website manager account already exists, checking role assignment...`);
          const existingRole = await UserRole.findOne({
            where: { user_id: result.user.user_id }
          });
          if (existingRole) {
            console.log(`ℹ️  Website_manager role already assigned to ${result.user.username}`);
          } else {
            await assignRoleToUser(result.user, 'Website_manager');
          }
        }
      }
    }

    // Process labour law managers
    console.log('\n📋 Processing Labour Law Managers...');
    for (const manager of requiredAccounts.labourLawManagers) {
      const result = await createOrUpdateAccount(manager);
      if (result.success) {
        if (result.action === 'created') {
          await assignRoleToUser(result.user, 'Labour_law_manager');
        } else if (result.action === 'exists') {
          console.log(`ℹ️  Labour law manager account already exists, checking role assignment...`);
          const existingRole = await UserRole.findOne({
            where: { user_id: result.user.user_id }
          });
          if (existingRole) {
            console.log(`ℹ️  Labour_law_manager role already assigned to ${result.user.username}`);
          } else {
            await assignRoleToUser(result.user, 'Labour_law_manager');
          }
        }
      }
    }
    
    // Display summary
    console.log('\n📊 Account Summary:');
    console.log('================================');
    
    const allAccounts = [
      requiredAccounts.admin,
      ...requiredAccounts.planManagers,
      ...requiredAccounts.stabilityManagers,
      ...requiredAccounts.websiteManagers,
      ...requiredAccounts.labourLawManagers
    ];
    
    for (const account of allAccounts) {
      const { exists, user } = await checkAccount(account.email);
      if (exists) {
        console.log(`✅ ${account.username} (${account.email}) - ${account.role} - Account exists`);
      } else {
        console.log(`❌ ${account.username} (${account.email}) - ${account.role} - Account missing`);
      }
    }
    
    console.log('\n💡 Note: Existing accounts are preserved and not updated');
    console.log('   Only missing accounts will be created');
    
    logToFile('🎉 Account creation process completed successfully');
    console.log('\n🎉 Account creation process completed successfully!');
    
    return true;
  } catch (error) {
    const errorMessage = `❌ Account creation failed: ${error.message}`;
    logToFile(errorMessage);
    console.error(errorMessage);
    return false;
  }
}

// ===== POLICY TABLE CREATION FUNCTIONS =====

// Create Previous Employee Compensation Table
async function createPreviousEmployeeCompensationTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousEmployeeCompensationPolicies table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PreviousEmployeeCompensationPolicies'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating PreviousEmployeeCompensationPolicies table...");
      await sequelize.query(`
        CREATE TABLE PreviousEmployeeCompensationPolicies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_policy_id INT NULL COMMENT 'Reference to the original policy ID before it was moved to previous',
          business_type ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement') NOT NULL,
          customer_type ENUM('Organisation', 'Individual') NOT NULL,
          insurance_company_id INT NOT NULL,
          company_id INT NOT NULL,
          policy_number VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile_number VARCHAR(255) NOT NULL,
          policy_start_date DATE NOT NULL,
          policy_end_date DATE NOT NULL,
          medical_cover ENUM('25k', '50k', '1 lac', '2 lac', '3 lac', '5 lac', 'actual') NOT NULL,
          gst_number VARCHAR(255) NULL,
          pan_number VARCHAR(255) NULL,
          net_premium DECIMAL(10, 2) NOT NULL,
          gst DECIMAL(10, 2) NOT NULL,
          gross_premium DECIMAL(10, 2) NOT NULL,
          policy_document_path VARCHAR(255) NOT NULL,
          remarks TEXT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'expired' COMMENT 'Status when the policy was moved to previous (usually expired)',
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this policy was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_company_id (company_id),
          INDEX idx_insurance_company_id (insurance_company_id),
          INDEX idx_policy_end_date (policy_end_date),
          INDEX idx_original_policy_id (original_policy_id),
          INDEX idx_renewed_at (renewed_at),
          FOREIGN KEY (insurance_company_id) REFERENCES InsuranceCompanies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ PreviousEmployeeCompensationPolicies table created successfully");
    } else {
      console.log("ℹ️  PreviousEmployeeCompensationPolicies table already exists");
    }

    const [previousPolicyIdExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EmployeeCompensationPolicies' AND COLUMN_NAME = 'previous_policy_id'`,
      { type: QueryTypes.SELECT }
    );

    if (previousPolicyIdExists.count === 0) {
      console.log("📝 Adding previous_policy_id column to EmployeeCompensationPolicies...");
      await sequelize.query(`
        ALTER TABLE EmployeeCompensationPolicies 
        ADD COLUMN previous_policy_id INT NULL COMMENT 'Reference to the previous policy ID that was renewed (if this is a renewal)',
        ADD INDEX idx_previous_policy_id (previous_policy_id)
      `);
      console.log("✅ previous_policy_id column added successfully");
    } else {
      console.log("ℹ️  previous_policy_id column already exists");
    }

    console.log("✅ PreviousEmployeeCompensationPolicies table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousEmployeeCompensationPolicies table:", error);
    throw error;
  }
}

// Create Previous Vehicle Policy Table
async function createPreviousVehiclePolicyTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousVehiclePolicies table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PreviousVehiclePolicies'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating PreviousVehiclePolicies table...");
      await sequelize.query(`
        CREATE TABLE PreviousVehiclePolicies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_policy_id INT NULL COMMENT 'Reference to the original policy ID before it was moved to previous',
          business_type ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement') NOT NULL,
          customer_type ENUM('Organisation', 'Individual') NOT NULL,
          insurance_company_id INT NOT NULL,
          company_id INT NULL,
          consumer_id INT NULL,
          organisation_or_holder_name VARCHAR(255) NOT NULL,
          policy_number VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          mobile_number VARCHAR(255) NULL,
          policy_start_date DATE NOT NULL,
          policy_end_date DATE NOT NULL,
          sub_product ENUM('Two Wheeler', 'Private car', 'Passanger Vehicle', 'Goods Vehicle', 'Misc - D Vehicle', 'Standalone CPA') NOT NULL,
          vehicle_number VARCHAR(255) NOT NULL,
          segment ENUM('Comprehensive', 'TP Only', 'SAOD') NOT NULL,
          manufacturing_company VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          manufacturing_year VARCHAR(255) NOT NULL,
          idv DECIMAL(12, 2) NOT NULL,
          net_premium DECIMAL(10, 2) NOT NULL,
          gst DECIMAL(10, 2) NOT NULL,
          gross_premium DECIMAL(10, 2) NOT NULL,
          policy_document_path VARCHAR(255) NULL,
          remarks TEXT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'expired' COMMENT 'Status when the policy was moved to previous (usually expired)',
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this policy was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_company_id (company_id),
          INDEX idx_consumer_id (consumer_id),
          INDEX idx_insurance_company_id (insurance_company_id),
          INDEX idx_policy_end_date (policy_end_date),
          INDEX idx_original_policy_id (original_policy_id),
          INDEX idx_renewed_at (renewed_at),
          FOREIGN KEY (insurance_company_id) REFERENCES InsuranceCompanies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (consumer_id) REFERENCES Consumers(consumer_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ PreviousVehiclePolicies table created successfully");
    } else {
      console.log("ℹ️  PreviousVehiclePolicies table already exists");
    }

    const [previousPolicyIdExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'VehiclePolicies' AND COLUMN_NAME = 'previous_policy_id'`,
      { type: QueryTypes.SELECT }
    );

    if (previousPolicyIdExists.count === 0) {
      console.log("📝 Adding previous_policy_id column to VehiclePolicies...");
      await sequelize.query(`
        ALTER TABLE VehiclePolicies 
        ADD COLUMN previous_policy_id INT NULL COMMENT 'Reference to the previous policy ID that was renewed (if this is a renewal)',
        ADD INDEX idx_previous_policy_id (previous_policy_id)
      `);
      console.log("✅ previous_policy_id column added successfully");
    } else {
      console.log("ℹ️  previous_policy_id column already exists");
    }

    console.log("✅ PreviousVehiclePolicies table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousVehiclePolicies table:", error);
    throw error;
  }
}

// Create Previous Health Policy Table
async function createPreviousHealthPolicyTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousHealthPolicies table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PreviousHealthPolicies'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating PreviousHealthPolicies table...");
      await sequelize.query(`
        CREATE TABLE PreviousHealthPolicies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_policy_id INT NULL COMMENT 'Reference to the original policy ID before it was moved to previous',
          business_type ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement') NOT NULL,
          customer_type ENUM('Organisation', 'Individual') NOT NULL,
          insurance_company_id INT NOT NULL,
          company_id INT NULL,
          consumer_id INT NULL,
          proposer_name VARCHAR(255) NOT NULL,
          policy_number VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile_number VARCHAR(255) NOT NULL,
          policy_start_date DATE NOT NULL,
          policy_end_date DATE NOT NULL,
          plan_name VARCHAR(255) NOT NULL,
          medical_cover ENUM('1 lac', '2 lac', '3 lac', '5 lac', '10 lac', '15 lac', '20 lac', '25 lac', '30 lac', '50 lac', '1 crore', '2 crore', '5 crore') NOT NULL,
          net_premium DECIMAL(10, 2) NOT NULL,
          gst DECIMAL(10, 2) NOT NULL,
          gross_premium DECIMAL(10, 2) NOT NULL,
          policy_document_path VARCHAR(255) NULL,
          remarks TEXT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'expired' COMMENT 'Status when the policy was moved to previous (usually expired)',
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this policy was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_policy_number (policy_number),
          INDEX idx_company_id (company_id),
          INDEX idx_consumer_id (consumer_id),
          INDEX idx_insurance_company_id (insurance_company_id),
          INDEX idx_policy_end_date (policy_end_date),
          INDEX idx_original_policy_id (original_policy_id),
          INDEX idx_renewed_at (renewed_at),
          INDEX idx_policy_dates (policy_start_date, policy_end_date),
          FOREIGN KEY (insurance_company_id) REFERENCES InsuranceCompanies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (consumer_id) REFERENCES Consumers(consumer_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ PreviousHealthPolicies table created successfully");
    } else {
      console.log("ℹ️  PreviousHealthPolicies table already exists");
    }

    const [previousPolicyIdExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HealthPolicies' AND COLUMN_NAME = 'previous_policy_id'`,
      { type: QueryTypes.SELECT }
    );

    if (previousPolicyIdExists.count === 0) {
      console.log("📝 Adding previous_policy_id column to HealthPolicies...");
      await sequelize.query(`
        ALTER TABLE HealthPolicies 
        ADD COLUMN previous_policy_id INT NULL COMMENT 'Reference to the previous policy ID that was renewed (if this is a renewal)',
        ADD INDEX idx_previous_policy_id (previous_policy_id)
      `);
      console.log("✅ previous_policy_id column added successfully");
    } else {
      console.log("ℹ️  previous_policy_id column already exists");
    }

    console.log("✅ PreviousHealthPolicies table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousHealthPolicies table:", error);
    throw error;
  }
}

// Create Previous Fire Policy Table
async function createPreviousFirePolicyTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousFirePolicies table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PreviousFirePolicies'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating PreviousFirePolicies table...");
      await sequelize.query(`
        CREATE TABLE PreviousFirePolicies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_policy_id INT NULL COMMENT 'Reference to the original policy ID before it was moved to previous',
          business_type ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement') NOT NULL,
          customer_type ENUM('Organisation', 'Individual') NOT NULL,
          insurance_company_id INT NOT NULL,
          company_id INT NULL,
          consumer_id INT NULL,
          proposer_name VARCHAR(255) NOT NULL,
          policy_number VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile_number VARCHAR(255) NOT NULL,
          policy_start_date DATE NOT NULL,
          policy_end_date DATE NOT NULL,
          total_sum_insured DECIMAL(12, 2) NOT NULL,
          gst_number VARCHAR(255) NULL,
          pan_number VARCHAR(255) NULL,
          net_premium DECIMAL(10, 2) NOT NULL,
          gst DECIMAL(10, 2) NOT NULL,
          gross_premium DECIMAL(10, 2) NOT NULL,
          policy_document_path VARCHAR(255) NULL,
          remarks TEXT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'expired' COMMENT 'Status when the policy was moved to previous (usually expired)',
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this policy was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_policy_number (policy_number),
          INDEX idx_company_id (company_id),
          INDEX idx_consumer_id (consumer_id),
          INDEX idx_insurance_company_id (insurance_company_id),
          INDEX idx_policy_end_date (policy_end_date),
          INDEX idx_original_policy_id (original_policy_id),
          INDEX idx_renewed_at (renewed_at),
          INDEX idx_policy_dates (policy_start_date, policy_end_date),
          INDEX idx_total_sum_insured (total_sum_insured),
          FOREIGN KEY (insurance_company_id) REFERENCES InsuranceCompanies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (consumer_id) REFERENCES Consumers(consumer_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ PreviousFirePolicies table created successfully");
    } else {
      console.log("ℹ️  PreviousFirePolicies table already exists");
    }

    const [previousPolicyIdExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'FirePolicies' AND COLUMN_NAME = 'previous_policy_id'`,
      { type: QueryTypes.SELECT }
    );

    if (previousPolicyIdExists.count === 0) {
      console.log("📝 Adding previous_policy_id column to FirePolicies...");
      await sequelize.query(`
        ALTER TABLE FirePolicies 
        ADD COLUMN previous_policy_id INT NULL COMMENT 'Reference to the previous policy ID that was renewed (if this is a renewal)',
        ADD INDEX idx_previous_policy_id (previous_policy_id)
      `);
      console.log("✅ previous_policy_id column added successfully");
    } else {
      console.log("ℹ️  previous_policy_id column already exists");
    }

    console.log("✅ PreviousFirePolicies table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousFirePolicies table:", error);
    throw error;
  }
}

// Create Previous Life Policy Table
async function createPreviousLifePolicyTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousLifePolicies table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PreviousLifePolicies'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating PreviousLifePolicies table...");
      await sequelize.query(`
        CREATE TABLE PreviousLifePolicies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_policy_id INT NULL COMMENT 'Reference to the original policy ID before it was moved to previous',
          business_type ENUM('Fresh/New', 'Renewal/Rollover', 'Endorsement') NOT NULL DEFAULT 'Fresh/New',
          customer_type ENUM('Organisation', 'Individual') NOT NULL DEFAULT 'Individual',
          insurance_company_id INT NOT NULL,
          company_id INT NULL,
          consumer_id INT NULL,
          proposer_name VARCHAR(255) NOT NULL,
          date_of_birth DATE NOT NULL,
          plan_name VARCHAR(255) NOT NULL,
          sub_product VARCHAR(255) NOT NULL,
          pt DECIMAL(10, 2) NOT NULL,
          ppt INT NOT NULL,
          policy_start_date DATE NOT NULL,
          issue_date DATE NOT NULL,
          policy_end_date DATE NOT NULL,
          current_policy_number VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          mobile_number VARCHAR(255) NULL,
          net_premium DECIMAL(10, 2) NOT NULL,
          gst DECIMAL(10, 2) NOT NULL,
          gross_premium DECIMAL(10, 2) NOT NULL,
          policy_document_path VARCHAR(255) NULL,
          remarks TEXT NULL,
          status ENUM('active', 'expired', 'cancelled') DEFAULT 'expired' COMMENT 'Status when the policy was moved to previous (usually expired)',
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this policy was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_current_policy_number (current_policy_number),
          INDEX idx_company_id (company_id),
          INDEX idx_consumer_id (consumer_id),
          INDEX idx_insurance_company_id (insurance_company_id),
          INDEX idx_policy_end_date (policy_end_date),
          INDEX idx_original_policy_id (original_policy_id),
          INDEX idx_renewed_at (renewed_at),
          INDEX idx_policy_dates (policy_start_date, policy_end_date),
          INDEX idx_date_of_birth (date_of_birth),
          INDEX idx_issue_date (issue_date),
          FOREIGN KEY (insurance_company_id) REFERENCES InsuranceCompanies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (company_id) REFERENCES Companies(company_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (consumer_id) REFERENCES Consumers(consumer_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ PreviousLifePolicies table created successfully");
    } else {
      console.log("ℹ️  PreviousLifePolicies table already exists");
    }

    // Add missing columns to LifePolicies table
    const columnsToAdd = [
      { name: 'previous_policy_id', sql: 'ADD COLUMN previous_policy_id INT NULL COMMENT \'Reference to the previous policy ID that was renewed (if this is a renewal)\', ADD INDEX idx_previous_policy_id (previous_policy_id)' },
      { name: 'business_type', sql: 'ADD COLUMN business_type ENUM(\'Fresh/New\', \'Renewal/Rollover\', \'Endorsement\') NOT NULL DEFAULT \'Fresh/New\' AFTER id, ADD INDEX idx_business_type (business_type)' },
      { name: 'customer_type', sql: 'ADD COLUMN customer_type ENUM(\'Organisation\', \'Individual\') NOT NULL DEFAULT \'Individual\' AFTER business_type, ADD INDEX idx_customer_type (customer_type)' }
    ];

    for (const column of columnsToAdd) {
      const [columnExists] = await sequelize.query(
        `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'LifePolicies' AND COLUMN_NAME = '${column.name}'`,
        { type: QueryTypes.SELECT }
      );

      if (columnExists.count === 0) {
        console.log(`📝 Adding ${column.name} column to LifePolicies...`);
        await sequelize.query(`ALTER TABLE LifePolicies ${column.sql}`);
        console.log(`✅ ${column.name} column added successfully`);
      } else {
        console.log(`ℹ️  ${column.name} column already exists`);
      }
    }

    console.log("✅ PreviousLifePolicies table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousLifePolicies table:", error);
    throw error;
  }
}

// Create Previous Stability Management Table
async function createPreviousStabilityManagementTable() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log("🔄 Starting PreviousStabilityManagement table creation...");

    const [tableExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'previous_stability_management'`,
      { type: QueryTypes.SELECT }
    );

    if (tableExists.count === 0) {
      console.log("📝 Creating previous_stability_management table...");
      await sequelize.query(`
        CREATE TABLE previous_stability_management (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_stability_id INT NULL COMMENT 'Reference to the original stability ID before it was moved to previous',
          factory_quotation_id INT NOT NULL,
          stability_manager_id INT NOT NULL,
          status ENUM('stability', 'submit', 'Approved', 'Reject') NOT NULL DEFAULT 'Approved' COMMENT 'Status when the stability was moved to previous (usually Approved)',
          load_type ENUM('with_load', 'without_load') NOT NULL,
          stability_date DATE NULL COMMENT 'Date when stability certificate was issued',
          renewal_date DATE NULL COMMENT 'Original renewal date (5 years after stability date)',
          remarks TEXT NULL,
          files JSON NULL DEFAULT (JSON_ARRAY()),
          submitted_at DATETIME NULL,
          reviewed_at DATETIME NULL,
          reviewed_by INT NULL,
          renewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date when this stability was renewed and moved to previous',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_factory_quotation_id (factory_quotation_id),
          INDEX idx_stability_manager_id (stability_manager_id),
          INDEX idx_original_stability_id (original_stability_id),
          INDEX idx_renewed_at (renewed_at),
          INDEX idx_renewal_date (renewal_date),
          INDEX idx_stability_dates (stability_date, renewal_date),
          FOREIGN KEY (factory_quotation_id) REFERENCES FactoryQuotations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (stability_manager_id) REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
          FOREIGN KEY (reviewed_by) REFERENCES Users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ previous_stability_management table created successfully");
    } else {
      console.log("ℹ️  previous_stability_management table already exists");
    }

    const [previousStabilityIdExists] = await sequelize.query(
      `SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stability_management' AND COLUMN_NAME = 'previous_stability_id'`,
      { type: QueryTypes.SELECT }
    );

    if (previousStabilityIdExists.count === 0) {
      console.log("📝 Adding previous_stability_id column to stability_management...");
      await sequelize.query(`
        ALTER TABLE stability_management 
        ADD COLUMN previous_stability_id INT NULL COMMENT 'Reference to the previous stability ID that was renewed (if this is a renewal)',
        ADD INDEX idx_previous_stability_id (previous_stability_id)
      `);
      console.log("✅ previous_stability_id column added successfully");
    } else {
      console.log("ℹ️  previous_stability_id column already exists");
    }

    console.log("✅ PreviousStabilityManagement table setup completed successfully!");
  } catch (error) {
    console.error("❌ Error creating PreviousStabilityManagement table:", error);
    throw error;
  }
}

// Setup policy tables and renewal system
async function setupPolicyTables() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🏗️  POLICY TABLES SETUP');
    console.log('='.repeat(60));
    
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    console.log('\n📋 Step 1: Setting up ECP Previous Policy Table...');
    await createPreviousEmployeeCompensationTable();
    console.log('✅ ECP Previous Policy Table setup completed');

    console.log('\n📋 Step 2: Setting up Vehicle Previous Policy Table...');
    await createPreviousVehiclePolicyTable();
    console.log('✅ Vehicle Previous Policy Table setup completed');

    console.log('\n📋 Step 3: Setting up Health Previous Policy Table...');
    await createPreviousHealthPolicyTable();
    console.log('✅ Health Previous Policy Table setup completed');

    console.log('\n📋 Step 4: Setting up Fire Previous Policy Table...');
    await createPreviousFirePolicyTable();
    console.log('✅ Fire Previous Policy Table setup completed');

    console.log('\n📋 Step 5: Setting up Life Previous Policy Table...');
    await createPreviousLifePolicyTable();
    console.log('✅ Life Previous Policy Table setup completed');

    console.log('\n📁 Step 6: Setting up upload directories...');
    await setupUploadDirectories();
    console.log('✅ Upload directories setup completed');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 POLICY TABLES SETUP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ Policy Tables Setup Failed:', error);
    return false;
  }
}

// Setup upload directories
async function setupUploadDirectories() {
  const fs = require('fs').promises;
  const path = require('path');

  const directories = [
    'uploads',
    'uploads/employee_policies',
    'uploads/vehicle_policies',
    'uploads/health_policies',
    'uploads/fire_policies',
    'uploads/life_policies',
    'uploads/dsc_documents',
    'uploads/labour_documents',
    'uploads/factory_quotations',
    'uploads/plan_documents',
    'uploads/stability_documents'
  ];

  for (const dir of directories) {
    const dirPath = path.join(__dirname, '..', dir);
    try {
      await fs.access(dirPath);
      console.log(`   📁 Directory exists: ${dir}`);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`   📁 Directory created: ${dir}`);
    }
  }
}

// ===== RENEWAL REMINDER FUNCTIONS =====

async function runAutomaticRenewalReminders() {
  try {
    console.log('='.repeat(50));
    console.log('🚀 AUTOMATIC RENEWAL REMINDER PROCESS STARTED');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('📌 Active: DSC + Labour License + Stability Management + Factory + Labour Inspection');
    console.log('='.repeat(50));

    const renewalService = new RenewalService();

    const results = {
      dsc: await renewalService.processDSCRenewals(),
      labourLicense: await renewalService.processLabourLicenseReminders(),
      stabilityManagement: await renewalService.processStabilityManagementReminders(),
      factoryLicense: await renewalService.processFactoryQuotationRenewals(),
      labourInspection: await renewalService.processLabourInspectionReminders()
    };

    console.log('\n' + '='.repeat(50));
    console.log('📊 RENEWAL REMINDER SUMMARY');
    console.log('='.repeat(50));
    console.log('🔐 DSC (ACTIVE):', results.dsc.successful || 0, 'emails sent');
    console.log('📋 Labour License (ACTIVE):', results.labourLicense.successful || 0, 'emails sent');
    console.log('🏗️ Stability Management (ACTIVE):', results.stabilityManagement.successful || 0, 'emails sent');
    console.log('🏭 Factory License (ACTIVE):', results.factoryLicense.successful || 0, 'emails sent');
    console.log('🔍 Labour Inspection (ACTIVE):', results.labourInspection.successful || 0, 'emails sent');
    console.log('='.repeat(50));
    
    const totalSent = Object.values(results).reduce((sum, r) => sum + (r.successful || 0), 0);
    console.log('✅ TOTAL EMAILS SENT:', totalSent);
    console.log('='.repeat(50));

    return results;
  } catch (error) {
    console.error('❌ ERROR IN AUTOMATIC RENEWAL REMINDERS:', error);
    throw error;
  }
}

// ===== MAIN CONSOLIDATED SETUP FUNCTION =====

async function runCompleteSetup() {
  try {
    console.log('\n' + '🚀'.repeat(20));
    console.log('CONSOLIDATED SERVER SETUP SCRIPT STARTED');
    console.log('🚀'.repeat(20) + '\n');
    
    console.log('📋 This script will perform:');
    console.log('   • Database Setup & Synchronization');
    console.log('   • Authentication System Setup');
    console.log('   • Roles & Permissions Setup');
    console.log('   • Account Creation & Verification');
    console.log('   • Policy Tables Creation');
    console.log('   • Renewal System Setup');
    console.log('   • Upload Directories Creation');
    console.log('   • System Verification');
    console.log('\n' + '='.repeat(70) + '\n');

    // Step 1: Run original server setup
    console.log('🔧 STEP 1: Running Database & Server Setup...');
    const serverSetupSuccess = await setupAll();
    if (!serverSetupSuccess) {
      throw new Error('Server setup failed');
    }
    console.log('✅ Database & Server Setup completed successfully!\n');

    // Step 2: Setup authentication system
    console.log('🔐 STEP 2: Setting up Authentication System...');
    const authSuccess = await setupAuthenticationSystem();
    if (!authSuccess) {
      console.warn('⚠️  Authentication setup had issues, but continuing...');
    }
    console.log('✅ Authentication system setup completed!\n');

    // Step 3: Create accounts
    console.log('👥 STEP 3: Creating and Verifying Accounts...');
    const accountsSuccess = await createAllAccounts();
    if (!accountsSuccess) {
      throw new Error('Account creation failed');
    }
    console.log('✅ Account creation completed successfully!\n');

    // Step 4: Setup policy tables
    console.log('📋 STEP 4: Setting up Policy Tables...');
    const policyTablesSuccess = await setupPolicyTables();
    if (!policyTablesSuccess) {
      throw new Error('Policy tables setup failed');
    }
    console.log('✅ Policy tables setup completed successfully!\n');

    // Step 5: Check existing accounts
    console.log('🔍 STEP 5: Final Account Verification...');
    const accountCheckSuccess = await checkExistingAccounts();
    if (!accountCheckSuccess) {
      console.warn('⚠️  Account verification had issues, but continuing...');
    }
    console.log('✅ Account verification completed!\n');

    // Final success message
    console.log('\n' + '🎉'.repeat(20));
    console.log('CONSOLIDATED SETUP COMPLETED SUCCESSFULLY!');
    console.log('🎉'.repeat(20) + '\n');
    
    console.log('📊 Setup Summary:');
    console.log('   ✅ Database & Server Setup: Complete');
    console.log('   ✅ Authentication System: Complete');
    console.log('   ✅ Roles & Permissions: Complete');
    console.log('   ✅ Account Creation: Complete');
    console.log('   ✅ Policy Tables: Complete');
    console.log('   ✅ Renewal System: Complete');
    console.log('   ✅ Upload Directories: Complete');
    console.log('   ✅ System Verification: Complete');
    console.log('\n' + '='.repeat(70));
    console.log('🚀 Your server is ready to use!');
    console.log('='.repeat(70) + '\n');

    return true;
  } catch (error) {
    console.error('\n❌ CONSOLIDATED SETUP FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Export individual functions
module.exports = {
  setupDatabase,
  setupRolesAndPermissions,
  migrateExistingUsers,
  setupAdminUser,
  setupPlanManagers,
  setupStabilityManagers,
  verifyRequiredRoles,
  setupRenewalSystem,
  setupAuthenticationSystem,
  setupAll,
  checkExistingAccounts,
  createAllAccounts,
  createOrUpdateAccount,
  assignRoleToUser,
  checkAccount,
  createPreviousEmployeeCompensationTable,
  createPreviousVehiclePolicyTable,
  createPreviousHealthPolicyTable,
  createPreviousFirePolicyTable,
  createPreviousLifePolicyTable,
  createPreviousStabilityManagementTable,
  setupPolicyTables,
  setupUploadDirectories,
  runAutomaticRenewalReminders,
  runCompleteSetup
};



// Run setup if this file is run directly
if (require.main === module) {
  // Show menu for user to choose what to run
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n🚀 CONSOLIDATED SERVER SETUP SCRIPT');
    console.log('=====================================');
    console.log('Usage: node serverSetup.js [option]');
    console.log('\nAvailable options:');
    console.log('  complete     - Run complete setup (recommended)');
    console.log('  database     - Setup database only');
    console.log('  accounts     - Create/verify accounts only');
    console.log('  policies     - Setup policy tables only');
    console.log('  renewals     - Run renewal reminders only');
    console.log('  check        - Check existing accounts only');
    console.log('\nExample: node serverSetup.js complete');
    process.exit(0);
  }

  const option = args[0].toLowerCase();

  switch (option) {
    case 'complete':
      runCompleteSetup()
        .then((success) => {
          process.exit(success ? 0 : 1);
        })
        .catch((error) => {
          console.error('\n💥 Script crashed:', error);
          process.exit(1);
        });
      break;

    case 'database':
      setupAll()
        .then((success) => {
          console.log(success ? '\n✅ Database setup completed successfully' : '\n❌ Database setup failed');
          process.exit(success ? 0 : 1);
        })
        .catch((error) => {
          console.error('\n💥 Database setup crashed:', error);
          process.exit(1);
        });
      break;

    case 'accounts':
      createAllAccounts()
        .then((success) => {
          console.log(success ? '\n✅ Account creation completed successfully' : '\n❌ Account creation failed');
          process.exit(success ? 0 : 1);
        })
        .catch((error) => {
          console.error('\n💥 Account creation crashed:', error);
          process.exit(1);
        });
      break;

    case 'policies':
      setupPolicyTables()
        .then((success) => {
          console.log(success ? '\n✅ Policy tables setup completed successfully' : '\n❌ Policy tables setup failed');
          process.exit(success ? 0 : 1);
        })
        .catch((error) => {
          console.error('\n💥 Policy tables setup crashed:', error);
          process.exit(1);
        });
      break;

    case 'renewals':
      runAutomaticRenewalReminders()
        .then(() => {
          console.log('\n✅ Renewal reminders completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('\n💥 Renewal reminders crashed:', error);
          process.exit(1);
        });
      break;

    case 'check':
      checkExistingAccounts()
        .then((success) => {
          console.log(success ? '\n✅ Account check completed successfully' : '\n❌ Account check failed');
          process.exit(success ? 0 : 1);
        })
        .catch((error) => {
          console.error('\n💥 Account check crashed:', error);
          process.exit(1);
        });
      break;

    default:
      console.error(`\n❌ Unknown option: ${option}`);
      console.log('Run "node serverSetup.js" without arguments to see available options.');
      process.exit(1);
  }
} 