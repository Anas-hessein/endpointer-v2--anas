// api/index.js - Main API handler for Vercel
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Initialize CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Global connection cache
let cachedConnection = null;

// Connect to MongoDB with caching
async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined');
    }

    const connection = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    cachedConnection = connection;
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Recipe Schema
const RecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  ingredients: [String],
  instructions: { type: String, required: true },
  cookingTime: Number,
  servings: Number,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema);

// Auth middleware
const authenticateToken = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new Error('Access token required');
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return user;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// CORS middleware
function runCors(req, res) {
  return new Promise((resolve, reject) => {
    const corsMiddleware = cors(corsOptions);
    corsMiddleware(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Main handler
export default async function handler(req, res) {
  try {
    // Handle CORS
    await runCors(req, res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { method, url } = req;
    const urlPath = new URL(url, `http://${req.headers.host}`).pathname;

    console.log(`${method} ${urlPath}`);

    // Root endpoint
    if (method === 'GET' && urlPath === '/') {
      return res.status(200).json({
        message: '🍳 Welcome to Recipe API',
        endpoints: {
          health: 'GET /api/health',
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          recipes: 'GET /api/recipes',
          createRecipe: 'POST /api/recipes'
        }
      });
    }

    // Health check
    if (method === 'GET' && urlPath === '/api/health') {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      });
    }

    // Connect to database for all other routes
    await connectToDatabase();

    // Register endpoint
    if (method === 'POST' && urlPath === '/api/auth/register') {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = new User({ username, password: hashedPassword });
      await user.save();

      return res.status(201).json({
        message: 'User registered successfully',
        userId: user._id
      });
    }

    // Login endpoint
    if (method === 'POST' && urlPath === '/api/auth/login') {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        token,
        message: 'Login successful',
        user: { id: user._id, username: user.username }
      });
    }

    // Get all recipes
    if (method === 'GET' && urlPath === '/api/recipes') {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const total = await Recipe.countDocuments();
      const recipes = await Recipe.find()
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return res.status(200).json({
        recipes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }

    // Create recipe
    if (method === 'POST' && urlPath === '/api/recipes') {
      const user = authenticateToken(req);
      const { title, ingredients, instructions, cookingTime, servings } = req.body;

      if (!title || !instructions) {
        return res.status(400).json({ error: 'Title and instructions are required' });
      }

      const recipe = new Recipe({
        title,
        ingredients: ingredients || [],
        instructions,
        cookingTime,
        servings,
        createdBy: user.userId
      });

      await recipe.save();

      return res.status(201).json({
        message: 'Recipe created successfully',
        recipe
      });
    }

    // Get recipe by ID
    if (method === 'GET' && urlPath.startsWith('/api/recipes/')) {
      const id = urlPath.split('/')[3];
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid recipe ID' });
      }

      const recipe = await Recipe.findById(id).populate('createdBy', 'username');
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      return res.status(200).json(recipe);
    }

    // Update recipe
    if (method === 'PUT' && urlPath.startsWith('/api/recipes/')) {
      const user = authenticateToken(req);
      const id = urlPath.split('/')[3];

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid recipe ID' });
      }

      const recipe = await Recipe.findById(id);
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      if (recipe.createdBy.toString() !== user.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const updatedRecipe = await Recipe.findByIdAndUpdate(id, req.body, { new: true });
      
      return res.status(200).json({
        message: 'Recipe updated successfully',
        recipe: updatedRecipe
      });
    }

    // Delete recipe
    if (method === 'DELETE' && urlPath.startsWith('/api/recipes/')) {
      const user = authenticateToken(req);
      const id = urlPath.split('/')[3];

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid recipe ID' });
      }

      const recipe = await Recipe.findById(id);
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      if (recipe.createdBy.toString() !== user.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await Recipe.findByIdAndDelete(id);
      
      return res.status(200).json({
        message: 'Recipe deleted successfully'
      });
    }

    // Route not found
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('API Error:', error);
    
    if (error.message === 'Access token required' || error.message === 'Invalid token') {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}