import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient, TeacherContractType } from '@prisma/client';

// Load .env file from root directory
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// Also try loading from current working directory
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

const prisma = new PrismaClient();

export async function seedTeachers() {
  console.log('🌱 Seeding teachers data...');

  // Liste des 8 enseignants avec leurs spécialisations correspondant aux matières
  const teachersData = [
    {
      first_name: 'Amadou',
      last_name: 'Traoré',
      email: 'amadou.traore@souverainlarabia.edu.ci',
      phone: '+2250701234567',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2020-09-01'),
      specialties: 'ANGLAIS',
      qualifications: 'Master en Langues Étrangères Appliquées, Certificat d\'Aptitude à l\'Enseignement de l\'Anglais',
    },
    {
      first_name: 'Fatou',
      last_name: 'Diallo',
      email: 'fatou.diallo@souverainlarabia.edu.ci',
      phone: '+2250701234568',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2021-09-01'),
      specialties: 'EDHC',
      qualifications: 'Master en Éducation Civique et Morale, Certificat d\'Aptitude Pédagogique',
    },
    {
      first_name: 'Ibrahim',
      last_name: 'Cissé',
      email: 'ibrahim.cisse@souverainlarabia.edu.ci',
      phone: '+2250701234569',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2019-09-01'),
      specialties: 'EPS',
      qualifications: 'Master en Éducation Physique et Sportive, Brevet d\'État d\'Éducateur Sportif',
    },
    {
      first_name: 'Aissatou',
      last_name: 'Sangaré',
      email: 'aissatou.sangare@souverainlarabia.edu.ci',
      phone: '+2250701234570',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2020-09-01'),
      specialties: 'FRANÇAIS',
      qualifications: 'Master en Lettres Modernes, Certificat d\'Aptitude à l\'Enseignement du Français',
    },
    {
      first_name: 'Moussa',
      last_name: 'Kouyaté',
      email: 'moussa.kouyate@souverainlarabia.edu.ci',
      phone: '+2250701234571',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2021-09-01'),
      specialties: 'H.G',
      qualifications: 'Master en Histoire-Géographie, Certificat d\'Aptitude à l\'Enseignement de l\'Histoire-Géographie',
    },
    {
      first_name: 'Kouassi',
      last_name: 'Yao',
      email: 'kouassi.yao@souverainlarabia.edu.ci',
      phone: '+2250701234572',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2020-09-01'),
      specialties: 'INFORMATIQUE',
      qualifications: 'Master en Informatique, Certificat d\'Aptitude à l\'Enseignement de l\'Informatique',
    },
    {
      first_name: 'Bakary',
      last_name: 'Diabaté',
      email: 'bakary.diabate@souverainlarabia.edu.ci',
      phone: '+2250701234573',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2020-09-01'),
      specialties: 'PH-CH',
      qualifications: 'Master en Physique-Chimie, Certificat d\'Aptitude à l\'Enseignement des Sciences Physiques',
    },
    {
      first_name: 'Mariam',
      last_name: 'Coulibaly',
      email: 'mariam.coulibaly@souverainlarabia.edu.ci',
      phone: '+2250701234574',
      contract_type: TeacherContractType.CDI,
      hire_date: new Date('2021-09-01'),
      specialties: 'SVT',
      qualifications: 'Master en Sciences de la Vie et de la Terre, Certificat d\'Aptitude à l\'Enseignement de la Biologie',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const teacherData of teachersData) {
    try {
      // Check if teacher already exists
      const existing = await prisma.teachers.findUnique({
        where: { email: teacherData.email },
      });

      if (existing) {
        // Update existing teacher
        const teacher = await prisma.teachers.update({
          where: { email: teacherData.email },
          data: {
            specialties: teacherData.specialties,
            qualifications: teacherData.qualifications,
          },
        });
        console.log(`✅ Teacher updated: ${teacher.first_name} ${teacher.last_name} - ${teacherData.specialties}`);
        created++;
      } else {
        // Create new teacher
        const teacher = await prisma.teachers.create({
          data: {
            id: randomUUID(),
            ...teacherData,
          },
        });
        console.log(`✅ Teacher created: ${teacher.first_name} ${teacher.last_name} - ${teacherData.specialties}`);
        created++;
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⏭️  Teacher already exists: ${teacherData.email}`);
        skipped++;
      } else {
        console.error(`❌ Error creating teacher ${teacherData.email}:`, error.message);
      }
    }
  }

  console.log(`🎉 Teachers seeding completed! Created/Updated: ${created}, Skipped: ${skipped}`);
}

// Run if called directly
if (require.main === module) {
  seedTeachers()
    .catch((e) => {
      console.error('❌ Error seeding teachers:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

