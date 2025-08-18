const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');

const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8'));

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/swagger.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'swagger.json'));
  });
}

module.exports = setupSwagger;
