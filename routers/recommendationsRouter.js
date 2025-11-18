const express = require('express');
const router = express.Router();
const userRouter = require('./userRouter');
const verifyToken = userRouter.verifyToken;
const { asyncHandler } = require('../middleware/errorHandler');
const { getPersonalizedRecommendations } = require('../utils/recommendationEngine');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

/**
 * Get personalized recommendations for the authenticated user
 * GET /api/recommendations
 */
router.get('/', verifyToken, cacheMiddleware(3600), asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const result = await getPersonalizedRecommendations(userId);
  res.json(result);
}));

module.exports = router;

