import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

// Load .env file from root directory
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// Also try loading from current working directory
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

const prisma = new PrismaClient();

export async function seedInscriptions() {
  console.log('🌱 Seeding inscriptions data...');

  try {
    // Get current academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });

    if (!currentYear) {
      throw new Error('Aucune année académique en cours trouvée');
    }

    console.log(`✅ Année académique trouvée: ${currentYear.name}`);

    // Get 6ème class
    const classe6eme = await prisma.schoolClass.findFirst({
      where: { name: { contains: '6ème', mode: 'insensitive' } },
    });

    if (!classe6eme) {
      throw new Error('Classe 6ème non trouvée');
    }

    console.log(`✅ Classe trouvée: ${classe6eme.name}`);

    // 10 élèves avec des noms africains
    // 8 affectés par l'État (is_state_assigned: true), 2 non affectés (is_state_assigned: false)
    const inscriptionsData = [
      {
        student_first_name: 'Aminata',
        student_last_name: 'Diallo',
        student_gender: 'F',
        student_date_of_birth: new Date('2012-03-15'),
        student_birth_place: 'Abidjan',
        parent_first_name: 'Moussa',
        parent_last_name: 'Diallo',
        parent_contact: '+2250701234001',
        residence_location: 'Yopougon',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Ibrahim',
        student_last_name: 'Traoré',
        student_gender: 'M',
        student_date_of_birth: new Date('2012-05-22'),
        student_birth_place: 'Bouaké',
        parent_first_name: 'Fatou',
        parent_last_name: 'Traoré',
        parent_contact: '+2250701234002',
        residence_location: 'Cocody',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Kadiatou',
        student_last_name: 'Cissé',
        student_gender: 'F',
        student_date_of_birth: new Date('2012-07-10'),
        student_birth_place: 'Korhogo',
        parent_first_name: 'Amadou',
        parent_last_name: 'Cissé',
        parent_contact: '+2250701234003',
        residence_location: 'Marcory',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Bakary',
        student_last_name: 'Kouyaté',
        student_gender: 'M',
        student_date_of_birth: new Date('2012-09-18'),
        student_birth_place: 'Daloa',
        parent_first_name: 'Aissatou',
        parent_last_name: 'Kouyaté',
        parent_contact: '+2250701234004',
        residence_location: 'Adjamé',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Mariam',
        student_last_name: 'Sangaré',
        student_gender: 'F',
        student_date_of_birth: new Date('2012-11-25'),
        student_birth_place: 'Man',
        parent_first_name: 'Ousmane',
        parent_last_name: 'Sangaré',
        parent_contact: '+2250701234005',
        residence_location: 'Plateau',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Sékou',
        student_last_name: 'Diabaté',
        student_gender: 'M',
        student_date_of_birth: new Date('2012-01-08'),
        student_birth_place: 'San-Pédro',
        parent_first_name: 'Kadidja',
        parent_last_name: 'Diabaté',
        parent_contact: '+2250701234006',
        residence_location: 'Treichville',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Fatoumata',
        student_last_name: 'Coulibaly',
        student_gender: 'F',
        student_date_of_birth: new Date('2012-04-12'),
        student_birth_place: 'Gagnoa',
        parent_first_name: 'Mamadou',
        parent_last_name: 'Coulibaly',
        parent_contact: '+2250701234007',
        residence_location: 'Abobo',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Youssouf',
        student_last_name: 'Koné',
        student_gender: 'M',
        student_date_of_birth: new Date('2012-06-30'),
        student_birth_place: 'Odienné',
        parent_first_name: 'Aminata',
        parent_last_name: 'Koné',
        parent_contact: '+2250701234008',
        residence_location: 'Anyama',
        is_state_assigned: true,
      },
      {
        student_first_name: 'Aissatou',
        student_last_name: 'Yao',
        student_gender: 'F',
        student_date_of_birth: new Date('2012-08-14'),
        student_birth_place: 'Divo',
        parent_first_name: 'Kouassi',
        parent_last_name: 'Yao',
        parent_contact: '+2250701234009',
        residence_location: 'Port-Bouët',
        is_state_assigned: false, // Non affectée par l'État
      },
      {
        student_first_name: 'Koffi',
        student_last_name: 'Bamba',
        student_gender: 'M',
        student_date_of_birth: new Date('2012-10-05'),
        student_birth_place: 'Bondoukou',
        parent_first_name: 'Akissi',
        parent_last_name: 'Bamba',
        parent_contact: '+2250701234010',
        residence_location: 'Williamsville',
        is_state_assigned: false, // Non affecté par l'État
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const inscriptionData of inscriptionsData) {
      try {
        // Check if inscription already exists (by student name and academic year)
        const existing = await prisma.inscriptions.findFirst({
          where: {
            academic_year_id: currentYear.id,
            class_id: classe6eme.id,
            student_first_name: inscriptionData.student_first_name,
            student_last_name: inscriptionData.student_last_name,
          },
        });

        if (existing) {
          console.log(`⏭️  Inscription déjà existante: ${inscriptionData.student_first_name} ${inscriptionData.student_last_name}`);
          skipped++;
          continue;
        }

        const inscription = await prisma.inscriptions.create({
          data: {
            id: randomUUID(),
            academic_year_id: currentYear.id,
            class_id: classe6eme.id,
            student_first_name: inscriptionData.student_first_name,
            student_last_name: inscriptionData.student_last_name,
            student_gender: inscriptionData.student_gender,
            student_date_of_birth: inscriptionData.student_date_of_birth,
            student_birth_place: inscriptionData.student_birth_place,
            parent_first_name: inscriptionData.parent_first_name,
            parent_last_name: inscriptionData.parent_last_name,
            parent_contact: inscriptionData.parent_contact,
            residence_location: inscriptionData.residence_location,
            is_state_assigned: inscriptionData.is_state_assigned,
            attachments: [], // Pas de fichiers
          },
        });

        console.log(`✅ Inscription créée: ${inscription.student_first_name} ${inscription.student_last_name} - ${inscription.is_state_assigned ? 'Affecté État' : 'Non affecté État'}`);
        created++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⏭️  Inscription déjà existante: ${inscriptionData.student_first_name} ${inscriptionData.student_last_name}`);
          skipped++;
        } else {
          console.error(`❌ Erreur lors de la création de l'inscription ${inscriptionData.student_first_name} ${inscriptionData.student_last_name}:`, error.message);
        }
      }
    }

    console.log(`🎉 Seeding des inscriptions terminé! Créées: ${created}, Ignorées: ${skipped}`);
  } catch (error: any) {
    console.error('❌ Erreur lors du seeding des inscriptions:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedInscriptions()
    .catch((e) => {
      console.error('❌ Erreur lors du seeding des inscriptions:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

