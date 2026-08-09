import swaggerJSDoc from 'swagger-jsdoc';
import config from '@school/config';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'École LE SOUVERAIN DE LARABIA - API Documentation',
    version: '1.0.0',
    description: `
      API de gestion complète pour l'École LE SOUVERAIN DE LARABIA.
      
      ## 🎨 Couleurs de l'École
      - 🟢 Vert principal: #228B22
      - 🟠 Orange secondaire: #FF6B35
      - ⚪ Blanc support: #FFFFFF
      
      ## 🔐 Authentification
      La plupart des endpoints nécessitent un access token JWT.
      
      1. **Login**: POST /api/auth/login pour obtenir un access token
      2. **Utilisation**: Ajouter le header "Authorization: Bearer {token}" à vos requêtes
      3. **Refresh**: POST /api/auth/refresh pour renouveler le token (utilise un cookie httpOnly)
      
      ## 👥 Rôles Utilisateurs
      - **ADMIN**: Accès complet à tous les modules
      - **TEACHER**: Accès aux notes, présences, emploi du temps
      - **ACCOUNTANT**: Accès aux finances, paiements, salaires
      - **STUDENT**: Accès à ses notes, emploi du temps
      - **PARENT**: Accès aux informations de ses enfants
    `,
    contact: {
      name: 'École LE SOUVERAIN DE LARABIA',
      url: config.school.website,
      email: config.school.email,
    },
    license: {
      name: 'Propriétaire',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.server.port}`,
      description: 'Serveur de développement',
    },
    {
      url: 'https://api.souverainlarabia.edu.ci',
      description: 'Serveur de production',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'Endpoints d\'authentification et gestion de session',
    },
    {
      name: 'Users',
      description: 'Gestion des utilisateurs',
    },
    {
      name: 'Students',
      description: 'Gestion des élèves',
    },
    {
      name: 'Staff',
      description: 'Gestion du personnel',
    },
    {
      name: 'Classes',
      description: 'Gestion des classes et matières',
    },
    {
      name: 'Grades',
      description: 'Gestion des notes et bulletins',
    },
    {
      name: 'Payments',
      description: 'Gestion des paiements et frais scolaires',
    },
    {
      name: 'Attendance',
      description: 'Gestion des présences',
    },
    {
      name: 'Schedule',
      description: 'Gestion des emplois du temps',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez le token JWT obtenu après login',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Identifiant unique de l\'utilisateur',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Adresse email',
          },
          firstName: {
            type: 'string',
            description: 'Prénom',
          },
          lastName: {
            type: 'string',
            description: 'Nom de famille',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'],
            description: 'Rôle de l\'utilisateur',
          },
          phone: {
            type: 'string',
            description: 'Numéro de téléphone',
            nullable: true,
          },
          avatarUrl: {
            type: 'string',
            format: 'uri',
            description: 'URL de l\'avatar',
            nullable: true,
          },
          isActive: {
            type: 'boolean',
            description: 'Compte actif ou non',
          },
          lastLoginAt: {
            type: 'string',
            format: 'date-time',
            description: 'Date de dernière connexion',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Date de création',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Date de dernière mise à jour',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'admin@souverainlarabia.edu.ci',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 6,
            example: 'admin123',
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
            properties: {
              user: {
                $ref: '#/components/schemas/User',
              },
              accessToken: {
                type: 'string',
                description: 'JWT access token (expire dans 1 heure)',
              },
            },
          },
          message: {
            type: 'string',
            example: 'Login successful',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'role'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
          },
          firstName: {
            type: 'string',
            minLength: 2,
          },
          lastName: {
            type: 'string',
            minLength: 2,
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'TEACHER', 'ACCOUNTANT', 'STUDENT', 'PARENT'],
          },
          phone: {
            type: 'string',
            nullable: true,
          },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: {
            type: 'string',
            format: 'password',
          },
          newPassword: {
            type: 'string',
            format: 'password',
            minLength: 8,
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'string',
            description: 'Message d\'erreur',
          },
          message: {
            type: 'string',
            description: 'Détails supplémentaires (optionnel)',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Access token manquant ou invalide',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              error: 'Access token required',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Permissions insuffisantes',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              error: 'Insufficient permissions',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Ressource non trouvée',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              error: 'Resource not found',
            },
          },
        },
      },
      ValidationError: {
        description: 'Erreur de validation des données',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
            example: {
              success: false,
              error: 'Validation failed',
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/swagger/*.yaml'], // Chemins vers les fichiers contenant les annotations
};

export const swaggerSpec = swaggerJSDoc(options);

