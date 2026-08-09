import { prisma } from '../index';

/**
 * Generate unique student number
 */
async function generateUniqueStudentNumber(): Promise<string> {
  let studentNumber: string;
  let exists = true;
  
  while (exists) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    studentNumber = `STU${year}${random}`;
    
    const existing = await prisma.student.findUnique({
      where: { studentNumber },
    });
    
    exists = !!existing;
  }
  
  return studentNumber;
}

/**
 * Convert approved inscriptions to students
 * @param includePending - If true, also convert PENDING inscriptions
 */
async function convertInscriptionsToStudents(includePending: boolean = false) {
  console.log('🔄 Début de la conversion des inscriptions en étudiants...\n');

  try {
    // Get all inscriptions (approved or pending if includePending is true)
    const where: any = includePending 
      ? { status: { in: ['APPROVED', 'PENDING'] } }
      : { status: 'APPROVED' };

    const inscriptions = await prisma.inscription.findMany({
      where,
      include: {
        class: true,
        academicYear: true,
      },
    });

    const statusText = includePending ? 'approuvée(s) ou en attente' : 'approuvée(s)';
    console.log(`📋 Trouvé ${inscriptions.length} inscription(s) ${statusText}\n`);

    if (inscriptions.length === 0) {
      console.log(`✅ Aucune inscription ${statusText} à convertir.`);
      if (!includePending) {
        console.log('💡 Astuce: Utilisez --include-pending pour convertir aussi les inscriptions en attente.');
      }
      return;
    }

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const inscription of inscriptions) {
      try {
        // Check if student already exists for this inscription
        const existingStudent = await prisma.student.findFirst({
          where: {
            firstName: inscription.studentFirstName,
            lastName: inscription.studentLastName,
            classId: inscription.classId,
          },
        });

        if (existingStudent) {
          console.log(`⏭️  Étudiant déjà existant: ${inscription.studentFirstName} ${inscription.studentLastName} (${inscription.class?.name})`);
          skipped++;
          continue;
        }

        // Generate unique student number
        const studentNumber = await generateUniqueStudentNumber();

        // Find or create parent
        let parent = await prisma.parent.findFirst({
          where: {
            firstName: inscription.parentFirstName,
            lastName: inscription.parentLastName,
            phone: inscription.parentContact,
          },
        });

        if (!parent) {
          parent = await prisma.parent.create({
            data: {
              firstName: inscription.parentFirstName,
              lastName: inscription.parentLastName,
              phone: inscription.parentContact,
              relation: 'AUTRE',
              isPrimaryContact: true,
              isFinancialResponsible: true,
            },
          });
          console.log(`  ✅ Parent créé: ${parent.firstName} ${parent.lastName}`);
        } else {
          console.log(`  ℹ️  Parent existant trouvé: ${parent.firstName} ${parent.lastName}`);
        }

        // Create student with default values
        const defaultDateOfBirth = new Date();
        defaultDateOfBirth.setFullYear(defaultDateOfBirth.getFullYear() - 10);

        const student = await prisma.student.create({
          data: {
            studentNumber,
            firstName: inscription.studentFirstName,
            lastName: inscription.studentLastName,
            dateOfBirth: defaultDateOfBirth,
            gender: 'M',
            classId: inscription.classId,
            enrollmentDate: new Date(),
            status: 'ACTIVE',
            studentParents: {
              create: {
                parentId: parent.id,
                relation: 'AUTRE',
              },
            },
          },
        });

        console.log(`✅ Étudiant créé: ${student.firstName} ${student.lastName} (${student.studentNumber}) - Classe: ${inscription.class?.name}`);
        converted++;

      } catch (error: any) {
        console.error(`❌ Erreur lors de la conversion de l'inscription ${inscription.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Résumé de la conversion:');
    console.log(`   ✅ Convertis: ${converted}`);
    console.log(`   ⏭️  Ignorés (déjà existants): ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`\n✅ Conversion terminée!\n`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la conversion:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  const includePending = process.argv.includes('--include-pending') || process.argv.includes('-p');
  
  convertInscriptionsToStudents(includePending)
    .catch((error) => {
      console.error('Erreur fatale:', error);
      process.exit(1);
    });
}

export { convertInscriptionsToStudents };

