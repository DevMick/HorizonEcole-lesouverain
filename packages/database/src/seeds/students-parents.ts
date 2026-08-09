import { PrismaClient, StudentStatus, ParentRelation } from '@prisma/client';

const prisma = new PrismaClient();

const firstNames = [
  'Jean', 'Marie', 'Pierre', 'Sophie', 'Paul', 'Julie', 'Marc', 'Catherine',
  'Michel', 'Isabelle', 'Philippe', 'Nathalie', 'Alain', 'Sylvie', 'Bernard',
  'Françoise', 'Daniel', 'Monique', 'Claude', 'Nicole', 'André', 'Christine',
  'Robert', 'Brigitte', 'Jacques', 'Martine', 'Henri', 'Pascale', 'René',
  'Véronique', 'Yves', 'Sandrine', 'Luc', 'Céline', 'Stéphane', 'Caroline',
  'Sébastien', 'Valérie', 'Nicolas', 'Aurélie', 'David', 'Émilie', 'Julien',
  'Amélie', 'Thomas', 'Sarah', 'Antoine', 'Camille', 'Guillaume', 'Élise'
];

const lastNames = [
  'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand',
  'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Leroy',
  'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet',
  'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefevre',
  'Faure', 'Andre', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier',
  'Francois', 'Legrand', 'Gauthier', 'Garcia', 'Perrin', 'Robin', 'Clement',
  'Morin', 'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gautier', 'Masson'
];

const maleNames = firstNames.filter((_, index) => index % 2 === 0);
const femaleNames = firstNames.filter((_, index) => index % 2 === 1);

const classes = [
  { name: '6ème A', level: 'SIXIEME' },
  { name: '6ème B', level: 'SIXIEME' },
  { name: '5ème A', level: 'CINQUIEME' },
  { name: '5ème B', level: 'CINQUIEME' },
  { name: '4ème A', level: 'QUATRIEME' },
  { name: '4ème B', level: 'QUATRIEME' },
  { name: '3ème A', level: 'TROISIEME' },
  { name: '3ème B', level: 'TROISIEME' },
];

const professions = [
  'Enseignant', 'Médecin', 'Ingénieur', 'Avocat', 'Comptable', 'Infirmier',
  'Pharmacien', 'Architecte', 'Policier', 'Pompier', 'Chef d\'entreprise',
  'Commerçant', 'Agriculteur', 'Ouvrier', 'Technicien', 'Secrétaire',
  'Vendeur', 'Chauffeur', 'Électricien', 'Plombier', 'Cuisinier', 'Serveur',
  'Coiffeur', 'Esthéticienne', 'Agent de sécurité', 'Employé de bureau',
  'Fonctionnaire', 'Artisan', 'Retraité', 'Au foyer'
];

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const nationalities = ['Française', 'Sénégalaise', 'Ivoirienne', 'Malienne', 'Burkinabé', 'Nigerienne', 'Togolaise', 'Béninoise'];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generatePhoneNumber(): string {
  const prefixes = ['77', '78', '76', '75', '33'];
  const prefix = getRandomElement(prefixes);
  const number = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `${prefix}${number}`;
}

function generateEmail(firstName: string, lastName: string): string {
  const domains = ['gmail.com', 'yahoo.fr', 'hotmail.com', 'outlook.com', 'orange.fr'];
  const domain = getRandomElement(domains);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
}

function generateStudentNumber(): string {
  const year = new Date().getFullYear();
  const number = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `STU${year}${number}`;
}

function generateBirthDate(): Date {
  const start = new Date(2005, 0, 1);
  const end = new Date(2012, 11, 31);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

function generateEnrollmentDate(): Date {
  const start = new Date(2020, 8, 1); // September 1st
  const end = new Date(2024, 8, 1);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

async function createClasses() {
  console.log('Creating classes...');
  
  const academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true }
  });

  if (!academicYear) {
    throw new Error('No current academic year found');
  }

  const createdClasses = [];
  
  for (const classData of classes) {
    const existingClass = await prisma.schoolClass.findFirst({
      where: {
        name: classData.name,
        academicYearId: academicYear.id
      }
    });

    if (!existingClass) {
      const schoolClass = await prisma.schoolClass.create({
        data: {
          name: classData.name,
          level: classData.level as any,
          academicYearId: academicYear.id,
          maxStudents: 40,
        }
      });
      createdClasses.push(schoolClass);
    } else {
      createdClasses.push(existingClass);
    }
  }

  return createdClasses;
}

