import request from 'supertest';
import { app } from '../index';
import { prisma } from '@school/database';
import bcrypt from 'bcryptjs';

describe('Students and Parents API', () => {
  let authToken: string;
  let testStudentId: string;
  let testParentId: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const hashedPassword = await bcrypt.hash('test123', 12);
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        passwordHash: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'test123',
      });

    authToken = loginResponse.body.data.accessToken;

    // Create test academic year
    await prisma.academicYear.upsert({
      where: { name: 'Test Year' },
      update: {},
      create: {
        name: 'Test Year',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-06-30'),
        isCurrent: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.studentParent.deleteMany();
    await prisma.student.deleteMany();
    await prisma.parent.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
    await prisma.academicYear.deleteMany({ where: { name: 'Test Year' } });
    await prisma.$disconnect();
  });

  describe('POST /api/parents', () => {
    it('should create a new parent', async () => {
      const parentData = {
        firstName: 'John',
        lastName: 'Doe',
        relation: 'PERE',
        phone: '771234567',
        email: 'john.doe@example.com',
        profession: 'Engineer',
        isPrimaryContact: true,
        isFinancialResponsible: true,
      };

      const response = await request(app)
        .post('/api/parents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(parentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(parentData.firstName);
      expect(response.body.data.lastName).toBe(parentData.lastName);
      
      testParentId = response.body.data.id;
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstName: 'John',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/parents')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/parents', () => {
    it('should get all parents', async () => {
      const response = await request(app)
        .get('/api/parents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should search parents', async () => {
      const response = await request(app)
        .get('/api/parents?search=John')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/students', () => {
    it('should create a new student', async () => {
      const academicYear = await prisma.academicYear.findFirst({
        where: { name: 'Test Year' },
      });

      const classData = await prisma.schoolClass.create({
        data: {
          name: 'Test Class',
          level: 'SIXIEME',
          academicYearId: academicYear!.id,
          maxStudents: 30,
        },
      });

      const studentData = {
        studentNumber: 'TEST001',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-05-15',
        gender: 'FEMALE',
        enrollmentDate: '2024-09-01',
        classId: classData.id,
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${authToken}`)
        .send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(studentData.firstName);
      expect(response.body.data.lastName).toBe(studentData.lastName);
      
      testStudentId = response.body.data.id;
    });
  });

  describe('POST /api/students/:id/parents', () => {
    it('should link a parent to a student', async () => {
      const response = await request(app)
        .post(`/api/students/${testStudentId}/parents`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parentId: testParentId,
          relation: 'PERE',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('linked');
    });

    it('should not allow duplicate parent links', async () => {
      const response = await request(app)
        .post(`/api/students/${testStudentId}/parents`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          parentId: testParentId,
          relation: 'PERE',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/students/:id', () => {
    it('should get student with parent relationships', async () => {
      const response = await request(app)
        .get(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.studentParents).toBeDefined();
      expect(Array.isArray(response.body.data.studentParents)).toBe(true);
      expect(response.body.data.studentParents.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/students/:id/parents/:parentId', () => {
    it('should unlink a parent from a student', async () => {
      const response = await request(app)
        .delete(`/api/students/${testStudentId}/parents/${testParentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unlinked');
    });
  });

  describe('GET /api/students/stats/overview', () => {
    it('should get student statistics', async () => {
      const response = await request(app)
        .get('/api/students/stats/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalStudents).toBeDefined();
      expect(response.body.data.activeStudents).toBeDefined();
    });
  });

  describe('GET /api/parents/stats/overview', () => {
    it('should get parent statistics', async () => {
      const response = await request(app)
        .get('/api/parents/stats/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalParents).toBeDefined();
      expect(response.body.data.parentsByRelation).toBeDefined();
    });
  });
});
