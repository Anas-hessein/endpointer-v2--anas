const express = require('express');
const path = require('path');
const setupSwagger = require('./swagger');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const secret = process.env.JWT_SECRET || 'your-secret-key';

function generateToken(payload) {
    return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}


setupSwagger(app);

let users = [];
let recipes = [];


app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    users.push({ username, password });
    const token = generateToken({ username });
    res.status(201).json({ token });
});


app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken({ username });
    res.json({ token });
});



app.post('/recipes', authenticateToken, (req, res) => {
    const { title, ingredients, instructions } = req.body;
    const newRecipe = {
        id: Date.now().toString(),
        title,
        ingredients,
        instructions,
        createdBy: req.user.username
    };
    recipes.push(newRecipe);
    res.status(201).json(newRecipe);
});


app.post('/recipes/:id/reviews', authenticateToken, (req, res) => {
    const { rating, comment } = req.body;
    const recipe = recipes.find(r => r.id === req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
    }
    if (!recipe.reviews) recipe.reviews = [];
    recipe.reviews.push({
        id: Date.now().toString(),
        rating,
        comment,
        user: req.user.username
    });
    res.status(201).json({ message: 'Review added successfully' });
});


app.get('/recipes', (req, res) => {
    res.json(recipes);
});


app.get('/recipes/:id', (req, res) => {
    const recipe = recipes.find(r => r.id === req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
});


app.get('/recipes/:id/reviews', (req, res) => {
    const recipe = recipes.find(r => r.id === req.params.id);
    if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe.reviews || []);
});


app.put('/recipes/:id', authenticateToken, (req, res) => {
    const index = recipes.findIndex(r => r.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Recipe not found' });
    }
    if (recipes[index].createdBy !== req.user.username) {
        return res.status(403).json({ error: 'Not authorized to update this recipe' });
    }
    recipes[index] = { ...recipes[index], ...req.body, id: req.params.id };
    res.json(recipes[index]);
});


app.delete('/recipes/:id', authenticateToken, (req, res) => {
    const index = recipes.findIndex(r => r.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Recipe not found' });
    }
    if (recipes[index].createdBy !== req.user.username) {
        return res.status(403).json({ error: 'Not authorized to delete this recipe' });
    }
    recipes.splice(index, 1);
    res.status(204).send();
});


if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
