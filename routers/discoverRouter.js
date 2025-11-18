const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { makeRequest } = require('../utils/tmdbClient');
const { retryWithBackoff, circuitBreaker } = require('../utils/retryHandler');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// Rate limiting for discover
const discoverRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many discover requests, please try again later.',
});

router.use(discoverRateLimiter);

/**
 * Get genres for movies
 * GET /api/discover/genres/movie
 */
router.get('/genres/movie', cacheMiddleware(86400), asyncHandler(async (req, res) => {
  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/genre/movie/list'))
    );
    res.json(response.data);
  } catch (error) {
    throw error;
  }
}));

/**
 * Get genres for TV
 * GET /api/discover/genres/tv
 */
router.get('/genres/tv', cacheMiddleware(86400), asyncHandler(async (req, res) => {
  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/genre/tv/list'))
    );
    res.json(response.data);
  } catch (error) {
    throw error;
  }
}));

/**
 * Discover movies with filters
 * GET /api/discover/movie?with_genres=28,12&year=2020&vote_average.gte=7&sort_by=popularity.desc
 */
router.get('/movie', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const {
    with_genres,
    without_genres,
    primary_release_year,
    'primary_release_date.gte': releaseDateGte,
    'primary_release_date.lte': releaseDateLte,
    'vote_average.gte': voteAverageGte,
    'vote_average.lte': voteAverageLte,
    'vote_count.gte': voteCountGte,
    with_original_language,
    sort_by = 'popularity.desc',
    page = 1,
    ...otherParams
  } = req.query;

  const params = {
    sort_by,
    page: parseInt(page),
    include_adult: false,
  };

  if (with_genres) params.with_genres = with_genres;
  if (without_genres) params.without_genres = without_genres;
  if (primary_release_year) params.primary_release_year = parseInt(primary_release_year);
  if (releaseDateGte) params['primary_release_date.gte'] = releaseDateGte;
  if (releaseDateLte) params['primary_release_date.lte'] = releaseDateLte;
  if (voteAverageGte) params['vote_average.gte'] = parseFloat(voteAverageGte);
  if (voteAverageLte) params['vote_average.lte'] = parseFloat(voteAverageLte);
  if (voteCountGte) params['vote_count.gte'] = parseInt(voteCountGte);
  if (with_original_language) params.with_original_language = with_original_language;

  // Add any other valid TMDB discover parameters
  Object.keys(otherParams).forEach(key => {
    if (key.startsWith('with_') || key.startsWith('without_') || key.includes('.')) {
      params[key] = otherParams[key];
    }
  });

  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/discover/movie', params))
    );
    res.json(response.data);
  } catch (error) {
    throw error;
  }
}));

/**
 * Discover TV shows with filters
 * GET /api/discover/tv?with_genres=18,10759&first_air_date_year=2020&vote_average.gte=7&sort_by=popularity.desc
 */
router.get('/tv', cacheMiddleware(1800), asyncHandler(async (req, res) => {
  const {
    with_genres,
    without_genres,
    first_air_date_year,
    'first_air_date.gte': airDateGte,
    'first_air_date.lte': airDateLte,
    'vote_average.gte': voteAverageGte,
    'vote_average.lte': voteAverageLte,
    'vote_count.gte': voteCountGte,
    with_original_language,
    sort_by = 'popularity.desc',
    page = 1,
    ...otherParams
  } = req.query;

  const params = {
    sort_by,
    page: parseInt(page),
    include_adult: false,
  };

  if (with_genres) params.with_genres = with_genres;
  if (without_genres) params.without_genres = without_genres;
  if (first_air_date_year) params.first_air_date_year = parseInt(first_air_date_year);
  if (airDateGte) params['first_air_date.gte'] = airDateGte;
  if (airDateLte) params['first_air_date.lte'] = airDateLte;
  if (voteAverageGte) params['vote_average.gte'] = parseFloat(voteAverageGte);
  if (voteAverageLte) params['vote_average.lte'] = parseFloat(voteAverageLte);
  if (voteCountGte) params['vote_count.gte'] = parseInt(voteCountGte);
  if (with_original_language) params.with_original_language = with_original_language;

  // Add any other valid TMDB discover parameters
  Object.keys(otherParams).forEach(key => {
    if (key.startsWith('with_') || key.startsWith('without_') || key.includes('.')) {
      params[key] = otherParams[key];
    }
  });

  try {
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/discover/tv', params))
    );
    res.json(response.data);
  } catch (error) {
    throw error;
  }
}));

module.exports = router;

