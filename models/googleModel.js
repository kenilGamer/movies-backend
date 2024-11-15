const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://kenilk677:KgbYiGyRpp7HS4cB@cluster0.lziadv4.mongodb.net/movie-app').then(() => {
    console.log('Connected to MongoDB');
  }).catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
  
const googleSchema = new mongoose.Schema({
    googleId: String,
    username: String,
    avatar: String,
    email: String,
    password: String,
});

module.exports = mongoose.model('Google', googleSchema);