const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { makeRequest } = require('../utils/tmdbClient');
const { retryWithBackoff, circuitBreaker } = require('../utils/retryHandler');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Rate limiting for search - more lenient for better UX
const searchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 searches per 15 minutes (increased from 50)
  message: 'Too many search requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many search requests, please try again later.',
        status_code: 429,
        retry_after: retryAfter
      }
    });
  },
  skip: (req) => {
    // Skip rate limiting in development if needed
    return process.env.NODE_ENV === 'development' && req.query.skipLimit === 'true';
  }
});

router.use(searchRateLimiter);

/**
 * Search movies, TV shows, and people
 * GET /api/search?query=batman&page=1
 */
router.get('/', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const { query, page = 1 } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Search all (multi-search)
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/search/multi', {
        query: query.trim(),
        page: parseInt(page),
        include_adult: false
      }))
    );

    // Handle empty results gracefully
    if (response && response.data) {
      res.json(response.data);
    } else {
      res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
  } catch (error) {
    // If TMDB returns 404, return empty results instead of error
    if (error.response && error.response.status === 404) {
      return res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
    throw error;
  }
}));

/**
 * Search movies only
 * GET /api/search/movie?query=batman&page=1
 */
router.get('/movie', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const { query, page = 1 } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/search/movie', {
        query: query.trim(),
        page: parseInt(page),
        include_adult: false
      }))
    );

    if (response && response.data) {
      res.json(response.data);
    } else {
      res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
    throw error;
  }
}));

/**
 * Search TV shows only
 * GET /api/search/tv?query=breaking&page=1
 */
router.get('/tv', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const { query, page = 1 } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/search/tv', {
        query: query.trim(),
        page: parseInt(page),
        include_adult: false
      }))
    );

    if (response && response.data) {
      res.json(response.data);
    } else {
      res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
    throw error;
  }
}));

/**
 * Search people only
 * GET /api/search/person?query=tom&page=1
 */
router.get('/person', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const { query, page = 1 } = req.query;
  
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/search/person', {
        query: query.trim(),
        page: parseInt(page),
        include_adult: false
      }))
    );

    if (response && response.data) {
      res.json(response.data);
    } else {
      res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json({ results: [], page: 1, total_pages: 0, total_results: 0 });
    }
    throw error;
  }
}));

module.exports = router;

