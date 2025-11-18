const express = require('express');
const app = express();
const port = 3000;
const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const session = require('express-session');
const axios = require('axios'); 
const multer = require('multer');
const upload = require('./Multer');
const cors = require('cors');
const localStrategy = require('passport-local').Strategy;
const userRouter = require('./routers/userRouter');
const movieRouter = require('./routers/movieRouter');
const User = require('./models/userModel');
const path = require('path');
const crypto = require('crypto');
const { errorHandler } = require('./middleware/errorHandler');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('MongoDB connected');
  }
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit on MongoDB connection failure
});

// CORS Configuration
app.use(cors({
  origin: ['https://movies.godcarft.fun', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
const MongoStore = require('connect-mongo');
const store = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,
  collectionName: 'sessions'
}); 

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false, 
  saveUninitialized: false, 
  cookie: { secure: process.env.NODE_ENV === 'production' },
  store: store,
  unset: 'destroy',
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Content Security Policy
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  
  // More permissive CSP for development, stricter for production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    // Development CSP - allows localhost connections for DevTools
    res.setHeader("Content-Security-Policy", 
      `default-src 'self'; ` +
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${res.locals.nonce}'; ` +
      `style-src 'self' 'unsafe-inline'; ` +
      `img-src 'self' data: https:; ` +
      `font-src 'self' data:; ` +
      `connect-src 'self' http://localhost:* https://localhost:* ws://localhost:* wss://localhost:* https://api.themoviedb.org https://*.googleapis.com https://*.google.com; ` +
      `frame-src 'self' https://*.google.com; ` +
      `object-src 'none'; ` +
      `base-uri 'self'; ` +
      `form-action 'self';`
    );
  } else {
    // Production CSP - stricter security
    res.setHeader("Content-Security-Policy", 
      `default-src 'self'; ` +
      `script-src 'self' 'nonce-${res.locals.nonce}'; ` +
      `style-src 'self' 'unsafe-inline'; ` +
      `img-src 'self' data: https://image.tmdb.org https://*.googleusercontent.com; ` +
      `font-src 'self' data:; ` +
      `connect-src 'self' https://api.themoviedb.org https://*.googleapis.com https://*.google.com; ` +
      `frame-src 'self' https://*.google.com; ` +
      `object-src 'none'; ` +
      `base-uri 'self'; ` +
      `form-action 'self';`
    );
  }
  
  next();
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.production === 'production' ? "https://movies-backend-07f5.onrender.com/auth/google/callback" : "http://localhost:3000/auth/google/callback",
  successRedirect: process.env.production === 'production' ? 'https://movies.godcarft.fun/' : 'http://localhost:5173/',
  failureRedirect: '/login',
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    const user = await User.findOne({ googleId: profile.id });
    if (user) {
      return cb(null, user);
    } else {
      const newUser = new User({
        username: profile.displayName,
        googleId: profile.id,
      });
      await newUser.save();
      return cb(null, newUser);
    }
  } catch (err) {
    return cb(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => done(err, user));
});

// Routers
app.use('/', userRouter);
app.use('/api/movies', movieRouter);
app.use('/api/user', require('./routers/watchlistRouter'));
app.use('/api/search', require('./routers/searchRouter'));
app.use('/api/discover', require('./routers/discoverRouter'));
app.use('/api/reviews', require('./routers/reviewsRouter'));
app.use('/api/collections', require('./routers/collectionsRouter'));
app.use('/api/recommendations', require('./routers/recommendationsRouter'));
app.use('/api/notifications', require('./routers/notificationsRouter'));

// Error Handling Middleware (must be last)
app.use(errorHandler);

// Start Server
const server = app.listen(process.env.PORT || port, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Server started on port ${process.env.PORT || port}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
