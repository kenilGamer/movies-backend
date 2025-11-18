const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['new_release', 'recommendation', 'collection_update', 'review', 'system'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  movieId: {
    type: Number,
    default: null
  },
  mediaType: {
    type: String,
    enum: ['movie', 'tv'],
    default: null
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Notification', notificationSchema);

