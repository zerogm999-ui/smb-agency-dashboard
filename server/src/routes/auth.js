// Authentication Routes
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh-token
// POST /api/auth/verify-token

const express = require('express');
const bcrypt = require('bcryptjs');
const { db, AppError, asyncHandler } = require('../database/db');
const { generateToken, verifyToken, authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply auth rate limiter to login/register
router.use('/login', authLimiter);
router.use('/register', authLimiter);

// ---------------------
// POST /api/auth/register
// Create a new agency and admin user
// ---------------------
router.post('/register', asyncHandler(async (req, res) => {
  const { agencyName, email, password, confirmPassword, name, phone } = req.body;

  // Validation
  if (!agencyName || !email || !password || !confirmPassword) {
    throw new AppError('Agency name, email, password, and confirmPassword are required', 400, 'VALIDATION_ERROR');
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400, 'PASSWORD_MISMATCH');
  }

  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400, 'PASSWORD_TOO_SHORT');
  }

  // Check if email already exists
  const existingUser = await db.oneOrNone('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create agency
  const agency = await db.one(
    `INSERT INTO agencies (name, email, phone)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, phone, plan, status, created_at`,
    [agencyName, email, phone || null]
  );

  // Create admin user
  const user = await db.one(
    `INSERT INTO users (agency_id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, 'admin')
     RETURNING id, email, name, role, created_at`,
    [agency.id, email, passwordHash, name || email]
  );

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    agencyId: agency.id,
    email: user.email,
    role: user.role,
  });

  // Log audit event
  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details, ip_address)
     VALUES ($1, $2, 'register', 'agency', $3, $4, $5)`,
    [agency.id, user.id, agency.id, JSON.stringify({ agencyName }), req.ip]
  );

  res.status(201).json({
    message: 'Registration successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    agency: {
      id: agency.id,
      name: agency.name,
      email: agency.email,
    },
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}));

// ---------------------
// POST /api/auth/login
// Login with email and password
// ---------------------
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  // Find user with agency info
  const user = await db.oneOrNone(
    `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.status,
            a.id AS agency_id, a.name AS agency_name, a.status AS agency_status
     FROM users u
     JOIN agencies a ON u.agency_id = a.id
     WHERE u.email = $1`,
    [email]
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'active') {
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Update last login
  await db.none('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    agencyId: user.agency_id,
    email: user.email,
    role: user.role,
  });

  // Log audit event
  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, ip_address)
     VALUES ($1, $2, 'login', 'user', $3)`,
    [user.agency_id, user.id, req.ip]
  );

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    agency: {
      id: user.agency_id,
      name: user.agency_name,
    },
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}));

// ---------------------
// POST /api/auth/refresh-token
// Get a new token using a valid existing token
// ---------------------
router.post('/refresh-token', authenticateToken, asyncHandler(async (req, res) => {
  const { userId, agencyId, email, role } = req.user;

  // Verify user still exists and is active
  const user = await db.oneOrNone(
    'SELECT id, status FROM users WHERE id = $1 AND status = $2',
    [userId, 'active']
  );

  if (!user) {
    throw new AppError('User not found or deactivated', 401, 'USER_NOT_FOUND');
  }

  // Generate new token
  const token = generateToken({ userId, agencyId, email, role });

  res.json({
    message: 'Token refreshed',
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}));

// ---------------------
// POST /api/auth/verify-token
// Check if a token is valid
// ---------------------
router.post('/verify-token', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new AppError('Token is required', 400, 'VALIDATION_ERROR');
  }

  try {
    const decoded = verifyToken(token);
    res.json({
      valid: true,
      user: {
        userId: decoded.userId,
        agencyId: decoded.agencyId,
        email: decoded.email,
        role: decoded.role,
      },
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    });
  } catch (error) {
    res.json({
      valid: false,
      error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
    });
  }
}));

module.exports = router;
