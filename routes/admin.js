const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Ingredient = require('../models/Ingredient');
const upload = require('../middleware/upload');

// Simple admin authentication middleware (dummy – improve later)
const isAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.redirect('/auth/login');
  }
  next();
};

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
  const products = await Product.find().populate('brand');
  res.render('admin/dashboard', { products });
});

// Show add product form
router.get('/add-product', isAdmin, async (req, res) => {
  const brands = await Brand.find();
  const ingredients = await Ingredient.find();
  res.render('admin/add-product', { brands, ingredients });
});

// Handle add product POST
router.post('/add-product', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, brand, category, price, stock, description, ingredients } = req.body;
    const newProduct = new Product({
      name,
      brand,
      category,
      price,
      stock,
      description,
      ingredients: Array.isArray(ingredients) ? ingredients : [ingredients],
      imageUrl: req.file ? '/uploads/' + req.file.filename : ''
    });
    await newProduct.save();
    res.redirect('/admin');
  } catch (err) {
    console.log(err);
    res.send('Error adding product');
  }
});

// Show edit product form
router.get('/edit-product/:id', isAdmin, async (req, res) => {
  const product = await Product.findById(req.params.id).populate('brand').populate('ingredients');
  const brands = await Brand.find();
  const ingredients = await Ingredient.find();
  res.render('admin/edit-product', { product, brands, ingredients });
});

// Handle edit product POST (with image upload)
router.post('/edit-product/:id', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, brand, category, price, stock, description, ingredients, removeImage } = req.body;
    const updateData = {
      name,
      brand,
      category,
      price,
      stock,
      description,
      ingredients: Array.isArray(ingredients) ? ingredients : [ingredients]
    };
    if (req.file) {
      updateData.imageUrl = '/uploads/' + req.file.filename;
    } else if (removeImage === '1') {
      updateData.imageUrl = '';
    }
    await Product.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin');
  } catch (err) {
    console.log(err);
    res.send('Error updating product');
  }
});

// List all orders
router.get('/orders', isAdmin, async (req, res) => {
  const Order = require('../models/Order');
  const orders = await Order.find().populate('user').populate('products.product');
  res.render('admin/orders', { orders });
});

// Update order status (ready for pickup)
router.post('/orders/update', isAdmin, async (req, res) => {
  const { orderId, status } = req.body;
  const Order = require('../models/Order');
  const order = await Order.findById(orderId).populate('user');
  if (status === 'ready' && order.status !== 'ready') {
    // send email
    const { sendOrderReadyEmail } = require('../utils/email');
    await sendOrderReadyEmail(order.user.email, orderId);
  }
  await Order.findByIdAndUpdate(orderId, { status });
  res.redirect('/admin/orders');
});

module.exports = router;