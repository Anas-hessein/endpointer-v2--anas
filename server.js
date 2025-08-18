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

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

const recipeSchema = new mongoose.Schema({
    title: String,
    ingredients: [String],
    instructions: String
});
const Recipe = mongoose.model("Recipe", recipeSchema);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 */
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    res.json({ message: `User ${username} registered!` });
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Returns a JWT token
 */
app.post("/login", (req, res) => {
    const { username } = req.body;
    const user = { name: username };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

/**
 * @swagger
 * /protected:
 *   get:
 *     summary: Access a protected route
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Protected route accessed
 */
app.get("/protected", authenticateToken, (req, res) => {
    res.json({ message: "Welcome to the protected route!", user: req.user });
});

/**
 * @swagger
 * /recipes:
 *   post:
 *     summary: Add a new recipe
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: Recipe added successfully
 */
app.post("/recipes", async (req, res) => {
    const recipe = new Recipe(req.body);
    await recipe.save();
    res.json({ message: "Recipe added!" });
});

/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Get all recipes
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: List of all recipes
 */
app.get("/recipes", async (req, res) => {
    const recipes = await Recipe.find();
    res.json(recipes);
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
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe found
 */
app.get("/recipes/:id", async (req, res) => {
    const recipe = await Recipe.findById(req.params.id);
    res.json(recipe);
});

/**
 * @swagger
 * /recipes/{id}:
 *   put:
 *     summary: Update recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe updated
 */
app.put("/recipes/:id", async (req, res) => {
    await Recipe.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Recipe updated!" });
});

/**
 * @swagger
 * /recipes/{id}:
 *   delete:
 *     summary: Delete recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recipe deleted
 */
app.delete("/recipes/:id", async (req, res) => {
    await Recipe.findByIdAndDelete(req.params.id);
    res.json({ message: "Recipe deleted!" });
});

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Recipe API",
            version: "1.0.0",
            description: "API for managing recipes with JWT authentication",
        },
        servers: [{ url: "http://localhost:3000" }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",    
                },
            },
        },
    },
    apis: ["/server.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
