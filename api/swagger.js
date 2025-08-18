const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Recipe API',
      version: '1.0.0',
      description: 'A simple API with Recipe CRUD',
    },
    servers: [
      { url: 'https://your-vercel-domain.vercel.app' },
    ],
  },
  apis: ['./api/*.js'], // Adjust as needed
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(swaggerSpec);
}
