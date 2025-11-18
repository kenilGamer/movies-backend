const axios = require('axios');

// TMDB API Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// Use environment variable or fallback to the existing token
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.TMDB_BEARER_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZmM5MDA4OWUyMjc4OTBlYjkyYjVhMTZhNWJiOTUxZCIsInN1YiI6IjY1ZjQxMGRkMjkzODM1MDE0YTI3ZWJhYyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.aWEJgRAdxjCmTVDir3h8MSKdsBEe7-1tKJzbIdFQIzI';

// Create axios instance for TMDB API
const tmdbClient = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TMDB_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Request deduplication map
const pendingRequests = new Map();

// Generate cache key from request
const generateCacheKey = (url, params) => {
  const sortedParams = Object.keys(params || {})
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${url}${sortedParams ? '?' + sortedParams : ''}`;
};

// Make request with deduplication
const makeRequest = async (url, params = {}) => {
  const cacheKey = generateCacheKey(url, params);
  
  // Check if request is already pending
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // Create new request promise
  const requestPromise = tmdbClient.get(url, { params })
    .then(response => {
      pendingRequests.delete(cacheKey);
      return response;
    })
    .catch(error => {
      pendingRequests.delete(cacheKey);
      throw error;
    });

  // Store pending request
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
};

module.exports = {
  tmdbClient,
  makeRequest,
  generateCacheKey
};

