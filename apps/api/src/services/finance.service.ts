import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ========== REVENUE SERVICE ==========

const createRevenueSchema = z.object({
  source: z.enum(['SCOLARITE', 'INSCRIPTION', 'CANTINE', 'TRANSPORT', 'SUBVENTION', 'DON', 'AUTRE']),
  amount: z.number().positive(),
  date: z.string().transform(str => new Date(str)),
  description: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']).optional(),
  reference: z.string().optional(),
});

const updateRevenueSchema = createRevenueSchema.partial();

export class RevenueService {
  static async getRevenues(filters: any = {}) {
    const { source, startDate, endDate, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (source) where.source = source;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Revenue model does not exist in schema
    const revenues: any[] = [];
    const total = 0;

    return { revenues, pagination: { page, limit, total, totalPages: 0 } };
  }

  static async getRevenueById(id: string) {
    // Revenue model does not exist in schema
    throw new Error('Revenue model does not exist in schema');
  }

  static async createRevenue(data: z.infer<typeof createRevenueSchema>, recordedBy: string) {
    // Revenue model does not exist in schema
    throw new Error('Revenue model does not exist in schema');
  }

  static async updateRevenue(id: string, data: z.infer<typeof updateRevenueSchema>) {
    throw new Error('Revenue model does not exist in schema');
  }

  static async deleteRevenue(id: string) {
    throw new Error('Revenue model does not exist in schema');
  }

  static async getRevenueStats(filters: any = {}) {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [total, totalAmount, bySource] = await Promise.all([
      Promise.resolve(0), // Revenue model does not exist in schema
      Promise.resolve({ _sum: { amount: 0 } }), // Revenue model does not exist in schema
      Promise.resolve([]), // Revenue model does not exist in schema
    ]);

    return { totalRevenues: total, totalAmount: totalAmount._sum.amount || 0, revenuesBySource: bySource };
  }
}

// ========== EXPENSE SERVICE ==========

const createExpenseSchema = z.object({
  category: z.enum(['SALAIRES', 'FOURNITURES', 'MAINTENANCE', 'TRANSPORT', 'ACTIVITES', 'ENERGIE', 'LOYER', 'ASSURANCES', 'AUTRE']),
  amount: z.number().positive(),
  date: z.string().transform(str => new Date(str)),
  description: z.string(),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceUrl: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']).optional(),
  paymentReference: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED']).optional().default('DRAFT'),
});

const updateExpenseSchema = createExpenseSchema.partial();

export class ExpenseService {
  static async getExpenses(filters: any = {}) {
    const { category, status, startDate, endDate, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      prisma.expenses.findMany({
        where,
        include: {
          recordedBy: { select: { id: true, email: true } },
          approvedBy: { select: { id: true, email: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expenses.count({ where }),
    ]);

    return { expenses, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getExpenseById(id: string) {
    const expense = await prisma.expenses.findUnique({
      where: { id },
      include: { recordedBy: true, approvedBy: true },
    });
    if (!expense) throw new Error('Expense not found');
    return expense;
  }

  static async createExpense(data: z.infer<typeof createExpenseSchema>, recordedBy: string) {
    return await prisma.expenses.create({
      data: { 
        id: crypto.randomUUID(),
        category: data.category,
        amount: data.amount,
        date: data.date,
        description: data.description,
        supplier_name: data.supplierName,
        invoice_number: data.invoiceNumber,
        invoice_url: data.invoiceUrl,
        payment_method: data.paymentMethod,
        payment_reference: data.paymentReference,
        status: data.status || 'DRAFT',
        recordedBy: { connect: { id: recordedBy } },
      },
      include: { recordedBy: true },
    });
  }

  static async updateExpense(id: string, data: z.infer<typeof updateExpenseSchema>) {
    const expense = await prisma.expenses.findUnique({ where: { id } });
    if (!expense) throw new Error('Expense not found');
    return await prisma.expenses.update({
      where: { id },
      data,
      include: { recordedBy: true, approvedBy: true },
    });
  }

  static async approveExpense(id: string, approvedBy: string) {
    const expense = await prisma.expenses.findUnique({ where: { id } });
    if (!expense) throw new Error('Expense not found');
    
    return await prisma.expenses.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approved_by: approvedBy,
        approved_at: new Date(),
      },
      include: { recordedBy: true, approvedBy: true },
    });
  }

  static async deleteExpense(id: string) {
    const expense = await prisma.expenses.findUnique({ where: { id } });
    if (!expense) throw new Error('Expense not found');
    if (expense.status === 'PAID') throw new Error('Cannot delete paid expense');
    await prisma.expenses.delete({ where: { id } });
    return { message: 'Expense deleted successfully' };
  }

  static async getExpenseStats(filters: any = {}) {
    const where: any = {};
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [total, totalAmount, byCategory, byStatus] = await Promise.all([
      prisma.expenses.count({ where }),
      prisma.expenses.aggregate({ where, _sum: { amount: true } }),
      prisma.expenses.groupBy({ by: ['category'], where, _count: true, _sum: { amount: true } }),
      prisma.expenses.groupBy({ by: ['status'], where, _count: true, _sum: { amount: true } }),
    ]);

    return {
      totalExpenses: total,
      totalAmount: totalAmount._sum.amount || 0,
      expensesByCategory: byCategory,
      expensesByStatus: byStatus,
    };
  }
}

// ========== BUDGET SERVICE ==========

const createBudgetSchema = z.object({
  academicYearId: z.string().uuid(),
  category: z.enum(['SALAIRES', 'FOURNITURES', 'MAINTENANCE', 'TRANSPORT', 'ACTIVITES', 'ENERGIE', 'LOYER', 'ASSURANCES', 'AUTRE']),
  plannedAmount: z.number().positive(),
  notes: z.string().optional(),
});

const updateBudgetSchema = createBudgetSchema.partial();

export class BudgetService {
  static async getBudgets(filters: any = {}) {
    const { academicYearId, category, page = 1, limit = 50 } = filters;
    const where: any = {};

    if (academicYearId) where.academicYearId = academicYearId;
    if (category) where.category = category;

    const [budgets, total] = await Promise.all([
      prisma.budgets.findMany({
        where,
        include: { academicYear: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budgets.count({ where }),
    ]);

    return { budgets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getBudgetById(id: string) {
    const budget = await prisma.budgets.findUnique({
      where: { id },
      include: { academicYear: true },
    });
    if (!budget) throw new Error('Budget not found');
    return budget;
  }

  static async createBudget(data: z.infer<typeof createBudgetSchema>) {
    const academicYear = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
    if (!academicYear) throw new Error('Academic year not found');

    const existingBudget = await prisma.budgets.findFirst({
      where: {
        academic_year_id: data.academicYearId,
        category: data.category,
      }
    });

    if (existingBudget) throw new Error('Budget already exists for this category and academic year');

    return await prisma.budgets.create({
      data: {
        id: crypto.randomUUID(),
        academicYear: { connect: { id: data.academicYearId } },
        category: data.category,
        planned_amount: data.plannedAmount,
        remaining_amount: data.plannedAmount,
        notes: data.notes,
      },
      include: { academicYear: true },
    });
  }

  static async updateBudget(id: string, data: z.infer<typeof updateBudgetSchema>) {
    const budget = await prisma.budgets.findUnique({ where: { id } });
    if (!budget) throw new Error('Budget not found');

    const updateData: any = { ...data };
    if (data.plannedAmount !== undefined) {
      updateData.remaining_amount = data.plannedAmount - Number(budget.spent_amount);
    }

    return await prisma.budgets.update({
      where: { id },
      data: updateData,
      include: { academicYear: true },
    });
  }

  static async deleteBudget(id: string) {
    const budget = await prisma.budgets.findUnique({ where: { id } });
    if (!budget) throw new Error('Budget not found');
    await prisma.budgets.delete({ where: { id } });
    return { message: 'Budget deleted successfully' };
  }

  static async getBudgetStats(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;

    const [total, totals, byCategory] = await Promise.all([
      prisma.budgets.count({ where }),
      prisma.budgets.aggregate({
        where,
        _sum: { planned_amount: true, spent_amount: true, remaining_amount: true },
      }),
      prisma.budgets.groupBy({ by: ['category'], where, _sum: { planned_amount: true, spent_amount: true } }),
    ]);

    return {
      totalBudgets: total,
      totalPlanned: Number(totals._sum.planned_amount || 0),
      totalSpent: Number(totals._sum.spent_amount || 0),
      totalRemaining: Number(totals._sum.remaining_amount || 0),
      budgetsByCategory: byCategory,
    };
  }
}

// ========== BUDGET LINE SERVICE ==========

const createBudgetLineSchema = z.object({
  academicYearId: z.string().uuid(),
  title: z.string().min(1).max(200),
  amount: z.number().min(0).optional(), // Allow 0 for parent lines that will have children
  type: z.enum(['DEPENSES', 'REVENUS']),
  parentId: z.string().uuid().optional().nullable(),
});

const updateBudgetLineSchema = createBudgetLineSchema.partial();

export class BudgetLineService {
  // Helper function to recalculate parent amount based on children
  static async recalculateParentAmount(parentId: string) {
    const children = await prisma.budget_lines.findMany({
      where: { parent_id: parentId },
    });

    const totalAmount = children.reduce((sum, child) => {
      return sum + Number(child.amount);
    }, 0);

    await prisma.budget_lines.update({
      where: { id: parentId },
      data: { amount: totalAmount },
    });

    // Recursively update grandparent if exists
    const parent = await prisma.budget_lines.findUnique({
      where: { id: parentId },
      select: { parent_id: true },
    });

    if (parent?.parent_id) {
      await this.recalculateParentAmount(parent.parent_id);
    }
  }

  static async getBudgetLines(filters: any = {}) {
    const { academicYearId, type, parentId, page = 1, limit = 1000 } = filters;
    const where: any = {};

    if (academicYearId) where.academic_year_id = academicYearId;
    if (type) where.type = type;
    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        where.parent_id = null;
      } else {
        where.parent_id = parentId;
      }
    }

    const [budgetLines, total] = await Promise.all([
      prisma.budget_lines.findMany({
        where,
        include: {
          academicYear: { select: { id: true, name: true } },
          parent: { select: { id: true, title: true } },
          children: { select: { id: true, title: true, amount: true } },
        },
        orderBy: { created_at: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budget_lines.count({ where }),
    ]);

    return { budgetLines, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getBudgetLineById(id: string) {
    const budgetLine = await prisma.budget_lines.findUnique({
      where: { id },
      include: {
        academicYear: true,
        parent: true,
        children: true,
      },
    });
    if (!budgetLine) throw new Error('Budget line not found');
    return budgetLine;
  }

  static async createBudgetLine(data: z.infer<typeof createBudgetLineSchema>) {
    // Vérifier que l'année académique existe
    const academicYear = await prisma.academicYear.findUnique({ where: { id: data.academicYearId } });
    if (!academicYear) throw new Error('Academic year not found');

    // Si un parent est spécifié, vérifier qu'il existe et qu'il est du même type
    if (data.parentId) {
      const parent = await prisma.budget_lines.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error('Parent budget line not found');
      if (parent.type !== data.type) throw new Error('Parent and child must have the same type');
      if (parent.academic_year_id !== data.academicYearId) throw new Error('Parent and child must be in the same academic year');
      
      // Vérifier que le parent n'a pas déjà un montant (il ne devrait pas en avoir s'il a des enfants)
      // Mais on permet la création de la première sous-ligne
    }

    // Si c'est une sous-ligne (avec parentId), amount est requis
    if (data.parentId && (!data.amount || data.amount <= 0)) {
      throw new Error('Amount is required for child lines');
    }
    
    // Si amount n'est pas fourni et que c'est une ligne parent (sans parentId), 
    // on permet de créer sans montant (il sera recalculé automatiquement si on ajoute des enfants)
    // Si amount est fourni et > 0, on l'utilise (pour les lignes parent sans enfants)
    if (!data.parentId && data.amount === undefined) {
      // Permettre de créer une ligne parent sans montant si elle aura des enfants
      // Le montant sera 0 et sera recalculé après création des enfants
    }

    const budgetLine = await prisma.budget_lines.create({
      data: {
        academic_year_id: data.academicYearId,
        title: data.title,
        amount: data.amount || 0, // Si pas de montant, mettre 0 (sera recalculé)
        type: data.type,
        parent_id: data.parentId || null,
      },
      include: {
        academicYear: true,
        parent: true,
        children: true,
      },
    });

    // Si c'est une sous-ligne, recalculer le montant du parent
    if (data.parentId) {
      await this.recalculateParentAmount(data.parentId);
      // Re-fetch to get updated parent amount
      return await prisma.budget_lines.findUnique({
        where: { id: budgetLine.id },
        include: {
          academicYear: true,
          parent: true,
          children: true,
        },
      });
    }

    return budgetLine;
  }

  static async updateBudgetLine(id: string, data: z.infer<typeof updateBudgetLineSchema>) {
    const budgetLine = await prisma.budget_lines.findUnique({ 
      where: { id },
      include: { children: true },
    });
    if (!budgetLine) throw new Error('Budget line not found');

    // Vérifier si la ligne a des enfants
    const hasChildren = budgetLine.children && budgetLine.children.length > 0;

    // Si la ligne a des enfants, on ne peut pas modifier son montant directement
    if (hasChildren && data.amount !== undefined) {
      throw new Error('Cannot set amount for a parent line with children. Amount is calculated from children.');
    }

    // Si on change le parent, vérifier qu'il existe et qu'il est du même type
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const parent = await prisma.budget_lines.findUnique({ where: { id: data.parentId } });
        if (!parent) throw new Error('Parent budget line not found');
        if (parent.type !== (data.type || budgetLine.type)) throw new Error('Parent and child must have the same type');
        if (parent.academic_year_id !== (data.academicYearId || budgetLine.academic_year_id)) {
          throw new Error('Parent and child must be in the same academic year');
        }
        // Vérifier qu'on ne crée pas une boucle (le parent ne doit pas être un enfant de cette ligne)
        if (parent.parent_id === id) throw new Error('Cannot set a child as parent');
      }
    }

    const oldParentId = budgetLine.parent_id;
    const updateData: any = {};
    if (data.academicYearId) updateData.academic_year_id = data.academicYearId;
    if (data.title) updateData.title = data.title;
    if (data.amount !== undefined && !hasChildren) updateData.amount = data.amount;
    if (data.type) updateData.type = data.type;
    if (data.parentId !== undefined) updateData.parent_id = data.parentId || null;

    const updated = await prisma.budget_lines.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
        parent: true,
        children: true,
      },
    });

    // Recalculer les montants des parents affectés
    if (oldParentId) {
      await this.recalculateParentAmount(oldParentId);
    }
    if (updateData.parent_id) {
      await this.recalculateParentAmount(updateData.parent_id);
    } else if (data.amount !== undefined && !hasChildren && oldParentId) {
      // Si on a modifié le montant d'une sous-ligne, recalculer le parent
      await this.recalculateParentAmount(oldParentId);
    }

    // Re-fetch to get updated parent amounts
    return await prisma.budget_lines.findUnique({
      where: { id },
      include: {
        academicYear: true,
        parent: true,
        children: true,
      },
    });
  }

  static async deleteBudgetLine(id: string) {
    const budgetLine = await prisma.budget_lines.findUnique({ 
      where: { id },
      select: { parent_id: true },
    });
    if (!budgetLine) throw new Error('Budget line not found');

    // Vérifier s'il y a des enfants
    const children = await prisma.budget_lines.findMany({ where: { parent_id: id } });
    if (children.length > 0) {
      throw new Error('Cannot delete budget line with children. Please delete children first.');
    }

    const parentId = budgetLine.parent_id;
    await prisma.budget_lines.delete({ where: { id } });

    // Recalculer le montant du parent si la ligne supprimée était une sous-ligne
    if (parentId) {
      await this.recalculateParentAmount(parentId);
    }

    return { message: 'Budget line deleted successfully' };
  }

  static async getBudgetLineStats(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) where.academic_year_id = academicYearId;

    const [total, totals, byType] = await Promise.all([
      prisma.budget_lines.count({ where }),
      prisma.budget_lines.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.budget_lines.groupBy({ by: ['type'], where, _count: true, _sum: { amount: true } }),
    ]);

    return {
      totalBudgetLines: total,
      totalAmount: totals._sum.amount || 0,
      budgetLinesByType: byType,
    };
  }
}

// ========== BUDGET TRANSACTION SERVICE ==========

const createBudgetTransactionSchema = z.object({
  budgetLineId: z.string().uuid(),
  amount: z.number().positive(),
  transactionDate: z.string().transform(str => new Date(str)),
  description: z.string().optional(),
  justificatifUrl: z.string().optional(),
  justificatifFilename: z.string().optional(),
});

const updateBudgetTransactionSchema = createBudgetTransactionSchema.partial();

export class BudgetTransactionService {
  static async getTransactions(filters: any = {}) {
    const { budgetLineId, type, startDate, endDate, page = 1, limit = 100 } = filters;
    const where: any = {};

    if (budgetLineId) where.budget_line_id = budgetLineId;
    if (type) {
      where.budgetLine = { type };
    }
    if (startDate || endDate) {
      where.transaction_date = {};
      if (startDate) where.transaction_date.gte = new Date(startDate);
      if (endDate) where.transaction_date.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.budget_transactions.findMany({
        where,
        include: {
          budgetLine: {
            select: {
              id: true,
              title: true,
              amount: true,
              type: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { transaction_date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budget_transactions.count({ where }),
    ]);

    return { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getTransactionById(id: string) {
    const transaction = await prisma.budget_transactions.findUnique({
      where: { id },
      include: {
        budgetLine: {
          include: {
            academicYear: true,
          },
        },
        creator: true,
      },
    });
    if (!transaction) throw new Error('Transaction not found');
    return transaction;
  }

  static async createTransaction(data: z.infer<typeof createBudgetTransactionSchema>, createdBy: string) {
    // Vérifier que la ligne budgétaire existe
    const budgetLine = await prisma.budget_lines.findUnique({ where: { id: data.budgetLineId } });
    if (!budgetLine) throw new Error('Budget line not found');

    return await prisma.budget_transactions.create({
      data: {
        budget_line_id: data.budgetLineId,
        amount: data.amount,
        transaction_date: data.transactionDate,
        description: data.description,
        justificatif_url: data.justificatifUrl,
        justificatif_filename: data.justificatifFilename,
        created_by: createdBy,
      },
      include: {
        budgetLine: {
          include: {
            academicYear: true,
          },
        },
        creator: true,
      },
    });
  }

  static async updateTransaction(id: string, data: z.infer<typeof updateBudgetTransactionSchema>) {
    const transaction = await prisma.budget_transactions.findUnique({ where: { id } });
    if (!transaction) throw new Error('Transaction not found');

    const updateData: any = {};
    if (data.budgetLineId) updateData.budget_line_id = data.budgetLineId;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.transactionDate) updateData.transaction_date = data.transactionDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.justificatifUrl !== undefined) updateData.justificatif_url = data.justificatifUrl;
    if (data.justificatifFilename !== undefined) updateData.justificatif_filename = data.justificatifFilename;

    return await prisma.budget_transactions.update({
      where: { id },
      data: updateData,
      include: {
        budgetLine: {
          include: {
            academicYear: true,
          },
        },
        creator: true,
      },
    });
  }

  static async deleteTransaction(id: string) {
    const transaction = await prisma.budget_transactions.findUnique({ where: { id } });
    if (!transaction) throw new Error('Transaction not found');

    await prisma.budget_transactions.delete({ where: { id } });
    return { message: 'Transaction deleted successfully' };
  }

  static async getBudgetComparison(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) {
      where.academicYear = { academic_year_id: academicYearId };
    }

    // Récupérer toutes les lignes budgétaires avec leurs transactions
    const budgetLines = await prisma.budget_lines.findMany({
      where: where.academicYear ? { academic_year_id: academicYearId } : {},
      include: {
        academicYear: true,
        transactions: true,
      },
    });

    // Calculer les totaux
    const comparison = budgetLines.map((line) => {
      const planned = Number(line.amount);
      const executed = line.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const difference = executed - planned;
      const percentage = planned > 0 ? (executed / planned) * 100 : 0;

      return {
        budgetLineId: line.id,
        title: line.title,
        type: line.type,
        academicYear: line.academicYear.name,
        planned,
        executed,
        difference,
        percentage: Math.round(percentage * 100) / 100,
        transactionCount: line.transactions.length,
      };
    });

    // Totaux par type
    const totalsByType = {
      DEPENSES: {
        planned: comparison.filter(c => c.type === 'DEPENSES').reduce((sum, c) => sum + c.planned, 0),
        executed: comparison.filter(c => c.type === 'DEPENSES').reduce((sum, c) => sum + c.executed, 0),
      },
      REVENUS: {
        planned: comparison.filter(c => c.type === 'REVENUS').reduce((sum, c) => sum + c.planned, 0),
        executed: comparison.filter(c => c.type === 'REVENUS').reduce((sum, c) => sum + c.executed, 0),
      },
    };

    return {
      comparison,
      totalsByType,
      summary: {
        totalPlanned: totalsByType.DEPENSES.planned + totalsByType.REVENUS.planned,
        totalExecuted: totalsByType.DEPENSES.executed + totalsByType.REVENUS.executed,
        netBalance: totalsByType.REVENUS.executed - totalsByType.DEPENSES.executed,
      },
    };
  }
}

export {
  createRevenueSchema, updateRevenueSchema,
  createExpenseSchema, updateExpenseSchema,
  createBudgetSchema, updateBudgetSchema,
  createBudgetLineSchema, updateBudgetLineSchema,
  createBudgetTransactionSchema, updateBudgetTransactionSchema,
};
