const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { makeRequest, generateCacheKey } = require('../utils/tmdbClient');
const { retryWithBackoff, circuitBreaker } = require('../utils/retryHandler');
const { cacheMiddleware, getTTLForEndpoint } = require('../middleware/cacheMiddleware');
const MovieCache = require('../models/movieCacheModel');
const { asyncHandler } = require('../middleware/errorHandler');

// Rate limiting for movie API endpoints
const movieRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(movieRateLimiter);

/**
 * Bollywood movies endpoint
 * GET /api/movies/bollywood?page=1
 * Must come before the catch-all route
 */
router.get('/bollywood', cacheMiddleware(7200), asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  
  // Use a unique cache key to avoid conflicts
  const cacheKey = `bollywood_popular_${page}`;
  const cachedData = await MovieCache.getCached(cacheKey);
  
  // Only use cache if it has actual results
  if (cachedData && cachedData.results && Array.isArray(cachedData.results) && cachedData.results.length > 0) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cachedData);
  }
  
  try {
    console.log('Bollywood popular: Starting fetch...');
    
    // Use ISO 639-1 language code (hi) with ISO 3166-1 country code (IN) format: hi-IN
    // This follows TMDB's language-country pairing format for better localization
    const params = {
      with_original_language: 'hi',
      language: 'hi-IN', // Use language-country format (ISO 639-1 + ISO 3166-1)
      sort_by: 'popularity.desc',
      page: page
    };
    
    console.log('Bollywood popular: Calling discover/movie with params:', params);
    const response = await circuitBreaker.execute(() =>
      retryWithBackoff(() => makeRequest('/discover/movie', params))
    );
    
    let data = response.data;
    console.log('Bollywood popular: Raw response -', {
      hasResults: !!data.results,
      resultsLength: data.results?.length || 0,
      totalResults: data.total_results,
      totalPages: data.total_pages
    });
    
    // If we got empty results array but total_results > 0, it's a TMDB API quirk
    // Try fetching without any filters and then filter client-side
    if (!data.results || data.results.length === 0) {
      console.log('Bollywood popular: Empty results, trying alternative approach...');
      
      // Alternative: Get popular movies and filter for Hindi
      // Use hi-IN format for better localization
      const popularParams = {
        language: 'hi-IN', // ISO 639-1 + ISO 3166-1 format
        page: page
      };
      
      try {
        const popularResponse = await circuitBreaker.execute(() =>
          retryWithBackoff(() => makeRequest('/movie/popular', popularParams))
        );
        
        const popularData = popularResponse.data;
        if (popularData && popularData.results && popularData.results.length > 0) {
          // Filter for Hindi movies
          const hindiMovies = popularData.results.filter(movie => 
            movie.original_language === 'hi'
          );
          
          if (hindiMovies.length > 0) {
            data = {
              ...popularData,
              results: hindiMovies,
              total_results: hindiMovies.length,
              total_pages: Math.ceil(hindiMovies.length / 20)
            };
            console.log(`Bollywood popular: Got ${hindiMovies.length} Hindi movies from popular endpoint`);
          }
        }
      } catch (popularError) {
        console.log('Bollywood popular: Popular endpoint also failed');
      }
    }
    
    // Final check - if still no results, return empty structure
    if (!data || !data.results || data.results.length === 0) {
      console.log('Bollywood popular: No results found, returning empty');
      data = {
        page: page,
        results: [],
        total_pages: 0,
        total_results: 0
      };
    } else {
      // Only cache if we have results
      await MovieCache.setCached(cacheKey, data, 7200);
      console.log(`Bollywood popular: Success! Caching ${data.results.length} results`);
    }
    
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (error) {
    console.error('Bollywood endpoint error:', error.message);
    const staleCache = await MovieCache.findOne({ cacheKey });
    if (staleCache && staleCache.data && staleCache.data.results && staleCache.data.results.length > 0) {
      res.setHeader('X-Cache', 'STALE');
      return res.json(staleCache.data);
    }
    throw error;
  }
}));

/**
 * Bollywood trending endpoint
 * GET /api/movies/bollywood/trending?page=1
 * Must come before the catch-all route
 */
