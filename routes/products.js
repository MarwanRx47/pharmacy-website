const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Ingredient = require('../models/Ingredient');
const Discount = require('../models/Discount');

// Home page - show all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('brand').populate('ingredients');
    const brands = await Brand.find();
    const ingredients = await Ingredient.find();
    res.render('index', { products, brands, ingredients, filters: {} });
  } catch (err) {
    console.log(err);
    res.status(500).send('Server error');
  }
});

// Filter products by ingredients & brands (AJAX endpoint)
router.get('/api/filter', async (req, res) => {
  try {
    let query = {};
    if (req.query.brands) {
      const brandIds = req.query.brands.split(',');
      query.brand = { $in: brandIds };
    }
    if (req.query.ingredients) {
      const ingredientIds = req.query.ingredients.split(',');
      query.ingredients = { $all: ingredientIds }; // products that contain ALL selected ingredients
    }
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: 'i' };
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    
    const products = await Product.find(query)
      .populate('brand')
      .populate('ingredients')
      .skip(skip)
      .limit(limit);
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Show cart page
router.get('/cart', (req, res) => {
  res.render('cart', { cartItems: [] }); // We'll load cart via JS
});

// Track order by tracking code
router.get('/track', async (req, res) => {
  const { code } = req.query;
  let order = null;
  if (code) {
    const Order = require('../models/Order');
    order = await Order.findOne({ trackingCode: code.toUpperCase() }).populate('products.product');
  }
  res.render('track-order', { order, code });
});

// Create order (with stock validation & deduction)
router.post('/api/order', async (req, res) => {
  try {
    const { items, pickupTime, phone, discountId, pointsRedeemed } = req.body;
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Please login first' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // items = [{ productId, quantity }]
    // Validate stock for each item
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `${product.name} has only ${product.stock} in stock` });
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    for (let item of items) {
      const product = await Product.findById(item.productId);
      subtotal += product.price * item.quantity;
    }

    let discountAmount = 0;
    let discountRef = null;
    if (discountId) {
      const discount = await Discount.findById(discountId);
      if (!discount || !discount.active) return res.status(400).json({ error: 'Invalid discount code' });
      if (discount.expiresAt && discount.expiresAt < new Date()) return res.status(400).json({ error: 'Discount code expired' });
      if (discount.usageLimit && discount.usedCount >= discount.usageLimit) return res.status(400).json({ error: 'Discount code usage limit reached' });

      if (discount.type === 'percentage') {
        discountAmount = (subtotal * discount.value) / 100;
      } else {
        discountAmount = Math.min(discount.value, subtotal);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;
      discountRef = discount._id;
    }

    let redeemedPoints = 0;
    let pointsValue = 0;
    if (pointsRedeemed && Number(pointsRedeemed) > 0) {
      const allowedPoints = Math.min(user.loyaltyPoints, Number(pointsRedeemed));
      const remaining = subtotal - discountAmount;
      pointsValue = Math.min(Math.floor(allowedPoints / 100), Math.floor(remaining));
      redeemedPoints = pointsValue * 100;
    }

    const totalAmount = Math.round(Math.max(0, subtotal - discountAmount - pointsValue) * 100) / 100;

    // Deduct stock
    for (let item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
    }

    const Order = require('../models/Order');
    const order = new Order({
      user: req.session.userId,
      products: items.map(item => ({ product: item.productId, quantity: item.quantity })),
      pickupTime: new Date(pickupTime),
      status: 'pending',
      totalAmount,
      discount: discountRef,
      discountAmount,
      pointsRedeemed: redeemedPoints,
      phone: phone
    });
    await order.save();

    if (discountRef) {
      await Discount.findByIdAndUpdate(discountRef, { $inc: { usedCount: 1 } });
    }

    if (redeemedPoints > 0) {
      await User.findByIdAndUpdate(req.session.userId, { $inc: { loyaltyPoints: -redeemedPoints } });
    }

    const pointsEarned = Math.floor(totalAmount);
    if (pointsEarned > 0) {
      await User.findByIdAndUpdate(req.session.userId, { $inc: { loyaltyPoints: pointsEarned } });
    }

    if (user && user.email) {
      const { sendOrderConfirmationEmail } = require('../utils/email');
      sendOrderConfirmationEmail(user.email, order._id, items, totalAmount, pickupTime, phone);
    }

    res.json({ success: true, orderId: order._id, trackingCode: order.trackingCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Validate discount code
router.post('/api/validate-discount', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.json({ valid: false, message: 'Enter a discount code' });
    const discount = await Discount.findOne({ code: code.toUpperCase(), active: true });
    if (!discount) return res.json({ valid: false, message: 'Invalid code' });
    if (discount.expiresAt && discount.expiresAt < new Date()) return res.json({ valid: false, message: 'Code expired' });
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) return res.json({ valid: false, message: 'Usage limit reached' });

    let discountAmount = 0;
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = Math.min(discount.value, subtotal);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({ valid: true, discountAmount, message: `Discount applied: ${discount.value}${discount.type === 'percentage' ? '%' : '$'} off`, code: discount.code });
  } catch (err) {
    res.status(500).json({ valid: false, message: err.message });
  }
});

// Get user loyalty points
router.get('/api/user-points', async (req, res) => {
  try {
    if (!req.session.userId) return res.json({ points: 0 });
    const User = require('../models/User');
    const user = await User.findById(req.session.userId);
    res.json({ points: user ? user.loyaltyPoints : 0 });
  } catch (err) {
    res.status(500).json({ points: 0 });
  }
});

// Get one product by ID (for cart)
router.get('/api/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('brand').populate('ingredients');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer order history
router.get('/my-orders', async (req, res) => {
  if (!req.session.userId) return res.redirect('/auth/login');
  const Order = require('../models/Order');
  const orders = await Order.find({ user: req.session.userId })
    .populate('products.product')
    .sort({ createdAt: -1 });
  res.render('my-orders', { orders });
});

module.exports = router;