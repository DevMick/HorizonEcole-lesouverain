import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from '@school/database';
import authRoutes from '../routes/auth';
import bcrypt from 'bcryptjs';

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Test data
let testAdmin: any;
let testAdminToken: string;
let testTeacher: any;

describe('Authentication API', () => {
  // Setup: Create test users before all tests
  beforeAll(async () => {
    // Clean up existing test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['admin.test@souverainlarabia.edu.ci', 'teacher.test@souverainlarabia.edu.ci'],
        },
      },
    });

    // Create test admin
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    testAdmin = await prisma.user.create({
      data: {
        email: 'admin.test@souverainlarabia.edu.ci',
        passwordHash: hashedPassword,
        firstName: 'Admin',
        lastName: 'Test',
        role: 'ADMIN',
      },
    });

    // Create test teacher
    testTeacher = await prisma.user.create({
      data: {
        email: 'teacher.test@souverainlarabia.edu.ci',
        passwordHash: hashedPassword,
        firstName: 'Teacher',
        lastName: 'Test',
        role: 'TEACHER',
      },
    });
  });

  // Cleanup: Remove test users after all tests
  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [testAdmin.id, testTeacher.id] } },
    });
    
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [testAdmin.id, testTeacher.id] } },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [testAdmin.id, testTeacher.id] },
      },
    });

    await prisma.$disconnect();
  });

  // =========================================================================
  // POST /api/auth/login
  // =========================================================================

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.test@souverainlarabia.edu.ci',
          password: 'Admin123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('admin.test@souverainlarabia.edu.ci');
      expect(response.body.data.user.role).toBe('ADMIN');

      // Should set httpOnly cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.startsWith('refreshToken='))).toBe(true);

      // Save token for later tests
      testAdminToken = response.body.data.accessToken;
    });

    it('should fail login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.test@souverainlarabia.edu.ci',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should fail login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.test@souverainlarabia.edu.ci',
          // missing password
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail login with inactive user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: testTeacher.id },
        data: { isActive: false },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'teacher.test@souverainlarabia.edu.ci',
          password: 'Admin123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Account is inactive');

      // Reactivate user
      await prisma.user.update({
        where: { id: testTeacher.id },
        data: { isActive: true },
      });
    });
  });

  // =========================================================================
  // GET /api/auth/me
  // =========================================================================

  describe('GET /api/auth/me', () => {
    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe('admin.test@souverainlarabia.edu.ci');
      expect(response.body.data.role).toBe('ADMIN');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  // =========================================================================
  // POST /api/auth/register (ADMIN only)
  // =========================================================================

  describe('POST /api/auth/register', () => {
    it('should register a new user as admin', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          email: 'newuser@souverainlarabia.edu.ci',
          password: 'NewUser123!',
          firstName: 'New',
          lastName: 'User',
          role: 'TEACHER',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe('newuser@souverainlarabia.edu.ci');

      // Cleanup
      await prisma.user.delete({
        where: { email: 'newuser@souverainlarabia.edu.ci' },
      });
    });

    it('should fail to register without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@souverainlarabia.edu.ci',
          password: 'Password123!',
          firstName: 'Another',
          lastName: 'User',
          role: 'TEACHER',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail to register duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          email: 'admin.test@souverainlarabia.edu.ci', // Already exists
          password: 'Password123!',
          firstName: 'Duplicate',
          lastName: 'User',
          role: 'TEACHER',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User with this email already exists');
    });
  });

  // =========================================================================
  // POST /api/auth/refresh
  // =========================================================================

  describe('POST /api/auth/refresh', () => {
    let refreshTokenCookie: string;

    beforeAll(async () => {
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.test@souverainlarabia.edu.ci',
          password: 'Admin123!',
        });

      const cookies = loginResponse.headers['set-cookie'];
      refreshTokenCookie = cookies.find((cookie: string) => 
        cookie.startsWith('refreshToken=')
      );
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');
    });

    it('should fail refresh without refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Refresh token not found');
    });

    it('should fail refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired refresh token');
    });
  });

  // =========================================================================
  // POST /api/auth/logout
  // =========================================================================

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');

      // Should clear refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should fail logout without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // POST /api/auth/change-password
  // =========================================================================

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'Admin123!',
          newPassword: 'NewAdmin123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');

      // Verify we can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin.test@souverainlarabia.edu.ci',
          password: 'NewAdmin123!',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Update token for further tests
      testAdminToken = loginResponse.body.data.accessToken;

      // Change back to original password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'NewAdmin123!',
          newPassword: 'Admin123!',
        });
    });

    it('should fail with incorrect current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'Admin123!',
          newPassword: 'NewPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // RBAC Tests - Protected Routes
  // =========================================================================

  describe('RBAC - Role-Based Access Control', () => {
    let teacherToken: string;

    beforeAll(async () => {
      // Login as teacher
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'teacher.test@souverainlarabia.edu.ci',
          password: 'Admin123!',
        });

      teacherToken = response.body.data.accessToken;
    });

    it('should allow admin to register users', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          email: 'rbactest@souverainlarabia.edu.ci',
          password: 'Test123!',
          firstName: 'RBAC',
          lastName: 'Test',
          role: 'ACCOUNTANT',
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      // Cleanup
      await prisma.user.delete({
        where: { email: 'rbactest@souverainlarabia.edu.ci' },
      });
    });

    it('should forbid non-admin from registering users', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          email: 'forbidden@souverainlarabia.edu.ci',
          password: 'Test123!',
          firstName: 'Forbidden',
          lastName: 'User',
          role: 'TEACHER',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});

