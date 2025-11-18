const mongoose = require('mongoose');

const movieCacheSchema = new mongoose.Schema({
  cacheKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to get cached data
movieCacheSchema.statics.getCached = async function(cacheKey) {
  const cached = await this.findOne({ 
    cacheKey,
    expiresAt: { $gt: new Date() }
  });
  return cached ? cached.data : null;
};

// Static method to set cached data
movieCacheSchema.statics.setCached = async function(cacheKey, data, ttlSeconds = 3600) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  
  await this.findOneAndUpdate(
    { cacheKey },
    { 
      data, 
      expiresAt,
      createdAt: new Date()
    },
    { 
      upsert: true, 
      new: true 
    }
  );
};

// Static method to clear expired cache
movieCacheSchema.statics.clearExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

const MovieCache = mongoose.model('MovieCache', movieCacheSchema);

module.exports = MovieCache;

