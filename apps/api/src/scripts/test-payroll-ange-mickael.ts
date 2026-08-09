/**
 * Script pour tester la génération de paie pour l'enseignant "Ange Mickael"
 * Vérifie la configuration et génère la paie
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';
import { PayrollService } from '../services/payroll.service';
import { TeacherRemunerationService } from '../services/teacher-remuneration.service';

// Charger les variables d'environnement
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
    break;
  }
}

async function testPayrollForAngeMickael() {
  try {
    console.log('========================================');
    console.log('Test de génération de paie pour Ange Mickael');
    console.log('========================================');
    console.log('');

    // 1. Trouver l'enseignant
    const teacher = await prisma.teachers.findFirst({
      where: {
        OR: [
          { first_name: { contains: 'Ange', mode: 'insensitive' } },
          { last_name: { contains: 'Mickael', mode: 'insensitive' } },
          { first_name: { contains: 'Mickael', mode: 'insensitive' } },
          { last_name: { contains: 'Ange', mode: 'insensitive' } },
        ],
      },
    });

    if (!teacher) {
      console.log('❌ Enseignant "Ange Mickael" non trouvé');
      console.log('');
      console.log('Liste de tous les enseignants :');
      const allTeachers = await prisma.teachers.findMany({
        select: {
          id: true,
          first_name: true,
          last_name: true,
          contract_type: true,
        },
      });
      allTeachers.forEach(t => {
        console.log(`  - ${t.first_name} ${t.last_name} (${t.contract_type}) - ID: ${t.id}`);
      });
      return;
    }

    console.log(`✅ Enseignant trouvé : ${teacher.first_name} ${teacher.last_name}`);
    console.log(`   - ID: ${teacher.id}`);
    console.log(`   - Type de contrat: ${teacher.contract_type}`);
    console.log(`   - Date d'embauche: ${teacher.hire_date.toISOString().split('T')[0]}`);
    if ((teacher as any).end_date) {
      console.log(`   - Date de fin: ${(teacher as any).end_date.toISOString().split('T')[0]}`);
    }
    console.log('');

    // 2. Vérifier la rémunération
    console.log('📋 Vérification de la rémunération...');
    const remuneration = await prisma.teacher_remuneration.findUnique({
      where: { teacher_id: teacher.id },
    });

    if (!remuneration) {
      console.log('⚠️  Aucune rémunération configurée. Création d\'une rémunération par défaut...');
      const defaultRemuneration = await TeacherRemunerationService.getOrCreateRemuneration(teacher.id);
      console.log('✅ Rémunération par défaut créée');
      console.log(`   - Mode: ${defaultRemuneration.mode_remuneration}`);
      console.log(`   - Forfait mensuel: ${defaultRemuneration.forfait_mensuel || 'Non défini'}`);
      console.log(`   - Taux horaire: ${defaultRemuneration.taux_horaire || 'Non défini'}`);
      console.log(`   - Heures hebdo: ${defaultRemuneration.heures_hebdo || 'Non défini'}`);
      console.log('');
      console.log('❌ PROBLÈME : La rémunération n\'est pas configurée !');
      console.log('   Veuillez configurer la rémunération dans l\'interface (onglet Rémunération du profil enseignant)');
      return;
    }

    console.log('✅ Rémunération trouvée :');
    console.log(`   - Mode: ${remuneration.mode_remuneration}`);
    console.log(`   - Forfait mensuel: ${remuneration.forfait_mensuel ? `${Number(remuneration.forfait_mensuel).toLocaleString()} FCFA` : '❌ NON DÉFINI'}`);
    console.log(`   - Taux horaire: ${remuneration.taux_horaire ? `${Number(remuneration.taux_horaire).toLocaleString()} FCFA/h` : 'Non défini'}`);
    console.log(`   - Heures hebdo: ${remuneration.heures_hebdo || 'Non défini'}`);
    console.log('');

    if (teacher.contract_type === 'CDI' || teacher.contract_type === 'CDD') {
      if (!remuneration.forfait_mensuel || Number(remuneration.forfait_mensuel) === 0) {
        console.log('❌ PROBLÈME : Le forfait mensuel n\'est pas défini pour un contrat CDI/CDD !');
        console.log('   Veuillez configurer le forfait mensuel dans l\'onglet Rémunération du profil enseignant');
        return;
      }
    }

    // 3. Vérifier les primes
    console.log('📋 Vérification des primes...');
    const allowances = await prisma.teacher_allowances.findMany({
      where: { teacher_id: teacher.id },
    });
    console.log(`   - Nombre de primes configurées: ${allowances.length}`);
    if (allowances.length > 0) {
      allowances.forEach(allowance => {
        console.log(`     • ${allowance.title}: ${Number(allowance.amount).toLocaleString()} ${allowance.type_montant === 'MONTANT_FIXE' ? 'FCFA' : '%'} (${allowance.is_recurring ? 'Récurrente' : 'Ponctuelle'})`);
      });
    }
    console.log('');

    // 4. Vérifier les paramètres de paie globaux
    console.log('📋 Vérification des paramètres de paie globaux...');
    const settings = await PayrollService.getSettings();
    console.log(`   - Nombre de semaines par mois: ${settings.nombre_semaines_par_mois}`);
    console.log(`   - Type de règle d'ancienneté: ${settings.seniority_rule_type}`);
    if (settings.seniority_bareme && Array.isArray(settings.seniority_bareme)) {
      console.log(`   - Barème d'ancienneté: ${settings.seniority_bareme.length} palier(s)`);
    }
    console.log('');

    // 5. Calculer l'ancienneté
    console.log('📋 Calcul de l\'ancienneté...');
    const seniorityYears = TeacherRemunerationService.calculateSeniority(teacher.hire_date);
    console.log(`   - Ancienneté: ${seniorityYears} an(s)`);
    console.log('');

    // 6. Tester le calcul du salaire de base
    console.log('📋 Test du calcul du salaire de base...');
    const month = 11; // Novembre
    const year = 2025;
    const { baseSalary, hoursWorked } = await PayrollService.calculateBaseSalary(teacher.id, month, year, settings);
    console.log(`   - Salaire de base calculé: ${Number(baseSalary).toLocaleString()} FCFA`);
    if (hoursWorked) {
      console.log(`   - Heures travaillées: ${Number(hoursWorked)}h`);
    }
    console.log('');

    if (Number(baseSalary) === 0) {
      console.log('❌ PROBLÈME : Le salaire de base est à 0 !');
      if (teacher.contract_type === 'CDI' || teacher.contract_type === 'CDD') {
        console.log('   Pour un contrat CDI/CDD, le forfait mensuel doit être défini.');
      } else if (teacher.contract_type === 'VACATAIRE') {
        console.log('   Pour un vacataire, les heures travaillées doivent être enregistrées pour le mois.');
      }
      return;
    }

    // 7. Tester le calcul des primes
    console.log('📋 Test du calcul des primes...');
    const { totalAllowances } = await PayrollService.calculateAllowances(teacher.id, baseSalary, month, year);
    console.log(`   - Total des primes: ${Number(totalAllowances).toLocaleString()} FCFA`);
    console.log('');

    // 8. Tester le calcul de l'ancienneté
    console.log('📋 Test du calcul de l\'ancienneté...');
    const { bonus: seniorityBonus } = await PayrollService.calculateSeniorityBonus(teacher.id, baseSalary, settings);
    console.log(`   - Prime d'ancienneté: ${Number(seniorityBonus).toLocaleString()} FCFA`);
    console.log('');

    // 9. Générer la paie
    console.log('📋 Génération de la paie...');
    const payroll = await PayrollService.generatePayrollForTeacher(teacher.id, month, year, 'system');
    
    console.log('✅ Paie générée avec succès !');
    console.log('');
    console.log('📊 Résumé de la paie :');
    console.log(`   - Salaire de base: ${Number(payroll.base_salary).toLocaleString()} FCFA`);
    console.log(`   - Total primes: ${Number(payroll.total_allowances).toLocaleString()} FCFA`);
    console.log(`   - Prime ancienneté: ${Number(payroll.seniority_bonus).toLocaleString()} FCFA`);
    console.log(`   - Total brut: ${Number(payroll.total_brut).toLocaleString()} FCFA`);
    console.log(`   - Déductions: ${Number(payroll.deductions).toLocaleString()} FCFA`);
    console.log(`   - Net à payer: ${Number(payroll.net_payable).toLocaleString()} FCFA`);
    console.log(`   - Statut: ${payroll.status}`);
    console.log('');

    // 10. Afficher les détails des items
    if (payroll.items && payroll.items.length > 0) {
      console.log('📋 Détails des lignes de paie :');
      payroll.items.forEach((item: any) => {
        console.log(`   - ${item.item_label}: ${Number(item.amount).toLocaleString()} FCFA`);
      });
    }

    console.log('');
    console.log('========================================');
    console.log('Test terminé avec succès !');
    console.log('========================================');
  } catch (error: any) {
    console.error('');
    console.error('❌ Erreur lors du test :');
    console.error(error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
testPayrollForAngeMickael()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

