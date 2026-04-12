const Product = require('../models/Product');
const Brand = require('../models/Brand');
const Ingredient = require('../models/Ingredient');

exports.getHome = async (req, res) => {
  const products = await Product.find().populate('brand').populate('ingredients');
  const brands = await Brand.find();
  const ingredients = await Ingredient.find();
  res.render('index', { products, brands, ingredients, filters: {} });
};

exports.filterProducts = async (req, res) => {
  const query = {};
  if (req.query.brands) {
    query.brand = { $in: req.query.brands.split(',') };
  }
  if (req.query.ingredients) {
    query.ingredients = { $all: req.query.ingredients.split(',') };
  }
  const products = await Product.find(query).populate('brand').populate('ingredients');
  res.json(products);
};
