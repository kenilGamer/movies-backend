const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  movieId: {
    type: Number,
    required: true,
    index: true
  },
  mediaType: {
    type: String,
    enum: ['movie', 'tv'],
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 0,
    max: 10
  },
  review: {
    type: String,
    maxlength: 5000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for unique user review per movie/TV
reviewSchema.index({ movieId: 1, mediaType: 1, userId: 1 }, { unique: true });

// Update updatedAt on save
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Review', reviewSchema);

