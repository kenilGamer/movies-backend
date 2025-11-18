const User = require('../models/userModel');
const { makeRequest } = require('./tmdbClient');
const { retryWithBackoff, circuitBreaker } = require('./retryHandler');

/**
 * Get personalized recommendations for a user
 */
async function getPersonalizedRecommendations(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { recommendations: [], reason: 'User not found' };
    }

    const recommendations = [];
    const seenIds = new Set();

    // Strategy 1: Based on favorites
    if (user.favorites && user.favorites.length > 0) {
      const favoriteGenres = new Set();
      
      // Get genres from favorite movies/TV
      for (const favorite of user.favorites.slice(0, 5)) {
        try {
          const response = await circuitBreaker.execute(() =>
            retryWithBackoff(() => makeRequest(`/${favorite.mediaType}/${favorite.movieId}`))
          );
          
          if (response.data.genres) {
            response.data.genres.forEach(genre => favoriteGenres.add(genre.id));
          }
        } catch (error) {
          console.error(`Error fetching favorite ${favorite.movieId}:`, error);
        }
      }

      // Get recommendations based on favorite genres
      if (favoriteGenres.size > 0) {
        try {
          const genreIds = Array.from(favoriteGenres).slice(0, 3).join(',');
          const response = await circuitBreaker.execute(() =>
            retryWithBackoff(() => makeRequest('/discover/movie', {
              with_genres: genreIds,
              sort_by: 'popularity.desc',
              page: 1
            }))
          );
          
          if (response.data.results) {
            response.data.results.slice(0, 10).forEach(item => {
              if (!seenIds.has(item.id)) {
                recommendations.push(item);
                seenIds.add(item.id);
              }
            });
          }
        } catch (error) {
          console.error('Error fetching genre-based recommendations:', error);
        }
      }

      // Get similar movies to favorites
      for (const favorite of user.favorites.slice(0, 3)) {
        try {
          const response = await circuitBreaker.execute(() =>
            retryWithBackoff(() => makeRequest(`/${favorite.mediaType}/${favorite.movieId}/similar`))
          );
          
          if (response.data.results) {
            response.data.results.slice(0, 5).forEach(item => {
              if (!seenIds.has(item.id)) {
                recommendations.push(item);
                seenIds.add(item.id);
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching similar to ${favorite.movieId}:`, error);
        }
      }
    }

    // Strategy 2: Based on watch history
    if (user.watchHistory && user.watchHistory.length > 0) {
      const watchedGenres = new Set();
      
      for (const watched of user.watchHistory.slice(0, 5)) {
        try {
          const response = await circuitBreaker.execute(() =>
            retryWithBackoff(() => makeRequest(`/${watched.mediaType}/${watched.movieId}`))
          );
          
          if (response.data.genres) {
            response.data.genres.forEach(genre => watchedGenres.add(genre.id));
          }
        } catch (error) {
          console.error(`Error fetching watched ${watched.movieId}:`, error);
        }
      }

      if (watchedGenres.size > 0) {
        try {
          const genreIds = Array.from(watchedGenres).slice(0, 3).join(',');
          const response = await circuitBreaker.execute(() =>
            retryWithBackoff(() => makeRequest('/discover/movie', {
              with_genres: genreIds,
              sort_by: 'vote_average.desc',
              'vote_count.gte': 100,
              page: 1
            }))
          );
          
          if (response.data.results) {
            response.data.results.slice(0, 10).forEach(item => {
              if (!seenIds.has(item.id)) {
                recommendations.push(item);
                seenIds.add(item.id);
              }
            });
          }
        } catch (error) {
          console.error('Error fetching watch history recommendations:', error);
        }
      }
    }

    // Strategy 3: Trending as fallback
    if (recommendations.length < 10) {
      try {
        const response = await circuitBreaker.execute(() =>
          retryWithBackoff(() => makeRequest('/trending/movie/day'))
        );
        
        if (response.data.results) {
          response.data.results.forEach(item => {
            if (!seenIds.has(item.id) && recommendations.length < 20) {
              recommendations.push(item);
              seenIds.add(item.id);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching trending recommendations:', error);
      }
    }

    return {
      recommendations: recommendations.slice(0, 20),
      reason: recommendations.length > 0 ? 'Based on your preferences' : 'Popular movies'
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return { recommendations: [], reason: 'Error generating recommendations' };
  }
}

module.exports = { getPersonalizedRecommendations };

