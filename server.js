const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

const recipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    ingredients: [String],
    instructions: { type: String, required: true },
    cookingTime: Number,
    servings: Number,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Recipe = mongoose.model("Recipe", recipeSchema);

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

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Recipe API",
            version: "1.0.0",
            description: "A comprehensive API for managing recipes with JWT authentication",
            contact: {
                name: "API Support",
                email: "support@recipeapi.com"
            }
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server"
            },
            {
                url: "https://endpointers-anas.vercel.app",
                description: "Production server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Enter JWT token in format: Bearer <token>"
                }
            },
            schemas: {
                User: {
                    type: "object",
                    required: ["username", "password"],
                    properties: {
                        username: {
                            type: "string",
                            description: "Unique username",
                            example: "johndoe"
                        },
                        password: {
                            type: "string",
                            description: "User password (min 6 characters)",
                            example: "password123"
                        }
                    }
                },
                Recipe: {
                    type: "object",
                    required: ["title", "instructions"],
                    properties: {
                        title: {
                            type: "string",
                            description: "Recipe title",
                            example: "Chocolate Chip Cookies"
                        },
                        ingredients: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of ingredients",
                            example: ["2 cups flour", "1 cup sugar", "1/2 cup butter"]
                        },
                        instructions: {
                            type: "string",
                            description: "Cooking instructions",
                            example: "Mix ingredients and bake at 350°F for 12 minutes"
                        },
                        cookingTime: {
                            type: "number",
                            description: "Cooking time in minutes",
                            example: 30
                        },
                        servings: {
                            type: "number",
                            description: "Number of servings",
                            example: 4
                        }
                    }
                },
                Error: {
                    type: "object",
                    properties: {
                        error: {
                            type: "string",
                            description: "Error message"
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: "Authentication",
                description: "User authentication endpoints"
            },
            {
                name: "Recipes",
                description: "Recipe management endpoints"
            }
        ]
    },
    apis: ["./server.js"]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
    customSiteTitle: "Recipe API Documentation",
    customCss: '.swagger-ui .topbar { display: none }'
}));

app.get("/swagger.json", (req, res) => {
    res.json(swaggerDocs);
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Invalid input or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/auth/register", async (req, res) => {
    try {
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/auth/login", async (req, res) => {
    try {
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
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile (protected route)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *       401:
 *         description: Access token required
 *       403:
 *         description: Invalid token
 */
app.get("/auth/profile", authenticateToken, (req, res) => {
    res.json({ 
        message: "Profile accessed successfully", 
        user: { 
            id: req.user.userId, 
            username: req.user.username 
        } 
    });
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 recipe:
 *                   $ref: '#/components/schemas/Recipe'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Authentication required
 */
app.post("/recipes", authenticateToken, async (req, res) => {
    try {
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
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recipes per page
 *     responses:
 *       200:
 *         description: List of recipes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recipe'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
app.get("/recipes", async (req, res) => {
    try {
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
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
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
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Recipe retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: Recipe not found
 */
app.get("/recipes/:id", async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id).populate('createdBy', 'username');
        if (!recipe) {
            return res.status(404).json({ error: "Recipe not found" });
        }
        res.json(recipe);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid recipe ID" });
        }
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
 *         description: Recipe ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recipe'
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 *       403:
 *         description: Not authorized to update this recipe
 *       404:
 *         description: Recipe not found
 */
app.put("/recipes/:id", authenticateToken, async (req, res) => {
    try {
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
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 *       403:
 *         description: Not authorized to delete this recipe
 *       404:
 *         description: Recipe not found
 */
app.delete("/recipes/:id", authenticateToken, async (req, res) => {
    try {
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
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /recipes/user/{userId}:
 *   get:
 *     summary: Get recipes by user ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User recipes retrieved successfully
 *       404:
 *         description: User not found
 */
app.get("/recipes/user/:userId", async (req, res) => {
    try {
        const recipes = await Recipe.find({ createdBy: req.params.userId })
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });
        
        res.json(recipes);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});


app.get("/", (req, res) => {
    res.json({
        message: "🍳 Welcome to Recipe API",
        documentation: "/api-docs",
        endpoints: {
            auth: {
                register: "POST /auth/register",
                login: "POST /auth/login",
                profile: "GET /auth/profile"
            },
            recipes: {
                create: "POST /recipes",
                getAll: "GET /recipes",
                getById: "GET /recipes/:id",
                update: "PUT /recipes/:id",
                delete: "DELETE /recipes/:id",
                byUser: "GET /recipes/user/:userId"
            }
        }
    });
});


app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});


app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found" });
});


app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
});