const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  category: { type: String, enum: ['cosmetic', 'supplement'], required: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  imageUrl: { type: String, default: '' },
  description: { type: String },
  ingredients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' }]
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);