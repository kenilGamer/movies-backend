const MovieCache = require('../models/movieCacheModel');

/**
 * Cache middleware to check MongoDB cache before making API calls
 */
const cacheMiddleware = (ttlSeconds = 3600) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key from URL and query params
      const cacheKey = req.originalUrl || req.url;
      
      // Check cache
      const cachedData = await MovieCache.getCached(cacheKey);
      
      if (cachedData) {
        // Set cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        return res.json(cachedData);
      }
      
      // Cache miss - continue to route handler
      res.setHeader('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json.bind(res);
      
      // Override json method to cache response
      res.json = function(data) {
        // Cache the response
        MovieCache.setCached(cacheKey, data, ttlSeconds).catch(err => {
          console.error('Error caching response:', err);
        });
        
        // Call original json method
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue to route handler on cache error
      next();
    }
  };
};

/**
 * Get TTL based on endpoint type
 */
const getTTLForEndpoint = (url) => {
  // Longer cache for popular/trending (1 hour)
  if (url.includes('/popular') || url.includes('/trending')) {
    return 3600;
  }
  
  // Very long cache for movie details (24 hours)
  if (url.match(/\/movie\/\d+$/) || url.match(/\/tv\/\d+$/)) {
    return 86400;
  }
  
  // Medium cache for lists (30 minutes)
  if (url.includes('/movie/') || url.includes('/tv/')) {
    return 1800;
  }
  
  // Default 1 hour
  return 3600;
};

module.exports = {
  cacheMiddleware,
  getTTLForEndpoint
};

