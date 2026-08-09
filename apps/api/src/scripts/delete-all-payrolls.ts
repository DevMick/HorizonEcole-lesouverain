/**
 * Script pour supprimer toutes les données de paie
 * 
 * Ce script supprime :
 * - Toutes les paies mensuelles (monthly_payrolls)
 * - Toutes les lignes de détail (payroll_items) - supprimées automatiquement via CASCADE
 * - Tous les paiements (payroll_payments) - supprimés automatiquement via CASCADE
 * - Toutes les demandes de correction (payroll_correction_requests) - supprimées automatiquement via CASCADE
 * 
 * ATTENTION : Cette opération est irréversible !
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

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  dotenv.config({ path: envPath });
  if (process.env.DATABASE_URL) {
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.error('❌ Erreur : Impossible de charger les variables d\'environnement (DATABASE_URL non trouvé)');
  process.exit(1);
}

async function deleteAllPayrolls() {
  try {
    console.log('========================================');
    console.log('Suppression de toutes les données de paie');
    console.log('========================================');
    console.log('');

    // Compter les paies avant suppression
    const countBefore = await prisma.monthly_payrolls.count();
    console.log(`Nombre de paies à supprimer : ${countBefore}`);
    console.log('');

    if (countBefore === 0) {
      console.log('Aucune paie à supprimer.');
      return;
    }

    // Supprimer toutes les paies (les tables liées seront supprimées automatiquement via CASCADE)
    console.log('Suppression en cours...');
    const result = await prisma.monthly_payrolls.deleteMany({});

    console.log('');
    console.log(`✅ ${result.count} paie(s) supprimée(s) avec succès !`);
    console.log('');

    // Vérifier que tout a été supprimé
    const countAfter = await prisma.monthly_payrolls.count();
    const itemsCount = await prisma.payroll_items.count();
    const paymentsCount = await prisma.payroll_payments.count();
    const correctionsCount = await prisma.payroll_correction_requests.count();

    console.log('Vérification des suppressions :');
    console.log(`  - Paies mensuelles : ${countAfter} (attendu: 0)`);
    console.log(`  - Lignes de détail : ${itemsCount} (attendu: 0)`);
    console.log(`  - Paiements : ${paymentsCount} (attendu: 0)`);
    console.log(`  - Demandes de correction : ${correctionsCount} (attendu: 0)`);
    console.log('');

    if (countAfter === 0 && itemsCount === 0 && paymentsCount === 0 && correctionsCount === 0) {
      console.log('✅ Toutes les données de paie ont été supprimées avec succès !');
    } else {
      console.log('⚠️  Certaines données n\'ont pas été supprimées.');
    }

    console.log('');
    console.log('========================================');
    console.log('Suppression terminée');
    console.log('========================================');
  } catch (error) {
    console.error('');
    console.error('❌ Erreur lors de la suppression :');
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
deleteAllPayrolls()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

