const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const nodemailer = require('nodemailer');
const upload = require('../Multer');
const axios = require('axios');
const googleModel = require('../models/googleModel');
router.post('/api/signup', upload.single('avatar'), async (req, res) => {
  const { username, email, age, password } = req.body;
  const avatar = req.file?.path.replace(/\\/g, '/'); // Normalize the file path

  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file);

  if (!avatar) {
    return res.status(400).send('Avatar is required');
  }

  // Validate password strength
  const validPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
  if (!validPassword) {
    return res.status(400).send(
      'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    );
  }

  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).send('Username or email already in use');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = new User({ username, email, age, password: hashedPassword, avatar, googleId: user._id});
    await user.save();

    // Optionally, generate a token
    const token = jwt.sign({ userId: user._id }, process.env.SESSION_SECRET, { expiresIn: '1d' });

    // Respond to the client
    res.status(201).send({ message: 'User created successfully', token });
    console.log(user);
  } catch (err) {
    console.error(err);
    res.status(500).send(`An error occurred while creating the user. Please try again. ${err}`);
  }
});

  router.post('/api/login', async (req, res) => {
    const { username , password } = req.body;
    console.log(username,password);
    try {
      // Check if the user exists first 
      const user = await User.findOne({ username });
      console.log(user);
      if (!user) {
        return res.status(401).send('Invalid username or password');
      }
  
      // Check if the password is correct
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log(isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).send('Invalid username or password');
      }
  
      // Generate JWT token after successful authentication
      // await User.findByIdAndUpdate(user._id, { token });
      const token = jwt.sign({ userId: user._id }, process.env.SESSION_SECRET, { expiresIn: '1d' });  // Secret from .env file

     
  
      // Respond with success message and token 
      res.status(200).send({ message: 'Logged in successfully', token, user });
  
    } catch (err) {
      console.error('Error logging in:', err);
      res.status(500).send(`Error logging in: ${err}`);
    }
  });
  
  // Middleware to verify the JWT token// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');  // Get the token from the Authorization header
  
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Verify the token using the same secret key
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);  // Ensure this is the same secret as used in signing
    req.user = decoded;  // Attach the user info to the request object
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(400).json({ msg: 'Token is not valid' });
  }
};

  
  
  
  // Profile route with authentication
  router.get('/profile', verifyToken, async (req, res) => {
    try {
      // Check for the user ID in the token
      const user = await User.findById(req.user.userId);  // Use the userId from the decoded token
      
      if (!user) {
        // If the user is not found, send an early response and return
        return res.status(404).json({ msg: 'User not found' });
      }
  
      // Send the user data only if no error
      res.json(user);
    } catch (error) {
      console.error('Error fetching user data:', error);
      
      // Ensure only one response is sent
      if (!res.headersSent) {  // Check if headers have been sent already
        res.status(500).json({ msg: 'Server error' });
      }
    }})
  
  
// Google Auth route
router.get('/auth/google', passport.authenticate('google', {
  scope: ['profile'],
}));

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  if (code) {
    try {
      // Exchange authorization code for access token
      const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
        params: { 
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: 'https://movies.godcraft.fun/auth/google/callback',
          grant_type: 'authorization_code',
        },
      });

      const accessToken = data.access_token;
      const profileData = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Find or create user based on Google profile
      let user = await User.findOne({ googleId: profileData.data.sub });
      if (!user) {
        const profileImage = profileData.data.picture;
        // const email = profileData.data.email || 'default@example.com'; // Provide default email if missing
        const username = profileData.data.name;
        const googleId = profileData.data.sub;
        
        // Create new user with Google profile data
        user = new User({
          username,
          googleId,
          googleProfile: profileImage,
          age: 18, // Default age if not provided
          password: googleId, // You may want to use a secure random value instead
        });
        await user.save();
        upload.single(user.avatar);
      }


      // Create JWT token for the user
      const token = jwt.sign({ userId: user._id }, process.env.SESSION_SECRET, { expiresIn: '1d' });

      // Redirect to frontend with the token
      res.redirect(`https://movies.godcraft.fun/login?token=${token}`);
      res.status(200).send({ message: 'Logged in successfully', token });
      
    } catch (error) {
      console.error('Error during token exchange:', error);
      return res.redirect('/error');
    }
  } else {
    return res.redirect('/');
  }
});

 

  router.post('/api/forgot-password', async (req, res) => {
    const { username } = req.body;
    try{
      const user = await User.findOne({ username });
      if (!user) return res.status(404).send('User not found');
   
    // Generate a reset token (you can use JWT or any other method)
    const resetToken = jwt.sign({ userId: user._id }, 'secretkey', { expiresIn: '1h' });
  
    // Send email with the reset link
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Use your email service
      auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS  // Your email password or app password
      }
    });
  
    const resetLink = `https://movies.godcraft.fun/reset-password/${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email, // Assuming email is the email
      subject: 'Password Reset',
      text: `Click the link to reset your password: ${resetLink}`
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).send('Error sending email');
      }
      res.send('Password reset link sent to your email');
    });
  }catch(err){
    console.error(err);
    res.status(500).send(`Error sending email: ${err}`);
  }
  });
  
  router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;
  
    try {
      const decoded = jwt.verify(token, 'secretkey');
      const user = await User.findById(decoded.userId);
      if (!user) return res.status(404).send('User not found');
  
      // Hash the new password and save it
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      res.send('Password has been reset');
    } catch (err) {
      res.status(400).send('Invalid or expired token');
    }
  });

  router.get('/api/protected-endpoint',verifyToken, async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
  
    if (!token) return res.status(401).json({ message: 'Unauthorized: Token missing' });
  
    try {
      const decoded = jwt.verify(token, process.env.SESSION_SECRET);
      const user = await User.findById(decoded.userId).select('-password'); // Exclude password
  
      if (!user) return res.status(401).json({ message: 'Unauthorized: User not found' });
  
      res.status(200).json(user);
    } catch (err) {
      console.error('Token verification error:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  router.get('/settings', verifyToken, async (req, res) => {
    const user = await User.findById(req.user.userId);
    res.send(user);
  });
 
  router.put('/settings',verifyToken,upload.single('avatar'), async (req, res) => {
      try {
        console.log(req.body);
        const { username, email, age } = req.body;
  
        // Build update object dynamically
        const updateData = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (age) updateData.age = age;
  
        // If avatar is uploaded, include it in the update
        if (req.file) {
          updateData.avatar = req.file.path.replace(/\\/g, '/'); // Normalize path
        }
  
        // Update the user document
        const user = await User.findByIdAndUpdate(
          req.user.userId,
          { $set: updateData },
          { new: true } // Return updated document
        );
  
        if (!user) {
          return res.status(404).send({ error: 'User not found' });
        }
  
        console.log(user);
        res.send(user);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Failed to update user' });
      }
    }
  );
  

  module.exports = router;