// api/swagger.json.js - OpenAPI specification
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const swaggerSpec = {
    "openapi": "3.0.0",
    "info": {
      "title": "Recipe API",
      "version": "1.0.0",
      "description": "A serverless Recipe API with JWT authentication"
    },
    "servers": [
      {
        "url": "https://endpointers-anas.vercel.app",
        "description": "Production server"
      }
    ],
    "components": {
      "securitySchemes": {
        "bearerAuth": {
          "type": "http",
          "scheme": "bearer",
          "bearerFormat": "JWT"
        }
      },
      "schemas": {
        "User": {
          "type": "object",
          "required": ["username", "password"],
          "properties": {
            "username": {
              "type": "string",
              "example": "johndoe"
            },
            "password": {
              "type": "string",
              "example": "password123"
            }
          }
        },
        "Recipe": {
          "type": "object",
          "required": ["title", "instructions"],
          "properties": {
            "title": {
              "type": "string",
              "example": "Chocolate Chip Cookies"
            },
            "ingredients": {
              "type": "array",
              "items": { "type": "string" },
              "example": ["2 cups flour", "1 cup sugar", "1/2 cup butter"]
            },
            "instructions": {
              "type": "string",
              "example": "Mix ingredients and bake at 350°F for 12 minutes"
            },
            "cookingTime": {
              "type": "number",
              "example": 30
            },
            "servings": {
              "type": "number",
              "example": 4
            }
          }
        }
      }
    },
    "tags": [
      {
        "name": "Authentication",
        "description": "User authentication endpoints"
      },
      {
        "name": "Recipes",
        "description": "Recipe management endpoints"
      }
    ],
    "paths": {
      "/api/health": {
        "get": {
          "summary": "Health check",
          "responses": {
            "200": {
              "description": "API is healthy"
            }
          }
        }
      },
      "/api/auth/register": {
        "post": {
          "summary": "Register a new user",
          "tags": ["Authentication"],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "User registered successfully"
            },
            "400": {
              "description": "Invalid input or user already exists"
            }
          }
        }
      },
      "/api/auth/login": {
        "post": {
          "summary": "Login and get JWT token",
          "tags": ["Authentication"],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Login successful"
            },
            "401": {
              "description": "Invalid credentials"
            }
          }
        }
      },
      "/api/recipes": {
        "get": {
          "summary": "Get all recipes",
          "tags": ["Recipes"],
          "parameters": [
            {
              "in": "query",
              "name": "page",
              "schema": { "type": "integer", "default": 1 }
            },
            {
              "in": "query",
              "name": "limit",
              "schema": { "type": "integer", "default": 10 }
            }
          ],
          "responses": {
            "200": {
              "description": "List of recipes"
            }
          }
        },
        "post": {
          "summary": "Create a new recipe",
          "tags": ["Recipes"],
          "security": [{ "bearerAuth": [] }],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Recipe"
                }
              }
            }
          },
          "responses": {
            "201": {
              "description": "Recipe created successfully"
            },
            "401": {
              "description": "Authentication required"
            }
          }
        }
      },
      "/api/recipes/{id}": {
        "get": {
          "summary": "Get recipe by ID",
          "tags": ["Recipes"],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": { "type": "string" }
            }
          ],
          "responses": {
            "200": {
              "description": "Recipe found"
            },
            "404": {
              "description": "Recipe not found"
            }
          }
        },
        "put": {
          "summary": "Update recipe",
          "tags": ["Recipes"],
          "security": [{ "bearerAuth": [] }],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": { "type": "string" }
            }
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Recipe"
                }
              }
            }
          },
          "responses": {
            "200": {
              "description": "Recipe updated"
            },
            "403": {
              "description": "Not authorized"
            },
            "404": {
              "description": "Recipe not found"
            }
          }
        },
        "delete": {
          "summary": "Delete recipe",
          "tags": ["Recipes"],
          "security": [{ "bearerAuth": [] }],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": { "type": "string" }
            }
          ],
          "responses": {
            "200": {
              "description": "Recipe deleted"
            },
            "403": {
              "description": "Not authorized"
            },
            "404": {
              "description": "Recipe not found"
            }
          }
        }
      }
    }
  };

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(swaggerSpec);
}