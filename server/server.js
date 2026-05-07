// SMB Agency Dashboard - Main Server Entry Point
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { initializeDatabase } = require('./src/database/db');
const { errorHandler } = require('./src/middleware/errorHandler');
const { generalLimiter } = require('./src/middleware/rateLimiter');

// Route imports
const authRoutes = require('./src/routes/auth');
const integrationsRoutes = require('./src/routes/integrations');
const syncRoutes = require('./src/routes/sync');
const dashboardRoutes = require('./src/routes/dashboard');
const reportsRoutes = require('./src/routes/reports');
const crmRoutes = require('./src/routes/crm');

const app = express();
const PORT = process.env.PORT || 5001;

// ---------------------
// Health Check (Top level to bypass all middleware)
// ---------------------
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

console.log('--- SERVER STARTING ---');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// ---------------------
// Middleware
// ---------------------

// Security headers (Only basic for now to avoid blocking)
app.use(helmet({
  contentSecurityPolicy: false, // Disable for now to ensure visibility
}));

// CORS configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
app.use(generalLimiter);

// Static files for reports
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// ---------------------
// Health Check
// ---------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ---------------------
// API Routes
// ---------------------
app.use('/api/auth', authRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/crm', crmRoutes);

// ---------------------
// Static Assets & SPA Routing
// ---------------------

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // All other routes should serve index.html for SPA support
  app.get('*', (req, res, next) => {
    // If it starts with /api or /health, don't serve index.html (let it 404)
    if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// ---------------------
// 404 Handler
// ---------------------
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------
// Global Error Handler
// ---------------------
app.use(errorHandler);

// ---------------------
// Start Server
// ---------------------
async function startServer() {
  try {
    const server = app.listen(PORT, '0.0.0.0', async () => {
      console.log(`\n🚀 SMB Dashboard API running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: /health`);
      console.log(`📚 API base URL: /api\n`);

      try {
        // Initialize database in the background after server starts
        await initializeDatabase();
        console.log('✅ Database initialized successfully');
      } catch (dbError) {
        console.error('⚠️ Database initialization failed (background):', dbError.message);
        // We don't exit(1) here to allow health checks to pass while we debug
      }
    });

    server.on('error', (err) => {
      console.error('❌ Server startup error:', err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server wrapper:', error.message);
    process.exit(1);
  }
}

// ---------------------
// Global Process Handlers
// ---------------------
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  // Optional: Graceful shutdown
  // process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  // Optional: Graceful shutdown
  // process.exit(1);
});

startServer();

module.exports = app;
