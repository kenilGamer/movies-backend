const express = require('express');
const router = express.Router();
const Notification = require('../models/notificationModel');
const userRouter = require('./userRouter');
const verifyToken = userRouter.verifyToken;
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get user's notifications
 * GET /api/notifications?unreadOnly=true&page=1&limit=20
 */
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const unreadOnly = req.query.unreadOnly === 'true';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const query = { userId };
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({ userId, read: false });

  res.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    unreadCount
  });
}));

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notification.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  notification.read = true;
  await notification.save();

  res.json({ message: 'Notification marked as read', notification });
}));

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
router.put('/read-all', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  await Notification.updateMany({ userId, read: false }, { read: true });

  res.json({ message: 'All notifications marked as read' });
}));

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notification.userId.toString() !== userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  await Notification.findByIdAndDelete(id);

  res.json({ message: 'Notification deleted' });
}));

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const unreadCount = await Notification.countDocuments({ userId, read: false });
  res.json({ unreadCount });
}));

module.exports = router;

