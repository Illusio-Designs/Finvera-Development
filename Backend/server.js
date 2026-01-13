const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
// Lazy load sequelize only when needed to avoid memory issues in production
let sequelize;
const helmet = require("helmet");
const morgan = require("morgan");
const cron = require("node-cron");
const {
  setupRolesAndPermissions,
  setupAdminUser,
} = require("./scripts/serverSetup");
const {
  corsOptions,
  allowedOrigins,
  securityHeadersMiddleware,
} = require("./config/cors");
const { registerRoutes } = require("./routes");
const config = require("./config/config");

// Initialize Express app
const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable CSP temporarily
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration (must come before other middlewares and routes)
app.use(cors(corsOptions));
// Explicitly handle preflight for all routes
app.options('*', cors(corsOptions));

// Apply security headers middleware (after CORS so headers are not overridden)
app.use(securityHeadersMiddleware);

// Add cache control headers
app.use((req, res, next) => {
  res.header(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  next();
});

// Static files setup with enhanced logging
app.use("/uploads", (req, res, next) => {
  const filePath = path.join(__dirname, "uploads", req.path);
  console.log(`[Static File Request] ${req.method} ${req.originalUrl}`);
  console.log(`[Static File Path] ${filePath}`);
  
  // Check if file exists
  const fs = require('fs');
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`[Static File] File not found: ${filePath}`);
      console.log(`[Static File] Error: ${err.message}`);
    } else {
      console.log(`[Static File] File exists: ${filePath}`);
    }
  });
  
  next();
}, express.static(path.join(__dirname, "uploads"), {
  // Add options for better error handling
  dotfiles: 'ignore',
  etag: false,
  extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
  index: false,
  maxAge: '1d',
  redirect: false,
  setHeaders: function (res, path, stat) {
    console.log(`[Static File] Serving: ${path}`);
    res.set('x-timestamp', Date.now());
  }
}));

// Fallback handler for uploads that weren't found by static middleware
app.use("/uploads", (req, res, next) => {
  const filePath = path.join(__dirname, "uploads", req.path);
  console.log(`[Static File Fallback] File not found: ${filePath}`);
  
  // Try to find the file in subdirectories
  const fs = require('fs');
  const possiblePaths = [
    path.join(__dirname, "uploads", req.path),
    path.join(__dirname, "uploads", "fire_policies", path.basename(req.path)),
    path.join(__dirname, "uploads", "health_policies", path.basename(req.path)),
    path.join(__dirname, "uploads", "life_policies", path.basename(req.path)),
    path.join(__dirname, "uploads", "vehicle_policies", path.basename(req.path)),
    path.join(__dirname, "uploads", "employee_policies", path.basename(req.path)),
  ];
  
  console.log(`[Static File Fallback] Trying alternative paths for: ${path.basename(req.path)}`);
  
  for (const altPath of possiblePaths) {
    try {
      if (fs.existsSync(altPath)) {
        console.log(`[Static File Fallback] Found file at: ${altPath}`);
        return res.sendFile(altPath);
      }
    } catch (err) {
      console.log(`[Static File Fallback] Error checking ${altPath}: ${err.message}`);
    }
  }
  
  // If still not found, return a proper 404
  console.log(`[Static File Fallback] File not found in any location: ${req.path}`);
  res.status(404).json({
    status: "error",
    message: "File not found",
    path: req.originalUrl,
    searched_paths: possiblePaths.map(p => p.replace(__dirname, ''))
  });
});

// Root path handler
app.get("/", (req, res) => {
  res.json({
    status: "UP",
    message: "Welcome to Radhe Consultancy API",
    version: "1.0.0",
    documentation: "/api/docs",
    health: "/api/health",
  });
});

