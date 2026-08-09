/**
 * Script de diagnostic pour vérifier pourquoi les primes ne sont pas appliquées
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';

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

async function diagnose() {
  try {
    console.log('========================================');
    console.log('Diagnostic de la paie pour Ange Mickael');
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
      console.log('❌ Enseignant non trouvé');
      return;
    }

    console.log(`✅ Enseignant : ${teacher.first_name} ${teacher.last_name}`);
    console.log('');

    // Vérifier la rémunération
    const remuneration = await prisma.teacher_remuneration.findUnique({
      where: { teacher_id: teacher.id },
    });

    console.log('📋 Rémunération :');
    console.log(`   - Mode: ${remuneration?.mode_remuneration || 'NON DÉFINI'}`);
    console.log(`   - Forfait mensuel: ${remuneration?.forfait_mensuel ? Number(remuneration.forfait_mensuel).toLocaleString() + ' FCFA' : 'NON DÉFINI'}`);
    console.log(`   - Taux horaire: ${remuneration?.taux_horaire ? Number(remuneration.taux_horaire).toLocaleString() + ' FCFA/h' : 'Non défini'}`);
    console.log(`   - Heures hebdo: ${remuneration?.heures_hebdo || 'Non défini'}`);
    console.log('');

    // Vérifier toutes les primes
    const month = 11; // Novembre
    const year = 2025;
    const referenceDate = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    console.log(`📋 Période de calcul : ${referenceDate.toISOString().split('T')[0]} au ${lastDayOfMonth.toISOString().split('T')[0]}`);
    console.log('');

    const allAllowances = await prisma.teacher_allowances.findMany({
      where: { teacher_id: teacher.id },
      orderBy: { created_at: 'desc' },
    });

    console.log(`📋 Toutes les primes configurées (${allAllowances.length}) :`);
    allAllowances.forEach((allowance, index) => {
      console.log(`\n   ${index + 1}. ${allowance.title}`);
      console.log(`      - Montant: ${Number(allowance.amount).toLocaleString()} ${allowance.type_montant === 'MONTANT_FIXE' ? 'FCFA' : '%'}`);
      console.log(`      - Catégorie: ${allowance.category}`);
      console.log(`      - Récurrente: ${allowance.is_recurring ? 'Oui' : 'Non'}`);
      console.log(`      - Taxable: ${allowance.is_taxable ? 'Oui' : 'Non'}`);
      console.log(`      - Date début: ${allowance.effective_from.toISOString().split('T')[0]}`);
      console.log(`      - Date fin: ${allowance.effective_to ? allowance.effective_to.toISOString().split('T')[0] : 'Aucune (en cours)'}`);
      
      // Vérifier si la prime est dans la période
      const isInPeriod = allowance.effective_from <= lastDayOfMonth && 
                        (allowance.effective_to === null || allowance.effective_to >= referenceDate);
      
      console.log(`      - Dans la période ? ${isInPeriod ? '✅ OUI' : '❌ NON'}`);
      
      if (!isInPeriod) {
        if (allowance.effective_from > lastDayOfMonth) {
          console.log(`        ⚠️  La date de début (${allowance.effective_from.toISOString().split('T')[0]}) est après la fin du mois (${lastDayOfMonth.toISOString().split('T')[0]})`);
        }
        if (allowance.effective_to && allowance.effective_to < referenceDate) {
          console.log(`        ⚠️  La date de fin (${allowance.effective_to.toISOString().split('T')[0]}) est avant le début du mois (${referenceDate.toISOString().split('T')[0]})`);
        }
      }
    });
    console.log('');

    // Vérifier les primes récurrentes qui devraient être appliquées
    console.log('📋 Primes récurrentes qui devraient être appliquées :');
    const recurringAllowances = allAllowances.filter(a => 
      a.is_recurring && 
      a.effective_from <= lastDayOfMonth && 
      (a.effective_to === null || a.effective_to >= referenceDate)
    );
    console.log(`   - Nombre: ${recurringAllowances.length}`);
    recurringAllowances.forEach(a => {
      console.log(`     • ${a.title}: ${Number(a.amount).toLocaleString()} ${a.type_montant === 'MONTANT_FIXE' ? 'FCFA' : '%'}`);
    });
    console.log('');

    // Vérifier les primes non récurrentes qui devraient être appliquées
    console.log('📋 Primes non récurrentes qui devraient être appliquées :');
    const nonRecurringAllowances = allAllowances.filter(a => 
      !a.is_recurring && 
      a.effective_from <= lastDayOfMonth && 
      (a.effective_to === null || a.effective_to >= referenceDate)
    );
    console.log(`   - Nombre: ${nonRecurringAllowances.length}`);
    nonRecurringAllowances.forEach(a => {
      console.log(`     • ${a.title}: ${Number(a.amount).toLocaleString()} ${a.type_montant === 'MONTANT_FIXE' ? 'FCFA' : '%'}`);
    });
    console.log('');

    // Vérifier la paie générée
    const payroll = await prisma.monthly_payrolls.findFirst({
      where: {
        teacher_id: teacher.id,
        month,
        year,
      },
      include: {
        items: true,
      },
    });

    if (payroll) {
      console.log('📋 Paie générée :');
      console.log(`   - Salaire de base: ${Number(payroll.base_salary).toLocaleString()} FCFA`);
      console.log(`   - Total primes: ${Number(payroll.total_allowances).toLocaleString()} FCFA`);
      console.log(`   - Prime ancienneté: ${Number(payroll.seniority_bonus).toLocaleString()} FCFA`);
      console.log(`   - Total brut: ${Number(payroll.total_brut).toLocaleString()} FCFA`);
      console.log(`   - Net à payer: ${Number(payroll.net_payable).toLocaleString()} FCFA`);
      console.log('');
      console.log('📋 Lignes de détail de la paie :');
      payroll.items.forEach(item => {
        console.log(`   - ${item.item_label}: ${Number(item.amount).toLocaleString()} FCFA (${item.item_type})`);
      });
    } else {
      console.log('❌ Aucune paie générée pour ce mois');
    }

    console.log('');
    console.log('========================================');
    console.log('Diagnostic terminé');
    console.log('========================================');

  } catch (error: any) {
    console.error('');
    console.error('❌ Erreur :');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
diagnose()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

