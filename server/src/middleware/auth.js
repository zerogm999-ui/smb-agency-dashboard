// JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const { db, AppError } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me';

/**
 * Middleware: Verify JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
      code: 'TOKEN_MISSING',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or malformed token',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware: Check if user has admin role
 */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    error: 'Forbidden',
    message: 'Admin access required',
    code: 'ADMIN_REQUIRED',
  });
}

/**
 * Middleware: Verify user belongs to the agency in the request
 */
function requireAgencyAccess(req, res, next) {
  const { agencyId } = req.params;
  if (req.user && req.user.agencyId === agencyId) {
    return next();
  }
  return res.status(403).json({
    error: 'Forbidden',
    message: 'You do not have access to this agency',
    code: 'AGENCY_ACCESS_DENIED',
  });
}

/**
 * Generate JWT token
 */
function generateToken(payload, expiresIn = null) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Verify JWT token (without middleware)
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAgencyAccess,
  generateToken,
  verifyToken,
};
