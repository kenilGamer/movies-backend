const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
mongoose.connect('mongodb+srv://kenilk677:KgbYiGyRpp7HS4cB@cluster0.lziadv4.mongodb.net/movie-app').then(() => {
    console.log('Connected to MongoDB');
  }).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
  
  
  const userSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: function() {
        return !this.googleId; // Only require email if it's not a Google user
      },
      unique: true,
      lowercase: true,
      trim: true,
    },
    age: {
      type: Number,
      required: function() {
        return !this.googleId; // Only require age if it's not a Google user
      },
      min: 16,
      max: 100,
    },
    avatar: {
      type: String,
      default: null,
    },
    token: {
      type: String,
    },
    googleProfile: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      required: true,
      min: 5,
      max: 200,
    },
    googleId: {
      type: String,
    },
    // Other fields here
  });
  

  module.exports = mongoose.model('User', userSchema); 