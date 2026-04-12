const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  const { userId, products, pickupTime, totalAmount } = req.body;
  const order = new Order({ user: userId, products, pickupTime, totalAmount });
  await order.save();
  res.status(201).json(order);
};

exports.getOrders = async (req, res) => {
  const orders = await Order.find().populate('user').populate('products.product');
  res.json(orders);
};
