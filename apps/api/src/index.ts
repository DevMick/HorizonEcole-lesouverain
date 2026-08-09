// ⚠️ DOIT rester le premier import : peuple process.env avant que
// `@school/config` ne le lise, ce qu'il fait au chargement du module.
// Ne pas déplacer ni laisser un outil de tri d'imports le réordonner.
import './load-env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import config from '@school/config';
import { prisma } from '@school/database';
import { swaggerSpec } from './swagger';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import rolesRoutes from './routes/roles';
import studentRoutes from './routes/students';
import parentRoutes from './routes/parents';
import studentParentRoutes from './routes/student-parents';
import schedulesRoutes from './routes/schedules';
import attendancesRoutes from './routes/attendances';
import attendanceSessionsRoutes from './routes/attendance-sessions';
import attendanceMakeupRoutes from './routes/attendance-makeup';
import disciplineRoutes from './routes/discipline';
import documentsRoutes from './routes/documents';
import settingsRoutes from './routes/settings';
import classRoutes from './routes/classes';
import subjectRoutes from './routes/subjects';
import dashboardRoutes from './routes/dashboard';
import academicYearsRoutes from './routes/academicYears';
import schoolClassesRoutes from './routes/schoolClasses';
import schoolSubjectsRoutes from './routes/schoolSubjects';
import classSubjectsRoutes from './routes/classSubjects';
import schoolStudentsRoutes from './routes/schoolStudents';
import schoolParentsRoutes from './routes/schoolParents';
import inscriptionsRoutes from './routes/inscriptions';
import coefficientsRoutes from './routes/coefficients';
import subjectAssignmentsRoutes from './routes/subjectAssignments';
import teachersRoutes from './routes/teachers';
import { PDFService } from './services/pdf.service';
import classAssignmentsRoutes from './routes/classAssignments';
import classroomsRoutes from './routes/classrooms';
import timetablesRoutes from './routes/timetables';
import horairesRoutes from './routes/horaires';
import semestersRoutes from './routes/semesters';
import gradesRoutes from './routes/grades';
import conductRoutes from './routes/conduct';
import evaluationTypesRoutes from './routes/evaluationTypes';
import evaluationCoefficientsRoutes from './routes/evaluationCoefficients';
import studentAbsencesRoutes from './routes/studentAbsences';
import classMainTeachersRoutes from './routes/classMainTeachers';
import parentSpaceRoutes from './routes/parent-space';
import studentSpaceRoutes from './routes/student-space';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Le chargement du .env vit dans ./load-env (importé en tête de fichier) : il
// doit s'exécuter avant l'import de @school/config, donc avant ce point.

const app = express();

// CRITICAL: First middleware - Capture ALL requests before anything else
// Logging disabled for production
// app.use((req, res, next) => {
//   console.log('='.repeat(80));
//   console.log(`[FIRST] ${req.method} ${req.path}`);
//   console.log(`[FIRST] URL: ${req.url}`);
//   console.log(`[FIRST] Headers:`, JSON.stringify(req.headers, null, 2));
//   console.log('='.repeat(80));
//   next();
// });

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://ecole-le-souverain-web.vercel.app',
      'https://votre-app.vercel.app',
      'https://lesouverain-larabia.com',
      'https://www.lesouverain-larabia.com',
      process.env.CORS_ORIGIN,
    ].filter(Boolean); // Remove undefined values
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (config.server.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
app.use(rateLimit(config.rateLimit));

// Logging
app.use(morgan('combined'));

// Cookie parsing
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug middleware - Log all incoming requests
// Logging disabled for production
// app.use((req, res, next) => {
//   console.log(`[DEBUG] ${req.method} ${req.path}`);
//   console.log(`[DEBUG] Headers:`, req.headers);
//   console.log(`[DEBUG] Query:`, req.query);
//   console.log(`[DEBUG] Body:`, req.body);
//   next();
// });

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'École LE SOUVERAIN DE LARABIA - API Docs',
  customfavIcon: '/favicon.ico',
}));

// Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes - IMPORTANT: Auth routes must be registered BEFORE any global middleware
// that might require authentication
app.use('/api/auth', authRoutes);

