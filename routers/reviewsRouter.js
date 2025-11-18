const express = require('express');
const router = express.Router();
const Review = require('../models/reviewModel');
const User = require('../models/userModel');
const userRouter = require('./userRouter');
const verifyToken = userRouter.verifyToken;
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get reviews for a movie/TV show
 * GET /api/reviews/movie/:movieId/:mediaType
 */
router.get('/:mediaType/:movieId', asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ movieId: parseInt(movieId), mediaType })
    .populate('userId', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ movieId: parseInt(movieId), mediaType });

  // Calculate average rating
  const avgRatingResult = await Review.aggregate([
    { $match: { movieId: parseInt(movieId), mediaType } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;
  const ratingCount = avgRatingResult.length > 0 ? avgRatingResult[0].count : 0;

  res.json({
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    averageRating: avgRating.toFixed(1),
    ratingCount
  });
}));

/**
 * Get user's review for a movie/TV show
 * GET /api/reviews/movie/:movieId/:mediaType/user
 */
router.get('/:mediaType/:movieId/user', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType } = req.params;
  const userId = req.user.userId;

  const review = await Review.findOne({ movieId: parseInt(movieId), mediaType, userId })
    .populate('userId', 'username avatar');

  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  res.json(review);
}));

/**
 * Create or update a review
 * POST /api/reviews
 */
router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { movieId, mediaType, rating, review } = req.body;
  const userId = req.user.userId;

  if (!movieId || !mediaType || rating === undefined) {
    return res.status(400).json({ error: 'movieId, mediaType, and rating are required' });
  }

  if (rating < 0 || rating > 10) {
    return res.status(400).json({ error: 'Rating must be between 0 and 10' });
  }

  // Check if review already exists
  let existingReview = await Review.findOne({ movieId: parseInt(movieId), mediaType, userId });

  if (existingReview) {
    // Update existing review
    existingReview.rating = rating;
    existingReview.review = review || '';
    existingReview.updatedAt = Date.now();
    await existingReview.save();
    await existingReview.populate('userId', 'username avatar');
    return res.json({ message: 'Review updated', review: existingReview });
  } else {
    // Create new review
    const newReview = new Review({
      movieId: parseInt(movieId),
      mediaType,
      userId,
      rating,
      review: review || ''
    });
    await newReview.save();
    await newReview.populate('userId', 'username avatar');
    return res.status(201).json({ message: 'Review created', review: newReview });
  }
}));

/**
 * Update a review
 * PUT /api/reviews/:reviewId
 */
router.put('/:reviewId', verifyToken, asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, review } = req.body;
  const userId = req.user.userId;

  const existingReview = await Review.findById(reviewId);

  if (!existingReview) {
    return res.status(404).json({ error: 'Review not found' });
  }

  if (existingReview.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to update this review' });
  }

  if (rating !== undefined) {
    if (rating < 0 || rating > 10) {
      return res.status(400).json({ error: 'Rating must be between 0 and 10' });
    }
    existingReview.rating = rating;
  }

  if (review !== undefined) {
    existingReview.review = review;
  }

  existingReview.updatedAt = Date.now();
  await existingReview.save();
  await existingReview.populate('userId', 'username avatar');

  res.json({ message: 'Review updated', review: existingReview });
}));

/**
 * Delete a review
 * DELETE /api/reviews/:reviewId
 */
router.delete('/:reviewId', verifyToken, asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.userId;

  const review = await Review.findById(reviewId);

  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  if (review.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this review' });
  }

  await Review.findByIdAndDelete(reviewId);

  res.json({ message: 'Review deleted' });
}));

/**
 * Get user's all reviews
 * GET /api/reviews/user/all
 */
router.get('/user/all', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Review.countDocuments({ userId });

  res.json({
    reviews,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

module.exports = router;

