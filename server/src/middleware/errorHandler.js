// Global Error Handler Middleware

/**
 * Global error handling middleware
 * Catches all errors thrown in routes and middleware
 */
function errorHandler(err, req, res, next) {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Log the error
  console.error(`❌ [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(`   Status: ${statusCode} | Code: ${code}`);
  console.error(`   Message: ${message}`);

  if (process.env.NODE_ENV !== 'production') {
    console.error(`   Stack: ${err.stack}`);
  }

  // Joi validation errors
  if (err.isJoi) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.details
      ? err.details.map((d) => d.message).join(', ')
      : 'Validation failed';
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'A record with this value already exists';
  }

  if (err.code === '23503') {
    statusCode = 400;
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Referenced record does not exist';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'TOKEN_INVALID';
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Send error response
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : message,
    message: message,
    code: code,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
