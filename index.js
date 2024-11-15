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
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization','Access-Control-Allow-Origin'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
const crypto = require('crypto');
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", `script-src 'self' 'nonce-${res.locals.nonce}'`);
  next();
});
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback",  // Ensure this matches the URI in the Google Developer Console
},
async (accessToken, refreshToken, profile, cb) => {
  const user = await User.findOne({ googleId: profile.id });
  if (user) {
    return cb(null, user);
  } else {
    const newUser = new User({
      username: profile.displayName,
      googleId: profile.id
    });
    await newUser.save();
    return cb(null, newUser);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

  passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => done(err, user));
});


app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
app.use('/', userRouter);