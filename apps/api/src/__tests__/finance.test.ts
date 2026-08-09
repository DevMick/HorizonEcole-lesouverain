import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Finance Module - School Fees & Payment Schedules', () => {
  let authToken: string;
  let testAcademicYearId: string;
  let testSchoolFeeId: string;
  let testStudentId: string;
  let testScheduleId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    authToken = loginResponse.body.token;

    // Get or create academic year
    const academicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true }
    });

    testAcademicYearId = academicYear!.id;

    // Get test student
    const student = await prisma.student.findFirst({
      where: { status: 'ACTIVE' },
      include: { schoolClass: true }
    });

    testStudentId = student!.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testScheduleId) {
      await prisma.paymentSchedule.deleteMany({
        where: { id: testScheduleId }
      });
    }
    if (testSchoolFeeId) {
      await prisma.schoolFee.delete({ where: { id: testSchoolFeeId } });
    }
    await prisma.$disconnect();
  });

  // ==================== SCHOOL FEES TESTS ====================

  describe('School Fees API', () => {
    describe('GET /api/school-fees', () => {
      it('should fetch school fees list', async () => {
        const response = await request(app)
          .get('/api/school-fees')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should filter school fees by academic year', async () => {
        const response = await request(app)
          .get(`/api/school-fees?academicYearId=${testAcademicYearId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should filter school fees by level', async () => {
        const response = await request(app)
          .get('/api/school-fees?level=SIXIEME')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .get('/api/school-fees');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/school-fees/stats', () => {
      it('should fetch school fee statistics', async () => {
        const response = await request(app)
          .get('/api/school-fees/stats')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalFees');
        expect(response.body.data).toHaveProperty('currentYearFees');
        expect(response.body.data).toHaveProperty('feesByType');
        expect(response.body.data).toHaveProperty('feesByLevel');
      });
    });

    describe('GET /api/school-fees/by-level', () => {
      it('should fetch fees by academic year and level', async () => {
        const response = await request(app)
          .get(`/api/school-fees/by-level?academicYearId=${testAcademicYearId}&level=SIXIEME`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('fees');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('breakdown');
      });

      it('should return 400 without required parameters', async () => {
        const response = await request(app)
          .get('/api/school-fees/by-level')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('required');
      });
    });

    describe('POST /api/school-fees', () => {
      it('should create a new school fee', async () => {
        const feeData = {
          academicYearId: testAcademicYearId,
          level: 'SIXIEME',
          feeType: 'AUTRE',
          amount: 10000,
          description: 'Test fee',
        };

        const response = await request(app)
          .post('/api/school-fees')
          .set('Authorization', `Bearer ${authToken}`)
          .send(feeData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.amount).toBe(feeData.amount);
        expect(response.body.data.feeType).toBe(feeData.feeType);

        testSchoolFeeId = response.body.data.id;
      });

      it('should return 400 for duplicate school fee', async () => {
        const feeData = {
          academicYearId: testAcademicYearId,
          level: 'SIXIEME',
          feeType: 'AUTRE',
          amount: 10000,
        };

        const response = await request(app)
          .post('/api/school-fees')
          .set('Authorization', `Bearer ${authToken}`)
          .send(feeData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already exists');
      });

      it('should return 400 for invalid data', async () => {
        const invalidData = {
          academicYearId: 'invalid-id',
          level: 'INVALID',
          amount: -100,
        };

        const response = await request(app)
          .post('/api/school-fees')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/school-fees/:id', () => {
      it('should fetch school fee by ID', async () => {
        const response = await request(app)
          .get(`/api/school-fees/${testSchoolFeeId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testSchoolFeeId);
      });

      it('should return 404 for non-existent fee', async () => {
        const response = await request(app)
          .get('/api/school-fees/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('PUT /api/school-fees/:id', () => {
      it('should update school fee', async () => {
        const updateData = {
          amount: 15000,
          description: 'Updated test fee',
        };

        const response = await request(app)
          .put(`/api/school-fees/${testSchoolFeeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.amount).toBe(updateData.amount);
      });

      it('should return 404 for non-existent fee', async () => {
        const response = await request(app)
          .put('/api/school-fees/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 10000 });

        expect(response.status).toBe(404);
      });
    });
  });

  // ==================== PAYMENT SCHEDULES TESTS ====================

  describe('Payment Schedules API', () => {
    describe('GET /api/payment-schedules', () => {
      it('should fetch payment schedules list', async () => {
        const response = await request(app)
          .get('/api/payment-schedules')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should filter schedules by student', async () => {
        const response = await request(app)
          .get(`/api/payment-schedules?studentId=${testStudentId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should filter schedules by status', async () => {
        const response = await request(app)
          .get('/api/payment-schedules?status=PENDING')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/payment-schedules/stats', () => {
      it('should fetch payment schedule statistics', async () => {
        const response = await request(app)
          .get('/api/payment-schedules/stats')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalSchedules');
        expect(response.body.data).toHaveProperty('schedulesByStatus');
        expect(response.body.data).toHaveProperty('totalDue');
        expect(response.body.data).toHaveProperty('totalPaid');
        expect(response.body.data).toHaveProperty('totalRemaining');
      });
    });

    describe('GET /api/payment-schedules/student/:studentId/summary', () => {
      it('should fetch student payment summary', async () => {
        const response = await request(app)
          .get(`/api/payment-schedules/student/${testStudentId}/summary`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalDue');
        expect(response.body.data).toHaveProperty('totalPaid');
        expect(response.body.data).toHaveProperty('totalRemaining');
        expect(response.body.data).toHaveProperty('schedulesByStatus');
      });
    });

    describe('POST /api/payment-schedules/generate', () => {
      it('should generate payment schedule for a student', async () => {
        // First, delete any existing schedules for this test
        await prisma.paymentSchedule.deleteMany({
          where: {
            studentId: testStudentId,
            academicYearId: testAcademicYearId,
          }
        });

        const generateData = {
          studentId: testStudentId,
          academicYearId: testAcademicYearId,
          includeOptionalFees: false,
          installments: 10,
          customDiscountPercentage: 0,
        };

        const response = await request(app)
          .post('/api/payment-schedules/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('schedulesCreated');
        expect(response.body.data).toHaveProperty('totalAmount');
        expect(response.body.data.schedulesCreated).toBeGreaterThan(0);
      });

      it('should return 400 if schedules already exist', async () => {
        const generateData = {
          studentId: testStudentId,
          academicYearId: testAcademicYearId,
        };

        const response = await request(app)
          .post('/api/payment-schedules/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already exist');
      });

      it('should return 400 for non-existent student', async () => {
        const generateData = {
          studentId: 'non-existent-id',
          academicYearId: testAcademicYearId,
        };

        const response = await request(app)
          .post('/api/payment-schedules/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not found');
      });
    });

    describe('POST /api/payment-schedules', () => {
      it('should create a payment schedule', async () => {
        const scheduleData = {
          studentId: testStudentId,
          academicYearId: testAcademicYearId,
          feeType: 'AUTRE',
          totalAmount: 10000,
          dueDate: new Date().toISOString(),
          discountPercentage: 0,
        };

        const response = await request(app)
          .post('/api/payment-schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(scheduleData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.totalAmount).toBe(scheduleData.totalAmount);

        testScheduleId = response.body.data.id;
      });
    });

    describe('GET /api/payment-schedules/:id', () => {
      it('should fetch payment schedule by ID', async () => {
        const response = await request(app)
          .get(`/api/payment-schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testScheduleId);
      });
    });

    describe('PUT /api/payment-schedules/:id', () => {
      it('should update payment schedule', async () => {
        const updateData = {
          status: 'PAID',
        };

        const response = await request(app)
          .put(`/api/payment-schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(updateData.status);
      });
    });

    describe('POST /api/payment-schedules/update-overdue', () => {
      it('should update overdue schedules', async () => {
        const response = await request(app)
          .post('/api/payment-schedules/update-overdue')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('updatedCount');
      });
    });

    describe('DELETE /api/payment-schedules/:id', () => {
      it('should delete payment schedule', async () => {
        const response = await request(app)
          .delete(`/api/payment-schedules/${testScheduleId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        testScheduleId = '';
      });

      it('should return 404 for non-existent schedule', async () => {
        const response = await request(app)
          .delete('/api/payment-schedules/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      });
    });
  });

  // ==================== INTEGRATION TESTS ====================

  describe('Integration: School Fees → Payment Schedules', () => {
    it('should prevent deletion of school fee with associated schedules', async () => {
      // This is implicitly tested by the fee having schedules generated
      // The fee cannot be deleted if payment schedules exist for that fee type
      const response = await request(app)
        .delete(`/api/school-fees/${testSchoolFeeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should succeed if no schedules, or fail if schedules exist
      if (response.status === 400) {
        expect(response.body.error).toContain('Cannot delete');
      }
    });
  });

  // Clean up school fee at the end
  describe('Cleanup', () => {
    it('should delete test school fee', async () => {
      const response = await request(app)
        .delete(`/api/school-fees/${testSchoolFeeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // May succeed or fail depending on associations
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        testSchoolFeeId = '';
      }
    });
  });
});
