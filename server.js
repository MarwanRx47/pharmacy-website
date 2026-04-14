require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./config/db');
const { i18nMiddleware } = require('./middleware/i18n');

const app = express();

// Database connection
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set true if using https
}));
app.use(i18nMiddleware);

// Set app locals for footer and other shared data
app.locals.social = {
  facebook: process.env.FACEBOOK_URL || 'https://facebook.com/yourpage',
  whatsapp: process.env.WHATSAPP_URL || 'https://wa.me/1234567890',
  telegram: process.env.TELEGRAM_URL || 'https://t.me/yourchannel',
  phone: process.env.PHONE_NUMBER || '+123 456 7890',
  email: process.env.EMAIL_CONTACT || 'info@4baxpharmacy.com'
};

// Make user available in all views
app.use(async (req, res, next) => {
  if (req.session.userId) {
    const User = require('./models/User');
    const user = await User.findById(req.session.userId).select('-password');
    res.locals.user = user;
  } else {
    res.locals.user = null;
  }
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/products'));
app.use('/admin', require('./routes/admin'));
app.use('/auth', require('./routes/auth'));
app.use('/orders', require('./routes/orders'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});