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
const User = require('./models/userModel');
const path = require('path');
const crypto = require('crypto');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// CORS Configuration
app.use(cors({
  origin: ['https://movies.godcraft.fun', 'http://localhost:5173'],
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
  res.setHeader("Content-Security-Policy", `script-src 'self' 'nonce-${res.locals.nonce}'`);
  next();
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://movies-backend-07f5.onrender.com/auth/google/callback",
  successRedirect: 'https://movies.godcraft.fun/profile',
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

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Routers
app.use('/', userRouter);

// Start Server
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
