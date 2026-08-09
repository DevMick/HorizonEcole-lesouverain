/**
 * Script pour corriger la rémunération de l'enseignant "Ange Mickael"
 * Définit un forfait mensuel par défaut
 */

import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';
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

async function fixRemuneration() {
  try {
    console.log('========================================');
    console.log('Correction de la rémunération pour Ange Mickael');
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

    console.log(`✅ Enseignant trouvé : ${teacher.first_name} ${teacher.last_name}`);
    console.log(`   - Type de contrat: ${teacher.contract_type}`);
    console.log('');

    // Vérifier la rémunération actuelle
    const remuneration = await prisma.teacher_remuneration.findUnique({
      where: { teacher_id: teacher.id },
    });

    if (!remuneration) {
      console.log('❌ Aucune rémunération trouvée');
      return;
    }

    console.log('📋 Rémunération actuelle :');
    console.log(`   - Mode: ${remuneration.mode_remuneration}`);
    console.log(`   - Forfait mensuel: ${remuneration.forfait_mensuel || 'NON DÉFINI'}`);
    console.log('');

    // Demander le forfait mensuel (ou utiliser une valeur par défaut)
    // Pour un CDI, un forfait mensuel typique serait entre 150 000 et 300 000 FCFA
    // Utilisons 200 000 FCFA comme valeur par défaut
    const defaultForfait = 200000; // 200 000 FCFA

    console.log(`💡 Suggestion : Forfait mensuel de ${defaultForfait.toLocaleString()} FCFA`);
    console.log('   (Vous pouvez modifier cette valeur dans l\'interface après)');
    console.log('');

    // Mettre à jour la rémunération
    console.log('🔄 Mise à jour de la rémunération...');
    await TeacherRemunerationService.updateRemuneration(teacher.id, {
      modeRemuneration: 'FORFAIT_MENSUEL',
      forfaitMensuel: defaultForfait,
    });

    console.log('✅ Rémunération mise à jour avec succès !');
    console.log(`   - Forfait mensuel: ${defaultForfait.toLocaleString()} FCFA`);
    console.log('');
    console.log('📝 Note : Vous pouvez maintenant régénérer la paie pour cet enseignant');
    console.log('   et les montants devraient être corrects.');
    console.log('');

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
fixRemuneration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale :', error);
    process.exit(1);
  });

