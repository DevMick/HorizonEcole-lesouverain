import request from 'supertest';
import { app } from '../index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Finance II - Payments, Revenues, Expenses, Budgets', () => {
  let authToken: string;
  let testStudentId: string;
  let testScheduleId: string;
  let testPaymentId: string;
  let testRevenueId: string;
  let testExpenseId: string;
  let testBudgetId: string;
  let testAcademicYearId: string;

  beforeAll(async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    authToken = loginResponse.body.token;

    const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    testAcademicYearId = academicYear!.id;

    const student = await prisma.student.findFirst({ where: { status: 'ACTIVE' } });
    testStudentId = student!.id;

    const schedule = await prisma.paymentSchedule.findFirst({ where: { studentId: testStudentId, status: 'PENDING' } });
    testScheduleId = schedule?.id || '';
  });

  afterAll(async () => {
    if (testPaymentId) await prisma.payment.deleteMany({ where: { id: testPaymentId } });
    if (testRevenueId) await prisma.revenue.delete({ where: { id: testRevenueId } });
    if (testExpenseId) await prisma.expense.delete({ where: { id: testExpenseId } });
    if (testBudgetId) await prisma.budget.delete({ where: { id: testBudgetId } });
    await prisma.$disconnect();
  });

  // ========== PAYMENTS ==========
  describe('Payments API', () => {
    it('should create a payment and update schedule balance', async () => {
      if (!testScheduleId) {
        console.log('⚠️  No schedule available for testing');
        return;
      }

      const scheduleBefore = await prisma.paymentSchedule.findUnique({ where: { id: testScheduleId } });
      
      const paymentData = {
        studentId: testStudentId,
        paymentScheduleId: testScheduleId,
        amount: 10000,
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString(),
        notes: 'Test payment',
      };

      const response = await request(app).post('/api/payments').set('Authorization', `Bearer ${authToken}`).send(paymentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('receiptNumber');
      testPaymentId = response.body.data.id;

      // Verify schedule balance updated
      const scheduleAfter = await prisma.paymentSchedule.findUnique({ where: { id: testScheduleId } });
      expect(Number(scheduleAfter!.paidAmount)).toBe(Number(scheduleBefore!.paidAmount) + paymentData.amount);
    });

    it('should fetch payments list', async () => {
      const response = await request(app).get('/api/payments').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should generate receipt PDF', async () => {
      if (!testPaymentId) return;
      const response = await request(app).post(`/api/payments/${testPaymentId}/receipt`).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('receiptUrl');
    });
  });

  // ========== REVENUES ==========
  describe('Revenues API', () => {
    it('should create revenue', async () => {
      const revenueData = { source: 'DON', amount: 50000, date: new Date().toISOString(), description: 'Test donation' };
      const response = await request(app).post('/api/revenues').set('Authorization', `Bearer ${authToken}`).send(revenueData);
      expect(response.status).toBe(201);
      testRevenueId = response.body.data.id;
    });

    it('should fetch revenues list', async () => {
      const response = await request(app).get('/api/revenues').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should update revenue', async () => {
      if (!testRevenueId) return;
      const response = await request(app).put(`/api/revenues/${testRevenueId}`).set('Authorization', `Bearer ${authToken}`).send({ amount: 60000 });
      expect(response.status).toBe(200);
    });
  });

  // ========== EXPENSES ==========
  describe('Expenses API', () => {
    it('should create expense', async () => {
      const expenseData = { category: 'FOURNITURES', amount: 25000, date: new Date().toISOString(), description: 'Test expense' };
      const response = await request(app).post('/api/expenses').set('Authorization', `Bearer ${authToken}`).send(expenseData);
      expect(response.status).toBe(201);
      testExpenseId = response.body.data.id;
    });

    it('should fetch expenses list', async () => {
      const response = await request(app).get('/api/expenses').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should approve expense', async () => {
      if (!testExpenseId) return;
      const response = await request(app).post(`/api/expenses/${testExpenseId}/approve`).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('APPROVED');
    });
  });

  // ========== BUDGETS ==========
  describe('Budgets API', () => {
    it('should create budget', async () => {
      const budgetData = { academicYearId: testAcademicYearId, category: 'AUTRE', plannedAmount: 100000, notes: 'Test budget' };
      const response = await request(app).post('/api/budgets').set('Authorization', `Bearer ${authToken}`).send(budgetData);
      expect(response.status).toBe(201);
      testBudgetId = response.body.data.id;
    });

    it('should fetch budgets list', async () => {
      const response = await request(app).get('/api/budgets').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should fetch budget stats', async () => {
      const response = await request(app).get('/api/budgets/stats').set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalBudgets');
    });
  });
});