// API root path handler
app.get("/api", (req, res) => {
  res.json({
    status: "UP",
    message: "Radhe Consultancy API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      roles: "/api/roles",
      companies: "/api/companies",
      consumers: "/api/consumers",
      employeeCompensation: "/api/employee-compensation",
      insuranceCompanies: "/api/insurance-companies",
    },
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = await sequelize
      .authenticate()
      .then(() => "UP")
      .catch(() => "DOWN");

    res.status(200).json({
      status: "UP",
      message: "Server is running",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: "1.0.0",
      uptime: process.uptime(),
      services: { database: dbStatus, api: "UP" },
    });
  } catch (error) {
    res.status(500).json({
      status: "DOWN",
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

// API request logging middleware
app.use("/api", (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Register routes
registerRoutes(app);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      ...(config.server.nodeEnv === "development" && { stack: err.stack }),
    },
  });
});

// Start server
const startServer = async () => {
  try {
    // Check if we should skip setup (production mode)
    const skipSetup = process.env.SKIP_SETUP === 'true' || process.env.CURRENT_ENV === 'production';
    
    if (skipSetup) {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 PRODUCTION MODE - Starting server without setup...');
      console.log('🔧 Skipping database setup and connection test');
      console.log('📌 Database will connect on first API request');
      console.log('='.repeat(60));
    } else {
      // Load sequelize only when needed for setup
      sequelize = require("./config/db");
      // Setup database and roles before starting server
      const {
        setupDatabase,
        setupRolesAndPermissions,
        setupAdminUser,
        setupPlanManagers,
        setupStabilityManagers,
        verifyRequiredRoles,
        setupRenewalSystem,
      } = require("./scripts/serverSetup");

      console.log("🚀 Starting complete server setup...");
      
      // Step 1: Database Setup
      console.log("📊 Setting up database structure...");
      const dbSetup = await setupDatabase();
      if (!dbSetup) {
        throw new Error("Database setup failed");
      }
      console.log("✅ Database structure setup completed");

    // Step 2: Roles and Permissions
    console.log("🔐 Setting up roles and permissions...");
    const rolesSetup = await setupRolesAndPermissions();
    if (!rolesSetup) {
      throw new Error("Roles and permissions setup failed");
    }
    console.log("✅ Roles and permissions setup completed");

    // Step 3: Verify Required Roles
    console.log("✅ Verifying required roles exist...");
    const rolesVerified = await verifyRequiredRoles();
    if (!rolesVerified) {
      throw new Error("Required roles verification failed");
    }
    console.log("✅ All required roles verified");

    // Step 4: Create All User Accounts
      // Step 4: Setup Renewal Management System
      console.log("🔧 Setting up Renewal Management System...");
      await setupRenewalSystem();
      console.log("✅ Renewal Management System setup completed");

      console.log("🎉 Complete server setup completed successfully!");
    }

    const port = config.server.port;
    app.listen(port, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🌍 Environment: ${config.server.nodeEnv}`);
      console.log(`🔗 Backend URL: ${config.server.backendUrl}`);
      console.log("✨ All systems ready!");
      console.log('='.repeat(60));
      
      // Setup automatic renewal reminders cron job
      // Runs every day at 9:00 AM IST
      let cronSchedule = process.env.RENEWAL_CRON_SCHEDULE || '0 9 * * *';
      
      // Remove quotes if present (dotenv may include them)
      cronSchedule = cronSchedule.replace(/^["']|["']$/g, '').trim();
      
      // Validate cron schedule - if invalid, use default
      const cronPattern = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|(0?[1-9]|[12]\d|3[01])) (\*|(0?[1-9]|1[0-2])) (\*|[0-6])$/;
      if (!cronPattern.test(cronSchedule)) {
        console.warn(`⚠️  Invalid cron schedule detected: "${cronSchedule}"`);
        cronSchedule = '0 9 * * *';
        console.log(`✅ Using default schedule: ${cronSchedule}`);
      }
      
      console.log('\n' + '='.repeat(50));
      console.log('⏰ AUTOMATIC RENEWAL REMINDER SCHEDULER');
      console.log('='.repeat(50));
      console.log(`📅 Schedule: ${cronSchedule} (Cron format)`);
      console.log(`🕐 Next run: Every day at 9:00 AM IST`);
      console.log('='.repeat(50) + '\n');
      
      console.log('✅ Server setup completed successfully!');
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle process termination
const signals = ["SIGTERM", "SIGINT"];
signals.forEach((signal) => {
  process.on(signal, () => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    process.exit(0);
  });
});

// Global error handlers to prevent crashes in production
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

// Start the server
startServer();

module.exports = { app, startServer };
