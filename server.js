require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./config/db');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { i18nMiddleware } = require('./middleware/i18n');

const app = express();

// Database connection and default admin creation
const initServer = async () => {
  await connectDB();

  const adminEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
    : [];
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

  for (const email of adminEmails) {
    const existing = await User.findOne({ email });
    if (!existing) {
      const hashed = await bcrypt.hash(defaultPassword, 10);
      await User.create({
        email,
        password: hashed,
        name: email.split('@')[0],
        isAdmin: true
      });
      console.log(`✅ Created admin: ${email} (password: ${defaultPassword})`);
    }
  }
};

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

// Start server after DB and admin initialization
const PORT = process.env.PORT || 3000;
initServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  });