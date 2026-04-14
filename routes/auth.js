require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Login page
router.get('/login', (req, res) => {
  res.render('login');
});

// Handle login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    req.session.isAdmin = user.isAdmin;
    if (user.isAdmin) return res.redirect('/admin');
    else return res.redirect('/');
  }
  res.send('Invalid credentials');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

router.post('/set-lang', (req, res) => {
  const { lang } = req.body;
  if (lang && ['en', 'ar', 'ckb'].includes(lang)) {
    req.session.lang = lang;
    res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
  }
  res.json({ success: true });
});

// Simple registration (for admin creation – you can run once)
router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.send('Email already registered');
  }

  const hashed = await bcrypt.hash(password, 10);
  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];
  const isAdmin = adminEmails.includes(email.trim().toLowerCase());

  const user = new User({ email, password: hashed, name, isAdmin });
  await user.save();
  res.redirect('/auth/login');
});

module.exports = router;