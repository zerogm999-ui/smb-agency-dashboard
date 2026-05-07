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
// Middleware
// ---------------------

// Security headers
app.use(helmet());

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
    // Initialize database (create tables if they don't exist)
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    app.listen(PORT, () => {
      console.log(`\n🚀 SMB Dashboard API running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API base URL: http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
