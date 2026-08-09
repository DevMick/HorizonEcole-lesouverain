import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
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
    console.log(`✅ Variables d'environnement chargées depuis: ${envPath}`);
    break;
  }
}

/**
 * Génère un numéro d'élève unique
 */
async function generateUniqueStudentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STU${year}`;
  
  // Trouver le dernier numéro pour cette année
  const lastStudent = await prisma.Student.findFirst({
    where: {
      studentNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      studentNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastStudent) {
    const lastSequence = parseInt(lastStudent.studentNumber.replace(prefix, ''));
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

/**
 * Convertit les inscriptions en élèves
 */
async function convertInscriptionsToStudents() {
  console.log('🔄 Début de la conversion des inscriptions en élèves...\n');

  try {
    // 1. Récupérer toutes les inscriptions
    console.log('1️⃣ Récupération des inscriptions...');
    const inscriptions = await prisma.inscriptions.findMany({
      include: {
        academicYear: true,
        class: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    console.log(`   ✅ ${inscriptions.length} inscription(s) trouvée(s)\n`);

    if (inscriptions.length === 0) {
      console.log('⚠️  Aucune inscription à convertir.\n');
      return;
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // 2. Pour chaque inscription, créer l'élève s'il n'existe pas
    for (const inscription of inscriptions) {
      try {
        // Vérifier si l'élève existe déjà
        const existingStudent = await prisma.Student.findFirst({
          where: {
            firstName: inscription.student_first_name,
            lastName: inscription.student_last_name,
            classId: inscription.class_id,
          },
        });

        if (existingStudent) {
          console.log(`   ⏭️  Élève déjà existant: ${inscription.student_first_name} ${inscription.student_last_name}`);
          skipped++;
          continue;
        }

        // Générer un numéro d'élève unique
        const studentNumber = await generateUniqueStudentNumber();

        // Trouver ou créer le parent
        let parent = await prisma.parents.findFirst({
          where: {
            first_name: inscription.parent_first_name,
            last_name: inscription.parent_last_name,
            phone: inscription.parent_contact,
          },
        });

        if (!parent) {
          parent = await prisma.parents.create({
            data: {
              id: randomUUID(),
              first_name: inscription.parent_first_name,
              last_name: inscription.parent_last_name,
              phone: inscription.parent_contact,
              relation: 'AUTRE',
              is_primary_contact: true,
              is_financial_responsible: true,
            },
          });
          console.log(`   ✅ Parent créé: ${parent.first_name} ${parent.last_name}`);
        }

        // Créer l'élève
        const student = await prisma.Student.create({
          data: {
            id: randomUUID(),
            studentNumber,
            firstName: inscription.student_first_name,
            lastName: inscription.student_last_name,
            dateOfBirth: new Date(inscription.student_date_of_birth),
            gender: inscription.student_gender as 'M' | 'F',
            classId: inscription.class_id,
            enrollmentDate: new Date(inscription.created_at),
            status: 'ACTIVE',
            studentParents: {
              create: {
                id: randomUUID(),
                parent_id: parent.id,
                relation: 'AUTRE',
              },
            },
          },
        });

        console.log(`   ✅ Élève créé: ${student.firstName} ${student.lastName} (${student.studentNumber}) - Classe: ${inscription.class?.name || 'N/A'}`);
        created++;

      } catch (error) {
        console.error(`   ❌ Erreur lors de la conversion de l'inscription ${inscription.id}:`, error);
        if (error instanceof Error) {
          console.error(`      Message: ${error.message}`);
        }
        errors++;
      }
    }

    console.log('\n📊 Résumé de la conversion:');
    console.log(`   ✅ Élèves créés: ${created}`);
    console.log(`   ⏭️  Élèves ignorés (déjà existants): ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📝 Total traité: ${inscriptions.length}\n`);

    // 3. Vérifier le résultat
    const totalStudents = await prisma.Student.count();
    console.log(`✅ Total d'élèves dans la base après conversion: ${totalStudents}\n`);

    // 4. Vérifier les élèves de la classe test
    const testClassId = '6d40e2e9-87e4-41a7-a1dd-d47582be7847';
    const studentsInClass = await prisma.Student.count({
      where: {
        classId: testClassId,
      },
    });
    console.log(`✅ Élèves dans la classe 6ème: ${studentsInClass}\n`);

  } catch (error) {
    console.error('❌ Erreur fatale lors de la conversion:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
convertInscriptionsToStudents()
  .then(() => {
    console.log('✅ Script terminé avec succès!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