// Mount auth routes also at /auth/* for backward compatibility with frontend
// This allows /auth/login to work the same as /api/auth/login
app.use('/auth', authRoutes);

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    name: 'École LE SOUVERAIN DE LARABIA - API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api-docs',
    health: '/api/health',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      students: '/api/students',
      parents: '/api/parents',
      dashboard: '/api/dashboard',
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check - Must be after auth routes to allow unauthenticated access
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
});

// Middleware to redirect routes without /api prefix to /api/*
// This allows frontend to use both /academic-years and /api/academic-years
app.use((req, res, next) => {
  // Skip if already has /api prefix or is root, health, docs, or uploaded files
  if (req.path.startsWith('/api/') ||
      req.path === '/' ||
      req.path.startsWith('/api-docs') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/uploads')) {
    return next();
  }
  
  // Redirect to /api/* for all other routes
  req.url = '/api' + req.path;
  next();
});

// Other API routes
app.use('/api/users', userRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/student-parents', studentParentRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/attendances', attendancesRoutes);
app.use('/api/attendance-sessions', attendanceSessionsRoutes);
app.use('/api/attendance-makeup', attendanceMakeupRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/academic-years', academicYearsRoutes);
app.use('/api/school-classes', schoolClassesRoutes);
app.use('/api/school-subjects', schoolSubjectsRoutes);
app.use('/api/class-subjects', classSubjectsRoutes);
app.use('/api/school-students', schoolStudentsRoutes);
app.use('/api/school-parents', schoolParentsRoutes);
app.use('/api/inscriptions', inscriptionsRoutes);
app.use('/api/coefficients', coefficientsRoutes);
app.use('/api/subject-assignments', subjectAssignmentsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/class-assignments', classAssignmentsRoutes);
app.use('/api/classrooms', classroomsRoutes);
app.use('/api/timetables', timetablesRoutes);
app.use('/api/horaires', horairesRoutes);
app.use('/api/semesters', semestersRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/conduct', conductRoutes);
app.use('/api/evaluation-types', evaluationTypesRoutes);
app.use('/api/evaluation-coefficients', evaluationCoefficientsRoutes);
app.use('/api/student-absences', studentAbsencesRoutes);
app.use('/api/class-main-teachers', classMainTeachersRoutes);
app.use('/api/parent', parentSpaceRoutes);
app.use('/api/student', studentSpaceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve uploaded files — les documents (PDF/images) sont visionnés dans une
// iframe/modale du front (origine différente en dev) : on relâche les en-têtes
// anti-framing d'helmet pour ce seul chemin, le contenu servi est uniquement
// celui uploadé par l'établissement lui-même, pas du contenu tiers.
app.use('/uploads', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:5173 http://localhost:3000 http://localhost:5174");
  next();
}, express.static('uploads'));

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = config.server.port;

// Verify Prisma client has refreshToken model (useful after regeneration)
if (!('refreshToken' in prisma)) {
  console.warn('⚠️  Prisma client missing refreshToken model. Please restart the server after regenerating Prisma client.');
}

// Initialize PDF upload directories
PDFService.ensureUploadsDir().catch((err) => {
  console.error('❌ Error initializing PDF upload directories:', err);
});

const server = app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log('🏫 École LE SOUVERAIN DE LARABIA - API Server');
  console.log('='.repeat(80));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`📋 API Spec (JSON): http://localhost:${PORT}/api-docs.json`);
  console.log('='.repeat(80));
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n' + '='.repeat(80));
    console.error('❌ ERREUR: Le port', PORT, 'est déjà utilisé !');
    console.error('='.repeat(80));
    console.error('\n💡 Solution:');
    console.error('   1. Exécutez: powershell -ExecutionPolicy Bypass -File kill-ports.ps1');
    console.error('   2. Ou arrêtez manuellement le processus qui utilise le port', PORT);
    console.error('   3. Puis relancez: pnpm dev');
    console.error('\n🔍 Pour identifier le processus:');
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  } else {
    console.error('❌ Erreur serveur:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
