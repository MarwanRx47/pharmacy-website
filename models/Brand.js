const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  logoUrl: { type: String, default: '' },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);