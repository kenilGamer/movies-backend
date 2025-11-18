const express = require('express');
const router = express.Router();
const Collection = require('../models/collectionModel');
const userRouter = require('./userRouter');
const verifyToken = userRouter.verifyToken;
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get user's collections
 * GET /api/collections
 */
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const collections = await Collection.find({ userId })
    .sort({ updatedAt: -1 });
  res.json({ collections });
}));

/**
 * Get a specific collection
 * GET /api/collections/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const collection = await Collection.findById(id)
    .populate('userId', 'username avatar');

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  // Check if collection is public or belongs to user
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!collection.isPublic && (!token || collection.userId._id.toString() !== req.user?.userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ collection });
}));

/**
 * Create a new collection
 * POST /api/collections
 */
router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { name, description, isPublic } = req.body;
  const userId = req.user.userId;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Collection name is required' });
  }

  const collection = new Collection({
    name: name.trim(),
    description: description || '',
    userId,
    isPublic: isPublic || false,
    items: []
  });

  await collection.save();
  res.status(201).json({ message: 'Collection created', collection });
}));

/**
 * Update a collection
 * PUT /api/collections/:id
 */
router.put('/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isPublic } = req.body;
  const userId = req.user.userId;

  const collection = await Collection.findById(id);

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  if (collection.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to update this collection' });
  }

  if (name !== undefined) {
    if (name.trim().length === 0) {
      return res.status(400).json({ error: 'Collection name cannot be empty' });
    }
    collection.name = name.trim();
  }

  if (description !== undefined) {
    collection.description = description;
  }

  if (isPublic !== undefined) {
    collection.isPublic = isPublic;
  }

  await collection.save();
  res.json({ message: 'Collection updated', collection });
}));

/**
 * Delete a collection
 * DELETE /api/collections/:id
 */
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const collection = await Collection.findById(id);

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  if (collection.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this collection' });
  }

  await Collection.findByIdAndDelete(id);
  res.json({ message: 'Collection deleted' });
}));

/**
 * Add item to collection
 * POST /api/collections/:id/items
 */
router.post('/:id/items', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { movieId, mediaType } = req.body;
  const userId = req.user.userId;

  if (!movieId || !mediaType) {
    return res.status(400).json({ error: 'movieId and mediaType are required' });
  }

  const collection = await Collection.findById(id);

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  if (collection.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to modify this collection' });
  }

  // Check if item already exists
  const exists = collection.items.some(
    item => item.movieId === movieId && item.mediaType === mediaType
  );

  if (exists) {
    return res.status(400).json({ error: 'Item already in collection' });
  }

  collection.items.push({ movieId, mediaType, addedAt: new Date() });
  await collection.save();

  res.json({ message: 'Item added to collection', collection });
}));

/**
 * Remove item from collection
 * DELETE /api/collections/:id/items/:movieId/:mediaType
 */
router.delete('/:id/items/:movieId/:mediaType', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { movieId, mediaType } = req.params;
  const userId = req.user.userId;

  const collection = await Collection.findById(id);

  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  if (collection.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized to modify this collection' });
  }

  collection.items = collection.items.filter(
    item => !(item.movieId == movieId && item.mediaType === mediaType)
  );

  await collection.save();
  res.json({ message: 'Item removed from collection', collection });
}));

module.exports = router;

