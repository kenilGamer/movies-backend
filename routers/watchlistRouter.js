const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const userRouter = require('./userRouter');
const verifyToken = userRouter.verifyToken;
const { asyncHandler } = require('../middleware/errorHandler');

// Get user's watchlist
router.get('/watchlist', verifyToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('watchlist');
  res.json({ watchlist: user.watchlist || [] });
}));

// Add to watchlist
router.post('/watchlist', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.body;
  
  if (!movieId || !mediaType) {
    return res.status(400).json({ error: 'movieId and mediaType are required' });
  }

  const user = await User.findById(req.user.userId);
  
  // Check if already in watchlist
  const exists = user.watchlist.some(
    item => item.movieId === movieId && item.mediaType === mediaType
  );

  if (exists) {
    return res.status(400).json({ error: 'Item already in watchlist' });
  }

  user.watchlist.push({ movieId, mediaType, addedAt: new Date() });
  await user.save();

  res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
}));

// Remove from watchlist
router.delete('/watchlist/:movieId/:mediaType', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.params;
  
  const user = await User.findById(req.user.userId);
  user.watchlist = user.watchlist.filter(
    item => !(item.movieId == movieId && item.mediaType === mediaType)
  );
  await user.save();

  res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
}));

// Get user's favorites
router.get('/favorites', verifyToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('favorites');
  res.json({ favorites: user.favorites || [] });
}));

// Add to favorites
router.post('/favorites', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.body;
  
  if (!movieId || !mediaType) {
    return res.status(400).json({ error: 'movieId and mediaType are required' });
  }

  const user = await User.findById(req.user.userId);
  
  // Check if already in favorites
  const exists = user.favorites.some(
    item => item.movieId === movieId && item.mediaType === mediaType
  );

  if (exists) {
    return res.status(400).json({ error: 'Item already in favorites' });
  }

  user.favorites.push({ movieId, mediaType, addedAt: new Date() });
  await user.save();

  res.json({ message: 'Added to favorites', favorites: user.favorites });
}));

// Remove from favorites
router.delete('/favorites/:movieId/:mediaType', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.params;
  
  const user = await User.findById(req.user.userId);
  user.favorites = user.favorites.filter(
    item => !(item.movieId == movieId && item.mediaType === mediaType)
  );
  await user.save();

  res.json({ message: 'Removed from favorites', favorites: user.favorites });
}));

// Check if item is in watchlist/favorites
router.get('/check/:movieId/:mediaType', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.params;
  
  const user = await User.findById(req.user.userId).select('watchlist favorites');
  
  const inWatchlist = user.watchlist.some(
    item => item.movieId == movieId && item.mediaType === mediaType
  );
  
  const inFavorites = user.favorites.some(
    item => item.movieId == movieId && item.mediaType === mediaType
  );

  res.json({ inWatchlist, inFavorites });
}));

module.exports = router;

