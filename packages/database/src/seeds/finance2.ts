import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedFinance2() {
  console.log('🌱 Seeding Finance II data (revenues, expenses, budgets)...');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Get current academic year
  const academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true }
  });

  if (!academicYear) {
    console.log('⚠️  No current academic year found');
    return;
  }

  // === REVENUES ===
  console.log('💰 Creating revenues...');
  const revenues = [
    { source: 'SUBVENTION' as const, amount: 500000, date: new Date(currentYear, 0, 15), description: 'Subvention gouvernementale Q1' },
    { source: 'DON' as const, amount: 200000, date: new Date(currentYear, 1, 10), description: 'Don d\'un partenaire' },
    { source: 'AUTRE' as const, amount: 150000, date: new Date(currentYear, 2, 5), description: 'Vente de manuels scolaires' },
    { source: 'SUBVENTION' as const, amount: 500000, date: new Date(currentYear, 3, 15), description: 'Subvention gouvernementale Q2' },
    { source: 'DON' as const, amount: 300000, date: new Date(currentYear, 5, 20), description: 'Don pour activités sportives' },
  ];

  let revenuesCreated = 0;
  for (const rev of revenues) {
    try {
      await prisma.revenue.create({ data: rev });
      revenuesCreated++;
      console.log(`✅ Revenue: ${rev.source} - ${rev.amount} XAF`);
    } catch (error) {
      console.log(`⚠️  Revenue creation error`);
    }
  }
  console.log(`✅ Created ${revenuesCreated} revenues`);

  // === EXPENSES ===
  console.log('💸 Creating expenses...');
  const expenses = [
    { category: 'FOURNITURES' as const, amount: 150000, date: new Date(currentYear, 0, 20), description: 'Fournitures scolaires - Trim 1', status: 'PAID' as const },
    { category: 'MAINTENANCE' as const, amount: 80000, date: new Date(currentYear, 1, 5), description: 'Réparation électrique', status: 'PAID' as const },
    { category: 'ENERGIE' as const, amount: 120000, date: new Date(currentYear, 1, 28), description: 'Facture électricité Février', status: 'PAID' as const },
    { category: 'FOURNITURES' as const, amount: 200000, date: new Date(currentYear, 2, 15), description: 'Fournitures scolaires - Trim 2', status: 'APPROVED' as const },
    { category: 'TRANSPORT' as const, amount: 95000, date: new Date(currentYear, 3, 10), description: 'Carburant bus scolaire Avril', status: 'APPROVED' as const },
    { category: 'ACTIVITES' as const, amount: 180000, date: new Date(currentYear, 4, 5), description: 'Matériel activités sportives', status: 'PENDING_APPROVAL' as const },
    { category: 'MAINTENANCE' as const, amount: 250000, date: new Date(currentYear, 5, 12), description: 'Peinture des classes', status: 'DRAFT' as const },
    { category: 'ENERGIE' as const, amount: 135000, date: new Date(currentYear, 6, 28), description: 'Facture électricité Juillet', status: 'PAID' as const },
  ];

  let expensesCreated = 0;
  for (const exp of expenses) {
    try {
      await prisma.expense.create({
        data: {
          ...exp,
          supplierName: 'Fournisseur Test',
          invoiceNumber: `INV-${currentYear}-${String(expensesCreated + 1).padStart(4, '0')}`,
        }
      });
      expensesCreated++;
      console.log(`✅ Expense: ${exp.category} - ${exp.amount} XAF (${exp.status})`);
    } catch (error) {
      console.log(`⚠️  Expense creation error`);
    }
  }
  console.log(`✅ Created ${expensesCreated} expenses`);

  // === BUDGETS ===
  console.log('📊 Creating budgets...');
  const budgetCategories = [
    { category: 'SALAIRES' as const, plannedAmount: 3500000, notes: 'Budget salaires personnel enseignant et administratif' },
    { category: 'FOURNITURES' as const, plannedAmount: 600000, notes: 'Fournitures scolaires et administratives' },
    { category: 'MAINTENANCE' as const, plannedAmount: 400000, notes: 'Maintenance et réparations bâtiments' },
    { category: 'TRANSPORT' as const, plannedAmount: 350000, notes: 'Carburant et maintenance bus scolaire' },
    { category: 'ACTIVITES' as const, plannedAmount: 300000, notes: 'Activités extra-scolaires et sorties' },
    { category: 'ENERGIE' as const, plannedAmount: 450000, notes: 'Électricité et eau' },
    { category: 'ASSURANCES' as const, plannedAmount: 200000, notes: 'Assurances bâtiments et responsabilité' },
  ];

  let budgetsCreated = 0;
  for (const bud of budgetCategories) {
    try {
      // Check if budget already exists
      const existing = await prisma.budget.findFirst({
        where: {
          academicYearId: academicYear.id,
          category: bud.category,
        }
      });

      if (!existing) {
        await prisma.budget.create({
          data: {
            academicYearId: academicYear.id,
            ...bud,
            spentAmount: 0,
            remainingAmount: bud.plannedAmount,
          }
        });
        budgetsCreated++;
        console.log(`✅ Budget: ${bud.category} - ${bud.plannedAmount} XAF`);
      } else {
        console.log(`⏭️  Budget already exists: ${bud.category}`);
      }
    } catch (error) {
      console.log(`⚠️  Budget creation error: ${bud.category}`);
    }
  }
  console.log(`✅ Created ${budgetsCreated} budgets`);

  console.log('✅ Finance II seeding completed!');
}