async function createParents() {
  console.log('Creating parents...');
  
  const parents = [];
  
  for (let i = 0; i < 60; i++) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const relation = getRandomElement(['PERE', 'MERE', 'TUTEUR']) as ParentRelation;
    const profession = getRandomElement(professions);
    
    const parent = await prisma.parent.create({
      data: {
        firstName,
        lastName,
        relation,
        phone: generatePhoneNumber(),
        email: Math.random() > 0.3 ? generateEmail(firstName, lastName) : null,
        address: `Adresse ${i + 1}, Dakar, Sénégal`,
        profession,
        workplace: `Entreprise ${i + 1}`,
        isPrimaryContact: Math.random() > 0.5,
        isFinancialResponsible: Math.random() > 0.7,
      }
    });
    
    parents.push(parent);
  }
  
  return parents;
}

async function createStudents(classes: any[], parents: any[]) {
  console.log('Creating students...');
  
  const students = [];
  
  for (let i = 0; i < 30; i++) {
    const gender = Math.random() > 0.5 ? 'MALE' : 'FEMALE';
    const firstName = gender === 'MALE' ? getRandomElement(maleNames) : getRandomElement(femaleNames);
    const lastName = getRandomElement(lastNames);
    const classData = getRandomElement(classes);
    const bloodType = Math.random() > 0.3 ? getRandomElement(bloodTypes) : null;
    const nationality = getRandomElement(nationalities);
    
    const student = await prisma.student.create({
      data: {
        studentNumber: generateStudentNumber(),
        firstName,
        lastName,
        dateOfBirth: generateBirthDate(),
        placeOfBirth: Math.random() > 0.3 ? `Lieu de naissance ${i + 1}` : null,
        gender,
        nationality,
        phone: Math.random() > 0.5 ? generatePhoneNumber() : null,
        email: Math.random() > 0.7 ? generateEmail(firstName, lastName) : null,
        address: `Adresse élève ${i + 1}, Dakar, Sénégal`,
        bloodType,
        allergies: Math.random() > 0.8 ? 'Allergie aux arachides' : null,
        medicalNotes: Math.random() > 0.7 ? 'Notes médicales importantes' : null,
        classId: classData.id,
        enrollmentDate: generateEnrollmentDate(),
        status: getRandomElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']) as StudentStatus,
      }
    });
    
    students.push(student);
  }
  
  return students;
}

async function linkStudentsToParents(students: any[], parents: any[]) {
  console.log('Linking students to parents...');
  
  for (const student of students) {
    // Each student gets 1-2 parents
    const parentCount = Math.random() > 0.5 ? 2 : 1;
    const selectedParents = getRandomElements(parents, parentCount);
    
    for (let i = 0; i < selectedParents.length; i++) {
      const parent = selectedParents[i];
      const relation = i === 0 ? 
        (Math.random() > 0.5 ? 'PERE' : 'MERE') : 
        getRandomElement(['PERE', 'MERE', 'TUTEUR']) as ParentRelation;
      
      await prisma.studentParent.create({
        data: {
          studentId: student.id,
          parentId: parent.id,
          relation,
        }
      });
    }
  }
}

export async function seedStudentsAndParents() {
  try {
    console.log('🌱 Starting students and parents seed...');
    
    // Create classes
    const classes = await createClasses();
    console.log(`✅ Created ${classes.length} classes`);
    
    // Create parents
    const parents = await createParents();
    console.log(`✅ Created ${parents.length} parents`);
    
    // Create students
    const students = await createStudents(classes, parents);
    console.log(`✅ Created ${students.length} students`);
    
    // Link students to parents
    await linkStudentsToParents(students, parents);
    console.log('✅ Linked students to parents');
    
    console.log('🎉 Students and parents seed completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding students and parents:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedStudentsAndParents()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
