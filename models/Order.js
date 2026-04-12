const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number
  }],
  pickupTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'ready', 'completed'], default: 'pending' },
  totalAmount: Number,
  discount: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
  discountAmount: { type: Number, default: 0 },
  pointsRedeemed: { type: Number, default: 0 },
  phone: { type: String, required: true },
  trackingCode: { type: String, unique: true, default: () => '4BAX-' + Math.random().toString(36).substring(2, 10).toUpperCase() }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);