router.get('/bollywood/trending', cacheMiddleware(3600), asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  
  // Use a unique cache key for Bollywood trending to avoid conflicts
  const cacheKey = `bollywood_trending_${page}`;
  const cachedData = await MovieCache.getCached(cacheKey);
  
  // Only use cache if it has actual results (not empty arrays)
  if (cachedData && cachedData.results && Array.isArray(cachedData.results) && cachedData.results.length > 0) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cachedData);
  }
  
  try {
    // The issue: TMDB trending endpoint with filters returns empty results array
    // Solution: Fetch multiple pages of trending movies and filter for Hindi movies
    // Or use discover endpoint as primary source for Bollywood trending
    
    let data = null;
    let allHindiMovies = [];
    let currentPage = 1;
    const maxPagesToFetch = 5; // Fetch up to 5 pages to find Hindi movies
    
    // Strategy 1: Try to get Hindi movies from discover endpoint (more reliable)
    // Use ISO 639-1 language code (hi) with ISO 3166-1 country code (IN) format: hi-IN
    console.log('Bollywood trending: Trying discover endpoint first...');
    const discoverParams = {
      with_original_language: 'hi',
      language: 'hi-IN', // Use language-country format for better localization
      sort_by: 'popularity.desc',
      'vote_count.gte': 5,
      page: page
    };
    
    try {
      const discoverResponse = await circuitBreaker.execute(() =>
        retryWithBackoff(() => makeRequest('/discover/movie', discoverParams))
      );
      
      const discoverData = discoverResponse.data;
      console.log('Bollywood trending: Discover response:', {
        hasResults: !!discoverData?.results,
        resultsLength: discoverData?.results?.length || 0,
        totalResults: discoverData?.total_results,
        totalPages: discoverData?.total_pages
      });
      
      // Check if we got actual results (not just empty array with total_results > 0)
      if (discoverData && discoverData.results && Array.isArray(discoverData.results) && discoverData.results.length > 0) {
        data = discoverData;
        console.log(`Bollywood trending: Got ${discoverData.results.length} results from discover endpoint`);
      } else {
        console.log('Bollywood trending: Discover endpoint returned empty results array (TMDB API quirk)');
      }
    } catch (discoverError) {
      console.log('Bollywood trending: Discover endpoint failed, trying trending endpoint...');
    }
    
    // Strategy 2: If discover didn't work, try fetching trending movies and filtering
    if (!data || !data.results || data.results.length === 0) {
      console.log('Bollywood trending: Fetching trending movies and filtering...');
      while (currentPage <= maxPagesToFetch && allHindiMovies.length < 20) {
        const trendingParams = { page: currentPage };
        const trendingResponse = await circuitBreaker.execute(() =>
          retryWithBackoff(() => makeRequest('/trending/movie/day', trendingParams))
        );
        
        const trendingData = trendingResponse.data;
        console.log(`Bollywood trending: Page ${currentPage} - Got ${trendingData?.results?.length || 0} trending movies`);
        
        if (trendingData && trendingData.results && Array.isArray(trendingData.results) && trendingData.results.length > 0) {
          const hindiMovies = trendingData.results.filter(movie => 
            movie.original_language === 'hi' || 
            (movie.origin_country && Array.isArray(movie.origin_country) && movie.origin_country.includes('IN')) ||
            (movie.production_countries && Array.isArray(movie.production_countries) && 
             movie.production_countries.some(country => country.iso_3166_1 === 'IN'))
          );
          
          allHindiMovies = [...allHindiMovies, ...hindiMovies];
          console.log(`Bollywood trending: Page ${currentPage} - Found ${hindiMovies.length} Hindi movies (total: ${allHindiMovies.length})`);
          
          // If we have enough results or no more pages, break
          if (allHindiMovies.length >= 20 || currentPage >= (trendingData.total_pages || 1)) {
            break;
          }
        } else {
          console.log(`Bollywood trending: Page ${currentPage} - No results, stopping`);
          break;
        }
        currentPage++;
      }
      
      if (allHindiMovies.length > 0) {
        // Take only the requested page's worth of results
        const startIndex = (page - 1) * 20;
        const endIndex = startIndex + 20;
        data = {
          page: page,
          results: allHindiMovies.slice(startIndex, endIndex),
          total_pages: Math.ceil(allHindiMovies.length / 20),
          total_results: allHindiMovies.length
        };
        console.log(`Bollywood trending: Returning ${data.results.length} Hindi movies from ${allHindiMovies.length} total`);
      }
    }
    
    // If we still don't have results, return empty structure
    if (!data || !data.results || data.results.length === 0) {
      console.log('Bollywood trending: All strategies failed, returning empty results');
      console.log('Bollywood trending: This might be due to TMDB API returning empty arrays even when total_results > 0');
      console.log('Bollywood trending: Try clearing the cache or wait for cache to expire');
      data = {
        page: page,
        results: [],
        total_pages: 0,
        total_results: 0
      };
      // DO NOT cache empty results - this prevents the issue from persisting
    } else {
      // Only cache if we have actual results
      console.log(`Bollywood trending: Caching ${data.results.length} results`);
      await MovieCache.setCached(cacheKey, data, 3600);
    }
    
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (error) {
    console.error('Bollywood trending endpoint error:', error);
    const staleCache = await MovieCache.findOne({ cacheKey });
    // Only return stale cache if it has actual results
    if (staleCache && staleCache.data && staleCache.data.results && Array.isArray(staleCache.data.results) && staleCache.data.results.length > 0) {
      res.setHeader('X-Cache', 'STALE');
      return res.json(staleCache.data);
    }
    throw error;
  }
}));

/**
 * Generic proxy endpoint for TMDB API
 * GET /api/movies/* - Proxies to TMDB API with caching
 * Must be last to catch all other routes
 */
router.get('*', cacheMiddleware(), asyncHandler(async (req, res) => {
  // Remove leading slash and use path as-is (router is mounted at /api/movies)
  const tmdbPath = req.path.startsWith('/') ? req.path : `/${req.path}`;
  const params = req.query;
  
  // Get TTL for this endpoint
  const ttl = getTTLForEndpoint(tmdbPath);
  
  // Check cache first
  const cacheKey = generateCacheKey(tmdbPath, params);
  const cachedData = await MovieCache.getCached(cacheKey);
  
  if (cachedData) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', `public, max-age=${ttl}`);
    return res.json(cachedData);
  }
  
  // Make request with circuit breaker and retry logic
  try {
    const response = await circuitBreaker.execute(() => 
      retryWithBackoff(() => makeRequest(tmdbPath, params))
    );
    
    const data = response.data;
    
    // Cache the response
    await MovieCache.setCached(cacheKey, data, ttl);
    
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', `public, max-age=${ttl}`);
    res.json(data);
  } catch (error) {
    // Try to return cached data even if expired on error
    const staleCache = await MovieCache.findOne({ cacheKey });
    if (staleCache) {
      res.setHeader('X-Cache', 'STALE');
      return res.json(staleCache.data);
    }
    throw error;
  }
}));

module.exports = router;

