const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { makeRequest } = require('../utils/tmdbClient');
const { retryWithBackoff, circuitBreaker } = require('../utils/retryHandler');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Rate limiting for search
const searchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 searches per windowMs
  message: 'Too many search requests, please try again later.',
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

    res.json(response.data);
  } catch (error) {
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

    res.json(response.data);
  } catch (error) {
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

    res.json(response.data);
  } catch (error) {
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

    res.json(response.data);
  } catch (error) {
    throw error;
  }
}));

module.exports = router;

