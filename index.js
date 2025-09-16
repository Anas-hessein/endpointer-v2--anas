const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Global connection promise
let cachedConnection = null;

// MongoDB Connection with caching for serverless
async function connectToDatabase() {
    if (cachedConnection) {
        return cachedConnection;
    }

    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI environment variable is not defined');
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is not defined');
        }

        const connection = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            bufferCommands: false,
            maxPoolSize: 1,
        });

        cachedConnection = connection;
        console.log("✅ Connected to MongoDB Atlas");
        return connection;
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        throw error;
    }
}

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

// Recipe Schema
const recipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    ingredients: [String],
    instructions: { type: String, required: true },
    cookingTime: Number,
    servings: Number,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Models (only create if they don't exist)
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    
    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Invalid token" });
        }
        req.user = user;
        next();
    });
};

// Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Recipe API",
            version: "1.0.0",
            description: "A comprehensive API for managing recipes with JWT authentication",
        },
        servers: [
            {
                url: "https://endpointers-anas.vercel.app",
                description: "Production server"
            },
            {
                url: "http://localhost:3000",
                description: "Development server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                }
            },
            schemas: {
                User: {
                    type: "object",
                    required: ["username", "password"],
                    properties: {
                        username: { type: "string", example: "johndoe" },
                        password: { type: "string", example: "password123" }
                    }
                },
                Recipe: {
                    type: "object",
                    required: ["title", "instructions"],
                    properties: {
                        title: { type: "string", example: "Chocolate Chip Cookies" },
                        ingredients: { 
                            type: "array", 
                            items: { type: "string" },
                            example: ["2 cups flour", "1 cup sugar", "1/2 cup butter"]
                        },
                        instructions: { type: "string", example: "Mix and bake at 350°F" },
                        cookingTime: { type: "number", example: 30 },
                        servings: { type: "number", example: 4 }
                    }
                }
            }
        },
        tags: [
            { name: "Authentication", description: "User authentication endpoints" },
            { name: "Recipes", description: "Recipe management endpoints" }
        ]
    },
    apis: [__filename]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Serve Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "🍳 Welcome to Recipe API",
        documentation: "/api-docs",
        health: "/health",
        version: "1.0.0"
    });
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 */
app.post("/auth/register", async (req, res) => {
    try {
        await connectToDatabase();
        
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        res.status(201).json({ 
            message: "User registered successfully", 
            userId: user._id 
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
app.post("/auth/login", async (req, res) => {
    try {
        await connectToDatabase();
        
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: "24h" }
        );

        res.json({ 
            token, 
            message: "Login successful",
            user: { id: user._id, username: user.username }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes:
 *   post:
 *     summary: Add a new recipe
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recipe'
 *     responses:
 *       201:
 *         description: Recipe created successfully
 *       401:
 *         description: Authentication required
 */
app.post("/recipes", authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        
        const { title, ingredients, instructions, cookingTime, servings } = req.body;

        if (!title || !instructions) {
            return res.status(400).json({ error: "Title and instructions are required" });
        }

        const recipe = new Recipe({
            title,
            ingredients: ingredients || [],
            instructions,
            cookingTime,
            servings,
            createdBy: req.user.userId
        });

        await recipe.save();
        res.status(201).json({ 
            message: "Recipe created successfully", 
            recipe 
        });
    } catch (error) {
        console.error("Create recipe error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Get all recipes
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of recipes
 */
app.get("/recipes", async (req, res) => {
    try {
        await connectToDatabase();
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Recipe.countDocuments();
        const recipes = await Recipe.find()
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            recipes,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Get recipes error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes/{id}:
 *   get:
 *     summary: Get recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe found
 *       404:
 *         description: Recipe not found
 */
app.get("/recipes/:id", async (req, res) => {
    try {
        await connectToDatabase();
        
        const recipe = await Recipe.findById(req.params.id).populate('createdBy', 'username');
        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }
        res.json(recipe);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }
        console.error("Get recipe error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes/{id}:
 *   put:
 *     summary: Update recipe by ID
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recipe'
 *     responses:
 *       200:
 *         description: Recipe updated
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Recipe not found
 */
app.put("/recipes/:id", authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        if (recipe.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ error: "Not authorized to update this recipe" });
        }

        const updatedRecipe = await Recipe.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        
        res.json({ 
            message: "Recipe updated successfully", 
            recipe: updatedRecipe 
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }
        console.error("Update recipe error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes/{id}:
 *   delete:
 *     summary: Delete recipe by ID
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe deleted
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Recipe not found
 */
app.delete("/recipes/:id", authenticateToken, async (req, res) => {
    try {
        await connectToDatabase();
        
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }

        if (recipe.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ error: "Not authorized to delete this recipe" });
        }

        await Recipe.findByIdAndDelete(req.params.id);
        res.json({ message: "Recipe deleted successfully" });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }
        console.error("Delete recipe error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Export for Vercel
module.exports = app;