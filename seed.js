require('dotenv').config();
const mongoose = require('mongoose');
const Brand = require('./models/Brand');
const Ingredient = require('./models/Ingredient');
const Product = require('./models/Product');

const seedDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Product.deleteMany({});
  await Brand.deleteMany({});
  await Ingredient.deleteMany({});

  // Create brands
  const brands = await Brand.insertMany([
    { name: 'GlowLab', description: 'Skincare brand' },
    { name: 'HealthFirst', description: 'Supplements' },
    { name: 'PureNature', description: 'Natural cosmetics' }
  ]);

  // Create ingredients
  const ingredients = await Ingredient.insertMany([
    { name: 'Vitamin C' },
    { name: 'Hyaluronic Acid' },
    { name: 'Retinol' },
    { name: 'Omega-3' },
    { name: 'Magnesium' }
  ]);

  // Create products
  await Product.insertMany([
    {
      name: 'Vitamin C Serum',
      brand: brands[0]._id,
      category: 'cosmetic',
      price: 29.99,
      stock: 50,
      description: 'Brightening serum',
      ingredients: [ingredients[0]._id, ingredients[1]._id]
    },
    {
      name: 'Omega-3 Fish Oil',
      brand: brands[1]._id,
      category: 'supplement',
      price: 19.99,
      stock: 100,
      description: 'Heart health',
      ingredients: [ingredients[3]._id]
    },
    {
      name: 'Retinol Cream',
      brand: brands[2]._id,
      category: 'cosmetic',
      price: 34.99,
      stock: 30,
      description: 'Anti-aging',
      ingredients: [ingredients[2]._id]
    }
  ]);

  console.log('Database seeded!');
  process.exit();
};

seedDB();
