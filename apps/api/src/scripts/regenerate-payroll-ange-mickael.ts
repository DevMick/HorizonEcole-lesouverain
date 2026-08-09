/**
 * Script pour supprimer l'ancienne paie et régénérer pour Ange Mickael
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';
import { PayrollService } from '../services/payroll.service';

// Charger les variables d'environnement
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    break;
  }
}

async function regeneratePayroll() {
  try {
    console.log('========================================');
    console.log('Régénération de la paie pour Ange Mickael');
    console.log('========================================');
    console.log('');

    // Trouver l'enseignant
    const teacher = await prisma.teachers.findFirst({
      where: {
        OR: [
          { first_name: { contains: 'Ange', mode: 'insensitive' } },
          { last_name: { contains: 'Mickael', mode: 'insensitive' } },
        ],
      },
    });

    if (!teacher) {
      console.log('❌ Enseignant "Ange Mickael" non trouvé');
      return;
    }

    const month = 11; // Novembre
    const year = 2025;

    // Supprimer l'ancienne paie si elle existe
    console.log('🗑️  Suppression de l\'ancienne paie...');
    const deleted = await prisma.monthly_payrolls.deleteMany({
      where: {
        teacher_id: teacher.id,
        month,
        year,
      },
    });
    console.log(`   - ${deleted.count} paie(s) supprimée(s)`);
    console.log('');

    // Trouver un utilisateur admin ou utiliser null
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    const createdBy = adminUser?.id || null;

    // Régénérer la paie
    console.log('🔄 Génération de la nouvelle paie...');
    const payroll = await PayrollService.generatePayrollForTeacher(teacher.id, month, year, createdBy || undefined);

    console.log('✅ Paie régénérée avec succès !');
    console.log('');
    console.log('📊 Résumé de la paie :');
    console.log(`   - Salaire de base: ${Number(payroll.base_salary).toLocaleString()} FCFA`);
    console.log(`   - Total primes: ${Number(payroll.total_allowances).toLocaleString()} FCFA`);
    console.log(`   - Prime ancienneté: ${Number(payroll.seniority_bonus).toLocaleString()} FCFA`);
    console.log(`   - Total brut: ${Number(payroll.total_brut).toLocaleString()} FCFA`);
    console.log(`   - Déductions: ${Number(payroll.deductions).toLocaleString()} FCFA`);
    console.log(`   - Net à payer: ${Number(payroll.net_payable).toLocaleString()} FCFA`);
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('❌ Erreur :');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
regeneratePayroll()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

