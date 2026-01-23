const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const { corsOptions } = require('./config/cors');

const app = express();

// Apply CORS with proper configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/plan', express.static(path.join(__dirname, 'uploads/plan')));

// Register routes
const registerRoutes = require('./routes');
registerRoutes(app);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

module.exports = app; 