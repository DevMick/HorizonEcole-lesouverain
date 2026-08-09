// Environment configuration
export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '4001'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'secret-ultra-securise',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '1000'), // requests per IP per windowMs — 100 was too low for normal admin usage (several API calls per page)
  },

  // Password hashing
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
  },

  // Pagination
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
  },

  // File upload
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },

  // Email (SMTP sortant — envoi des identifiants de compte, etc.)
  email: {
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'HorizonEcole',
  },

  // URL publique du frontend (liens de connexion dans les emails, etc.)
  app: {
    frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  // School information
  school: {
    name: 'Collège Privé LE SOUVERAIN DE LARABIA',
    address: 'LARABIA, Côte d\'Ivoire',
    phone: '+225 XX XX XX XX XX',
    email: 'info@souverainlarabia.edu.ci',
    website: 'https://souverainlarabia.edu.ci',
    // Fuseau de l'école : sert aux règles qui raisonnent en jour calendaire
    // local (ex. « l'appel n'est possible que le jour du cours »). Le serveur
    // peut tourner ailleurs — on ne se fie donc jamais à sa TZ.
    timezone: process.env.SCHOOL_TIMEZONE || 'Africa/Abidjan',
  },

  // Academic settings
  academic: {
    currentYear: process.env.ACADEMIC_YEAR || '2024-2025',
    semesters: 2,
    maxStudentsPerClass: 40,
  },

  // Financial settings
  financial: {
    currency: 'XOF',
    currencySymbol: 'FCFA',
    decimalPlaces: 0,
  },
} as const;

// Validation helpers
export const validateConfig = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
};

// Type for the config object
export type Config = typeof config;

export default config;
