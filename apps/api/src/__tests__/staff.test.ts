import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Staff API', () => {
  let authToken: string;
  let testStaffId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Clean up test data
    if (testStaffId) {
      await prisma.staff.delete({ where: { id: testStaffId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/staff', () => {
    it('should fetch staff list with authentication', async () => {
      const response = await request(app)
        .get('/api/staff')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter staff by function', async () => {
      const response = await request(app)
        .get('/api/staff?function=ENSEIGNANT')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should search staff by name', async () => {
      const response = await request(app)
        .get('/api/staff?search=Jean')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/staff');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/staff/stats', () => {
    it('should fetch staff statistics', async () => {
      const response = await request(app)
        .get('/api/staff/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalStaff');
      expect(response.body.data).toHaveProperty('activeStaff');
      expect(response.body.data).toHaveProperty('inactiveStaff');
    });
  });

  describe('POST /api/staff', () => {
    it('should create a new staff member', async () => {
      const staffData = {
        firstName: 'Test',
        lastName: 'Staff',
        email: 'test.staff@example.com',
        phone: '+237 6 12 34 56 78',
        function: 'ENSEIGNANT',
        contractType: 'CDI',
        hireDate: '2023-09-01',
        baseSalary: 250000,
      };

      const response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send(staffData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(staffData.firstName);
      expect(response.body.data.lastName).toBe(staffData.lastName);

      testStaffId = response.body.data.id;
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        firstName: '',
        lastName: '',
        function: 'INVALID',
      };

      const response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for duplicate email', async () => {
      const staffData = {
        firstName: 'Another',
        lastName: 'Staff',
        email: 'test.staff@example.com', // Same email as previous test
        function: 'ENSEIGNANT',
        contractType: 'CDI',
        hireDate: '2023-09-01',
        baseSalary: 250000,
      };

      const response = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${authToken}`)
        .send(staffData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already exists');
    });
  });

  describe('GET /api/staff/:id', () => {
    it('should fetch staff member by ID', async () => {
      const response = await request(app)
        .get(`/api/staff/${testStaffId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testStaffId);
    });

    it('should return 404 for non-existent staff', async () => {
      const response = await request(app)
        .get('/api/staff/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Staff member not found');
    });
  });

  describe('PUT /api/staff/:id', () => {
    it('should update staff member', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Staff',
        baseSalary: 300000,
      };

      const response = await request(app)
        .put(`/api/staff/${testStaffId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(updateData.firstName);
      expect(response.body.data.baseSalary).toBe(updateData.baseSalary);
    });

    it('should return 404 for non-existent staff', async () => {
      const response = await request(app)
        .put('/api/staff/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/staff/:id/salaries', () => {
    it('should generate salary for staff member', async () => {
      const salaryData = {
        month: 11,
        year: 2024,
        allowances: [
          { label: 'Transport', amount: 15000 },
          { label: 'Housing', amount: 25000 }
        ],
        deductions: [
          { label: 'Insurance', amount: 5000 }
        ],
        overtimeHours: 5,
        overtimeRate: 2000,
        bonuses: 10000,
        notes: 'Test salary generation',
      };

      const response = await request(app)
        .post(`/api/staff/${testStaffId}/salaries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(salaryData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.staffId).toBe(testStaffId);
      expect(response.body.data.month).toBe(salaryData.month);
      expect(response.body.data.year).toBe(salaryData.year);
    });

    it('should return 400 for duplicate salary', async () => {
      const salaryData = {
        month: 11,
        year: 2024,
        allowances: [],
        deductions: [],
      };

      const response = await request(app)
        .post(`/api/staff/${testStaffId}/salaries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(salaryData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Salary already exists for this month and year');
    });
  });

  describe('GET /api/staff/:id/salaries', () => {
    it('should fetch staff salaries', async () => {
      const response = await request(app)
        .get(`/api/staff/${testStaffId}/salaries`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('DELETE /api/staff/:id', () => {
    it('should delete staff member', async () => {
      const response = await request(app)
        .delete(`/api/staff/${testStaffId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Staff member deleted successfully');

      // Reset testStaffId to prevent cleanup error
      testStaffId = '';
    });

    it('should return 404 for non-existent staff', async () => {
      const response = await request(app)
        .delete('/api/staff/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});

describe('Staff Salaries API', () => {
  let authToken: string;
  let testStaffId: string;
  let testSalaryId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    authToken = loginResponse.body.token;

    // Create test staff member
    const staffResponse = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Salary',
        lastName: 'Test',
        email: 'salary.test@example.com',
        function: 'ENSEIGNANT',
        contractType: 'CDI',
        hireDate: '2023-09-01',
        baseSalary: 250000,
      });

    testStaffId = staffResponse.body.data.id;

    // Create test salary
    const salaryResponse = await request(app)
      .post(`/api/staff/${testStaffId}/salaries`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        month: 10,
        year: 2024,
        allowances: [],
        deductions: [],
      });

    testSalaryId = salaryResponse.body.data.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testSalaryId) {
      await prisma.staffSalary.delete({ where: { id: testSalaryId } });
    }
    if (testStaffId) {
      await prisma.staff.delete({ where: { id: testStaffId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/staff-salaries', () => {
    it('should fetch salaries list', async () => {
      const response = await request(app)
        .get('/api/staff-salaries')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter salaries by staff ID', async () => {
      const response = await request(app)
        .get(`/api/staff-salaries?staffId=${testStaffId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter salaries by month and year', async () => {
      const response = await request(app)
        .get('/api/staff-salaries?month=10&year=2024')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/staff-salaries/overview', () => {
    it('should fetch payroll overview', async () => {
      const response = await request(app)
        .get('/api/staff-salaries/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalGross');
      expect(response.body.data).toHaveProperty('totalNet');
      expect(response.body.data).toHaveProperty('totalDeductions');
    });
  });

  describe('GET /api/staff-salaries/:id', () => {
    it('should fetch salary by ID', async () => {
      const response = await request(app)
        .get(`/api/staff-salaries/${testSalaryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testSalaryId);
    });

    it('should return 404 for non-existent salary', async () => {
      const response = await request(app)
        .get('/api/staff-salaries/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/staff-salaries/:id/status', () => {
    it('should update salary status', async () => {
      const response = await request(app)
        .put(`/api/staff-salaries/${testSalaryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'APPROVED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put(`/api/staff-salaries/${testSalaryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/staff-salaries/:id/generate-pdf', () => {
    it('should generate salary slip PDF', async () => {
      const response = await request(app)
        .post(`/api/staff-salaries/${testSalaryId}/generate-pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pdfUrl');
    });
  });

  describe('GET /api/staff-salaries/:id/pdf', () => {
    it('should get salary slip PDF URL', async () => {
      const response = await request(app)
        .get(`/api/staff-salaries/${testSalaryId}/pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pdfUrl');
    });
  });

  describe('POST /api/staff-salaries/bulk-generate', () => {
    it('should generate salaries in bulk', async () => {
      const bulkData = {
        staffIds: [testStaffId],
        month: 9,
        year: 2024,
        allowances: [],
        deductions: [],
        notes: 'Bulk generation test',
      };

      const response = await request(app)
        .post('/api/staff-salaries/bulk-generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful).toBeGreaterThan(0);
    });
  });

  describe('POST /api/staff-salaries/bulk-approve', () => {
    it('should approve salaries in bulk', async () => {
      const response = await request(app)
        .post('/api/staff-salaries/bulk-approve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ salaryIds: [testSalaryId] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/staff-salaries/:id', () => {
    it('should delete salary record', async () => {
      const response = await request(app)
        .delete(`/api/staff-salaries/${testSalaryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Salary record deleted successfully');

      // Reset testSalaryId to prevent cleanup error
      testSalaryId = '';
    });

    it('should return 404 for non-existent salary', async () => {
      const response = await request(app)
        .delete('/api/staff-salaries/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
