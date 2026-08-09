import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '@school/database';

// Charger les variables d'environnement
// Essayer plusieurs chemins possibles
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

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL non trouvé. Le script peut échouer.');
}

/**
 * Script de test pour diagnostiquer le problème des élèves
 */
async function testStudents() {
  console.log('🔍 Début du test des élèves...\n');

  try {
    // 1. Test de connexion à la base de données
    console.log('1️⃣ Test de connexion à la base de données...');
    await prisma.$connect();
    console.log('✅ Connexion réussie\n');

    // 2. Compter tous les élèves
    console.log('2️⃣ Comptage des élèves...');
    const totalStudents = await prisma.Student.count();
    console.log(`   Total d'élèves dans la base: ${totalStudents}\n`);

    // 3. Récupérer les 10 premiers élèves
    console.log('3️⃣ Récupération des 10 premiers élèves...');
    const students = await prisma.Student.findMany({
      take: 10,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (students.length === 0) {
      console.log('⚠️  Aucun élève trouvé dans la base de données!\n');
    } else {
      console.log(`   ✅ ${students.length} élève(s) trouvé(s):\n`);
      students.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.firstName} ${student.lastName}`);
        console.log(`      - ID: ${student.id}`);
        console.log(`      - Numéro: ${student.studentNumber}`);
        console.log(`      - classId: ${student.classId || 'NULL ⚠️'}`);
        console.log(`      - Classe: ${student.class?.name || 'Aucune classe ⚠️'}`);
        console.log(`      - Statut: ${student.status}`);
        console.log(`      - Date création: ${student.createdAt}`);
        console.log('');
      });
    }

    // 4. Vérifier les élèves avec classId null
    console.log('4️⃣ Vérification des élèves sans classe...');
    const studentsWithoutClass = await prisma.Student.count({
      where: {
        classId: null,
      },
    });
    console.log(`   Élèves sans classe (classId = null): ${studentsWithoutClass}\n`);

    // 5. Vérifier les élèves avec une classe spécifique
    console.log('5️⃣ Test avec une classe spécifique...');
    const testClassId = '6d40e2e9-87e4-41a7-a1dd-d47582be7847';
    
    // Vérifier si la classe existe
    const testClass = await prisma.schoolClass.findUnique({
      where: { id: testClassId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!testClass) {
      console.log(`   ⚠️  La classe avec l'ID ${testClassId} n'existe pas!\n`);
    } else {
      console.log(`   ✅ Classe trouvée: ${testClass.name} (${testClass.id})\n`);
      
      // Compter les élèves de cette classe
      const studentsInClass = await prisma.Student.count({
        where: {
          classId: testClassId,
        },
      });
      console.log(`   Élèves dans cette classe: ${studentsInClass}\n`);

      // Récupérer les élèves de cette classe
      const studentsInClassList = await prisma.Student.findMany({
        where: {
          classId: testClassId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          classId: true,
        },
        take: 5,
      });

      if (studentsInClassList.length > 0) {
        console.log(`   ✅ ${studentsInClassList.length} élève(s) trouvé(s) dans cette classe:\n`);
        studentsInClassList.forEach((student, index) => {
          console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} (${student.studentNumber})`);
        });
        console.log('');
      } else {
        console.log('   ⚠️  Aucun élève trouvé dans cette classe\n');
      }
    }

    // 6. Lister toutes les classes avec leurs élèves
    console.log('6️⃣ Liste des classes et leurs élèves...');
    const classes = await prisma.schoolClass.findMany({
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
      take: 10,
    });

    if (classes.length === 0) {
      console.log('   ⚠️  Aucune classe trouvée!\n');
    } else {
      console.log(`   ✅ ${classes.length} classe(s) trouvée(s):\n`);
      classes.forEach((cls, index) => {
        console.log(`   ${index + 1}. ${cls.name} (${cls.id})`);
        console.log(`      - Nombre d'élèves: ${cls._count.students}`);
        console.log('');
      });
    }

    // 7. Vérifier les inscriptions
    console.log('7️⃣ Vérification des inscriptions...');
    const inscriptions = await prisma.inscriptions.count();
    console.log(`   Total d'inscriptions: ${inscriptions}\n`);

    if (inscriptions > 0) {
      const recentInscriptions = await prisma.inscriptions.findMany({
        take: 5,
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      console.log(`   ${recentInscriptions.length} inscription(s) récente(s):\n`);
      recentInscriptions.forEach((inscription, index) => {
        console.log(`   ${index + 1}. ${inscription.student_first_name} ${inscription.student_last_name}`);
        console.log(`      - Classe: ${inscription.class?.name || 'N/A'} (${inscription.class_id})`);
        console.log(`      - Année: ${inscription.academicYear?.name || 'N/A'}`);
        console.log(`      - Date: ${inscription.created_at}`);
        console.log('');
      });
    }

    // 8. Test de la requête Prisma comme dans StudentService
    console.log('8️⃣ Test de la requête comme dans StudentService...');
    const where: any = {};
    const [testStudents, testTotal] = await Promise.all([
      prisma.Student.findMany({
        where,
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.Student.count({ where }),
    ]);

    console.log(`   Total trouvé: ${testTotal}`);
    console.log(`   Élèves récupérés: ${testStudents.length}\n`);

    if (testStudents.length > 0) {
      console.log('   Détails du premier élève:');
      const first = testStudents[0];
      console.log(`   - ID: ${first.id}`);
      console.log(`   - Nom: ${first.firstName} ${first.lastName}`);
      console.log(`   - classId: ${first.classId}`);
      console.log(`   - Classe: ${first.class?.name || 'null'}`);
      console.log('');
    }

    // 9. Test avec filtre classId
    console.log('9️⃣ Test avec filtre classId...');
    const classIdFilter = '6d40e2e9-87e4-41a7-a1dd-d47582be7847';
    const whereWithClass: any = {
      classId: classIdFilter,
    };
    
    const [filteredStudents, filteredTotal] = await Promise.all([
      prisma.Student.findMany({
        where: whereWithClass,
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 10,
      }),
      prisma.Student.count({ where: whereWithClass }),
    ]);

    console.log(`   Total avec filtre classId: ${filteredTotal}`);
    console.log(`   Élèves récupérés: ${filteredStudents.length}\n`);

    if (filteredStudents.length > 0) {
      console.log('   Élèves trouvés:');
      filteredStudents.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} (classId: ${student.classId})`);
      });
      console.log('');
    }

    console.log('✅ Test terminé avec succès!\n');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
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
testStudents()
  .then(() => {
    console.log('Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });

