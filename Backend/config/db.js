const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

// Load .env file manually
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env file from:', envPath);

try {
  // Read file as UTF-8
  const envFile = fs.readFileSync(envPath, 'utf8');
  console.log('✅ Successfully read .env file');
  
  // Parse .env file manually
  const envConfig = {};
  envFile.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim() && !line.trim().startsWith('#')) {
      const [key, value] = line.split('=').map(part => part.trim());
      if (key && value) {
        // Remove any BOM or special characters
        const cleanKey = key.replace(/[\uFEFF\u200B]/g, '');
        const cleanValue = value.replace(/[\uFEFF\u200B]/g, '');
        envConfig[cleanKey] = cleanValue;
        process.env[cleanKey] = cleanValue;
      }
    }
  });

  console.log('✅ Environment variables loaded');
} catch (error) {
  console.error('❌ Error reading .env file:', error);
  throw new Error('Failed to read .env file');
}

// Validate required database configuration
const requiredConfig = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT', 'DB_DIALECT'];
const missingConfig = requiredConfig.filter(key => !process.env[key]);

if (missingConfig.length > 0) {
  throw new Error(`Missing required database configuration: ${missingConfig.join(', ')}`);
}

// Create Sequelize instance with explicit configuration
const dbConfig = {
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD || null, // Explicitly set to null if empty
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT,
  logging: false, // Disable SQL query logging for cleaner output
  pool: {
    max: 5,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
  dialectOptions: {
    dateStrings: true,
    typeCast: true,
    connectTimeout: 60000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: false,
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  },
  timezone: '+05:30',
};

console.log('✅ Database configuration loaded');

const sequelize = new Sequelize(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    if (error.original && error.original.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nPossible solutions:');
      console.error('1. Check if the database password is correct in your .env file');
      console.error('2. If using root without password, make sure MySQL is configured to allow it');
      console.error('3. Create a new MySQL user with proper permissions');
      
      // Additional MySQL-specific instructions
      console.error('\nTo allow root access without password, run these MySQL commands:');
      console.error('ALTER USER \'root\'@\'localhost\' IDENTIFIED WITH mysql_native_password BY \'\';');
      console.error('FLUSH PRIVILEGES;');
      
      console.error('\nOr create a new user with proper permissions:');
      console.error('CREATE USER \'radhe_user\'@\'localhost\' IDENTIFIED BY \'your_password\';');
      console.error('GRANT ALL PRIVILEGES ON radhe_consultancy_crm.* TO \'radhe_user\'@\'localhost\';');
      console.error('FLUSH PRIVILEGES;');
    }
    process.exit(1);
  }
};

testConnection();

module.exports = sequelize;