/**
 * CORS Configuration
 * This file contains the CORS settings for the application
 */

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite default port
  'https://radheconsultancy.co.in',
  'https://www.radheconsultancy.co.in',
  'https://api.radheconsultancy.co.in',
  'https://www.api.radheconsultancy.co.in', // Added this for your production API
  'http://radheconsultancy.co.in',
  'http://www.radheconsultancy.co.in',
  'http://api.radheconsultancy.co.in',
  'http://www.api.radheconsultancy.co.in'
];

// Security headers configuration
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self' https://api.radheconsultancy.co.in; connect-src 'self' https://api.radheconsultancy.co.in wss://api.radheconsultancy.co.in; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:;",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin'
};

// CORS options configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, be more permissive for debugging
    // Check if origin is in allowed list OR contains radheconsultancy.co.in
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('radheconsultancy.co.in')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: [
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'Content-Range', 
    'X-Content-Range',
    'Content-Length',
    'Content-Type',
    'Authorization'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Middleware to add security headers
const securityHeadersMiddleware = (req, res, next) => {
  // Add security headers to response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Add CORS headers
  const origin = req.headers.origin;
  
  // Allow all origins in development
  if (process.env.NODE_ENV === 'development') {
    res.header('Access-Control-Allow-Origin', '*');
  } 
  // In production, check if origin is allowed
  else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // Ensure caches and proxies vary on Origin
  res.header('Vary', 'Origin');
  
  // Add cache control headers
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  
  // Add CORS headers
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Accept, Accept-Language, Content-Language, Content-Type, Authorization, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

module.exports = {
  corsOptions,
  allowedOrigins,
  securityHeaders,
  securityHeadersMiddleware
}; 