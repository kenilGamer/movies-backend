/**
 * Centralized error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // TMDB API errors
  if (err.response) {
    const status = err.response.status || 500;
    const message = err.response.data?.status_message || err.message || 'Internal Server Error';
    
    return res.status(status).json({
      success: false,
      error: {
        message,
        status_code: status
      }
    });
  }

  // Network/timeout errors
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      error: {
        message: 'Request timeout. Please try again.',
        status_code: 504
      }
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      status_code: 500
    }
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  asyncHandler
};

