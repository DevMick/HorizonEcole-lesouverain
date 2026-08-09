import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from root directory (2 levels up from packages/database)
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// Also try loading from current working directory
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

// Debug: log if DATABASE_URL is loaded
if (process.env.DATABASE_URL) {
  // Mask password in URL for security
  const dbUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log('✅ DATABASE_URL loaded:', dbUrl);
} else {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.log('Tried paths:', envPath, resolve(process.cwd(), '.env'));
}

import { PrismaClient, UserRole, StaffFunction, ContractType, AcademicLevel, StudentStatus, ParentRelation } from '@prisma/client';
import { ALL_MENU_KEYS, PROTECTED_ADMIN_ROLE_NAME } from '@school/types';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { seedStudentsAndParents } from './seeds/students-parents';
import { seedStaff } from './seeds/staff';
import { seedFinance } from './seeds/finance';
import { seedFinance2 } from './seeds/finance2';
import { seedPaymentTypes } from './seeds/paymentTypes';
import { seedTeachers } from './seeds/teachers';
import { seedInscriptions } from './seeds/inscriptions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create the protected "Administrateur" role, wired to every menu key.
  const adminRole = await prisma.role.upsert({
    where: { name: PROTECTED_ADMIN_ROLE_NAME },
    update: { isProtected: true },
    create: {
      id: randomUUID(),
      name: PROTECTED_ADMIN_ROLE_NAME,
      description: 'Rôle système protégé : accès à tous les menus, ne peut être ni modifié ni supprimé.',
      isProtected: true,
    },
  });
  const existingRoleMenus = await prisma.roleMenu.findMany({ where: { roleId: adminRole.id }, select: { menuKey: true } });
  const existingMenuKeys = new Set(existingRoleMenus.map((m) => m.menuKey));
  const missingMenuKeys = ALL_MENU_KEYS.filter((k) => !existingMenuKeys.has(k));
  if (missingMenuKeys.length > 0) {
    await prisma.roleMenu.createMany({ data: missingMenuKeys.map((menuKey) => ({ id: randomUUID(), roleId: adminRole.id, menuKey })) });
  }
  console.log(`✅ Rôle protégé « ${adminRole.name} » synchronisé avec ${ALL_MENU_KEYS.length} menu(s)`);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@souverainlarabia.edu.ci' },
    update: { roleId: adminRole.id, isProtected: true },
    create: {
      id: randomUUID(),
      email: 'admin@souverainlarabia.edu.ci',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'Souverain',
      role: UserRole.ADMIN,
      roleId: adminRole.id,
      isProtected: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create academic year
  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2024-2025' },
    update: {},
    create: {
      id: randomUUID(),
      name: '2024-2025',
      startYear: 2024,
      endYear: 2025,
      isCurrent: true,
    },
  });

  console.log('✅ Academic year created:', academicYear.name);

  // Note: Staff members seeding is commented out as the Staff model may not exist
  // If you need to seed staff, uncomment and ensure the Staff model exists in schema.prisma
  /*
  // Create sample staff members
  const staffMembers = [
    {
      staffNumber: 'STF001',
      firstName: 'Jean',
      lastName: 'Kouassi',
      dateOfBirth: new Date('1985-03-15'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      phone: '+225 07 12 34 56 78',
      email: 'jean.kouassi@souverainlarabia.edu.ci',
      function: StaffFunction.DIRECTEUR,
      contractType: ContractType.CDI,
      hireDate: new Date('2020-09-01'),
      baseSalary: 500000,
      userId: admin.id,
    },
    {
      staffNumber: 'STF002',
      firstName: 'Marie',
      lastName: 'Traoré',
      dateOfBirth: new Date('1990-07-22'),
      gender: 'FEMALE',
      nationality: 'Ivoirienne',
      phone: '+225 05 98 76 54 32',
      email: 'marie.traore@souverainlarabia.edu.ci',
      function: StaffFunction.ENSEIGNANT,
      specialization: 'Mathématiques',
      contractType: ContractType.CDI,
      hireDate: new Date('2021-09-01'),
      baseSalary: 250000,
    },
    {
      staffNumber: 'STF003',
      firstName: 'Amadou',
      lastName: 'Diabaté',
      dateOfBirth: new Date('1988-11-10'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      phone: '+225 07 11 22 33 44',
      email: 'amadou.diabate@souverainlarabia.edu.ci',
      function: StaffFunction.ENSEIGNANT,
      specialization: 'Français',
      contractType: ContractType.CDI,
      hireDate: new Date('2021-09-01'),
      baseSalary: 250000,
    },
    {
      staffNumber: 'STF004',
      firstName: 'Fatou',
      lastName: 'Coulibaly',
      dateOfBirth: new Date('1992-05-18'),
      gender: 'FEMALE',
      nationality: 'Ivoirienne',
      phone: '+225 05 44 55 66 77',
      email: 'fatou.coulibaly@souverainlarabia.edu.ci',
      function: StaffFunction.COMPTABLE,
      contractType: ContractType.CDI,
      hireDate: new Date('2022-01-15'),
      baseSalary: 300000,
    },
    {
      staffNumber: 'STF005',
      firstName: 'Ibrahim',
      lastName: 'Koné',
      dateOfBirth: new Date('1995-09-25'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      phone: '+225 07 88 99 00 11',
      email: 'ibrahim.kone@souverainlarabia.edu.ci',
      function: StaffFunction.SURVEILLANT,
      contractType: ContractType.CDD,
      hireDate: new Date('2023-09-01'),
      endDate: new Date('2024-06-30'),
      baseSalary: 150000,
    },
  ];

  for (const staffData of staffMembers) {
    const staff = await prisma.staff.upsert({
      where: { staffNumber: staffData.staffNumber },
      update: {},
      create: staffData,
    });
    console.log('✅ Staff member created:', staff.firstName, staff.lastName);
  }
  */

  // Get all teachers for assigning to subjects (commented out - using teachers model instead)
  // const teachers = await prisma.staff.findMany({
  //   where: { function: StaffFunction.ENSEIGNANT }
  // });

  // Create subjects
  const subjectsData = [
    { name: 'Mathématiques', code: 'MATH', coefficient: 4, description: 'Mathématiques générales' },
    { name: 'Français', code: 'FR', coefficient: 3, description: 'Langue et littérature française' },
    { name: 'Anglais', code: 'EN', coefficient: 2, description: 'Langue anglaise' },
    { name: 'Histoire-Géographie', code: 'HG', coefficient: 2, description: 'Histoire et géographie' },
    { name: 'Sciences Physiques', code: 'SP', coefficient: 3, description: 'Physique et chimie' },
    { name: 'Sciences de la Vie et de la Terre', code: 'SVT', coefficient: 2, description: 'Biologie et géologie' },
    { name: 'Éducation Physique et Sportive', code: 'EPS', coefficient: 1, description: 'Sport et activités physiques' },
    { name: 'Informatique', code: 'INFO', coefficient: 1, description: 'Technologies de l\'information' },
    { name: 'Arts Plastiques', code: 'ART', coefficient: 1, description: 'Arts visuels et plastiques' },
  ];

  const subjects = [];
  for (const subjectData of subjectsData) {
    const subject = await prisma.subjects.upsert({
      where: { code: subjectData.code },
      update: {},
      create: {
        id: randomUUID(),
        ...subjectData,
      },
    });
    subjects.push(subject);
    console.log('✅ Subject created:', subject.name);
  }

  // Create classes
  const classesData = [
    { name: '6ème A' },
    { name: '6ème B' },
    { name: '5ème A' },
    { name: '5ème B' },
    { name: '4ème A' },
    { name: '4ème B' },
    { name: '3ème A' },
    { name: '3ème B' },
  ];

  const classes = [];
  for (const classData of classesData) {
    const schoolClass = await prisma.schoolClass.upsert({
      where: {
        name: classData.name
      },
      update: {},
      create: {
        id: randomUUID(),
        ...classData,
      },
    });
    classes.push(schoolClass);
    console.log('✅ Class created:', schoolClass.name);
  }

  // Assign subjects to classes (commented out temporarily to focus on teachers seeding)
  // Note: Teachers are seeded separately via seedTeachers()
  /*
  for (const schoolClass of classes) {
    for (const subject of subjects) {
      // Check if this class-subject combination already exists
      const existing = await prisma.class_subjects.findFirst({
        where: {
          class_id: schoolClass.id,
          subject_id: subject.id
        }
      });

      if (existing) {
        console.log(`⏭️  ${subject.name} already assigned to ${schoolClass.name}`);
        continue;
      }

      const classSubject = await prisma.class_subjects.create({
        data: {
          id: randomUUID(),
          class_id: schoolClass.id,
          subject_id: subject.id,
          teacher_id: null, // Will be assigned later
          hours_per_week: subject.coefficient >= 3 ? 4 : subject.coefficient >= 2 ? 3 : 2,
          coefficient: subject.coefficient,
        },
      });
      console.log(`✅ Assigned ${subject.name} to ${schoolClass.name}`);
    }
  }
  */

  // Create sample salaries for the current month (commented out - staff model may not exist)
  /*
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const allStaff = await prisma.staff.findMany({ where: { isActive: true } });

  for (const staff of allStaff) {
    const baseSalary = Number(staff.baseSalary);
    const cnpsEmployee = baseSalary * 0.036; // 3.6% CNPS employee contribution
    const cnpsEmployer = baseSalary * 0.167; // 16.7% CNPS employer contribution
    
    // Simple progressive tax calculation (approximate)
    let incomeTax = 0;
    if (baseSalary > 50000) {
      const taxableAmount = baseSalary - 50000;
      incomeTax = taxableAmount * 0.15; // 15% simplified tax rate
    }

    const grossSalary = baseSalary;
    const netSalary = grossSalary - cnpsEmployee - incomeTax;

    await prisma.staffSalary.upsert({
      where: {
        staffId_month_year: {
          staffId: staff.id,
          month: currentMonth,
          year: currentYear,
        },
      },
      update: {},
      create: {
        staffId: staff.id,
        month: currentMonth,
        year: currentYear,
        baseSalary,
        allowances: 0,
        overtimeHours: 0,
        overtimeRate: 0,
        bonuses: 0,
        deductions: 0,
        cnpsEmployee,
        cnpsEmployer,
        incomeTax,
        grossSalary,
        netSalary,
        status: 'DRAFT',
        createdBy: admin.id,
      },
    });
    console.log('✅ Salary created for:', staff.firstName, staff.lastName);
  }
  */

  // Create sample parents (commented out temporarily)
  /*
  const parentsData = [
    {
      firstName: 'Kofi',
      lastName: 'Yao',
      relation: ParentRelation.PERE,
      phone: '+225 07 10 20 30 40',
      email: 'kofi.yao@email.com',
      profession: 'Ingénieur',
      workplace: 'SODECI',
      isPrimaryContact: true,
      isFinancialResponsible: true
    },
    {
      firstName: 'Aya',
      lastName: 'Yao',
      relation: ParentRelation.MERE,
      phone: '+225 05 10 20 30 40',
      email: 'aya.yao@email.com',
      profession: 'Médecin',
      workplace: 'CHU de Cocody'
    },
    {
      firstName: 'Mamadou',
      lastName: 'Diallo',
      relation: ParentRelation.PERE,
      phone: '+225 07 11 22 33 44',
      email: 'mamadou.diallo@email.com',
      profession: 'Commerçant',
      isPrimaryContact: true,
      isFinancialResponsible: true
    },
    {
      firstName: 'Fatoumata',
      lastName: 'Diallo',
      relation: ParentRelation.MERE,
      phone: '+225 05 11 22 33 44',
      email: 'fatoumata.diallo@email.com',
      profession: 'Enseignante'
    },
    {
      firstName: 'Kwame',
      lastName: 'Asante',
      relation: ParentRelation.TUTEUR,
      phone: '+225 07 55 66 77 88',
      email: 'kwame.asante@email.com',
      profession: 'Avocat',
      isPrimaryContact: true,
      isFinancialResponsible: true
    }
  ];

  const parents = [];
  for (const parentData of parentsData) {
    const parent = await prisma.parent.create({
      data: parentData
    });
    parents.push(parent);
    console.log('✅ Parent created:', parent.firstName, parent.lastName);
  }

  // Create sample students
  const studentsData = [
    {
      studentNumber: 'STU0001',
      firstName: 'Adjoua',
      lastName: 'Yao',
      dateOfBirth: new Date('2012-03-15'),
      gender: 'FEMALE',
      nationality: 'Ivoirienne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[0].id, // 6ème A
      parentIds: [parents[0].id, parents[1].id] // Both Yao parents
    },
    {
      studentNumber: 'STU0002',
      firstName: 'Kouassi',
      lastName: 'Yao',
      dateOfBirth: new Date('2013-07-22'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[2].id, // 5ème A
      parentIds: [parents[0].id, parents[1].id] // Both Yao parents (sibling)
    },
    {
      studentNumber: 'STU0003',
      firstName: 'Aminata',
      lastName: 'Diallo',
      dateOfBirth: new Date('2011-11-10'),
      gender: 'FEMALE',
      nationality: 'Ivoirienne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[0].id, // 6ème A
      parentIds: [parents[2].id, parents[3].id] // Both Diallo parents
    },
    {
      studentNumber: 'STU0004',
      firstName: 'Ibrahim',
      lastName: 'Diallo',
      dateOfBirth: new Date('2012-05-18'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[1].id, // 6ème B
      parentIds: [parents[2].id, parents[3].id] // Both Diallo parents (sibling)
    },
    {
      studentNumber: 'STU0005',
      firstName: 'Nana',
      lastName: 'Asante',
      dateOfBirth: new Date('2010-09-25'),
      gender: 'FEMALE',
      nationality: 'Ghanéenne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[4].id, // 4ème A
      bloodType: 'O+',
      parentIds: [parents[4].id] // Guardian only
    },
    {
      studentNumber: 'STU0006',
      firstName: 'Koffi',
      lastName: 'N\'Guessan',
      dateOfBirth: new Date('2013-02-14'),
      gender: 'MALE',
      nationality: 'Ivoirienne',
      enrollmentDate: new Date('2024-09-01'),
      classId: classes[3].id, // 5ème B
      bloodType: 'A+',
      allergies: 'Arachides'
    }
  ];

  for (const studentData of studentsData) {
    const { parentIds, ...studentInfo } = studentData;
    
    const student = await prisma.student.upsert({
      where: { studentNumber: studentData.studentNumber },
      update: {},
      create: {
        ...studentInfo,
        studentParents: parentIds ? {
          create: parentIds.map(parentId => ({
            parent: { connect: { id: parentId } }
          }))
        } : undefined
      },
      include: {
        studentParents: {
          include: {
            parent: true
          }
        }
      }
    });
    console.log('✅ Student created:', student.firstName, student.lastName);
  }
  */

  // Create sample schedules for classes (commented out)
  const scheduleData = [
    // 6ème A - Monday
    { day: 1, start: '08:00', end: '09:00', subjectCode: 'MATH', room: 'Salle 101' },
    { day: 1, start: '09:00', end: '10:00', subjectCode: 'FR', room: 'Salle 101' },
    { day: 1, start: '10:15', end: '11:15', subjectCode: 'EN', room: 'Salle 101' },
    { day: 1, start: '11:15', end: '12:15', subjectCode: 'HG', room: 'Salle 101' },
    
    // 6ème A - Tuesday
    { day: 2, start: '08:00', end: '09:00', subjectCode: 'SP', room: 'Labo 1' },
    { day: 2, start: '09:00', end: '10:00', subjectCode: 'SVT', room: 'Labo 2' },
    { day: 2, start: '10:15', end: '11:15', subjectCode: 'MATH', room: 'Salle 101' },
    { day: 2, start: '11:15', end: '12:15', subjectCode: 'FR', room: 'Salle 101' },
    
    // 6ème A - Wednesday
    { day: 3, start: '08:00', end: '09:00', subjectCode: 'INFO', room: 'Salle Info' },
    { day: 3, start: '09:00', end: '10:00', subjectCode: 'ART', room: 'Salle Art' },
    { day: 3, start: '10:15', end: '11:15', subjectCode: 'EPS', room: 'Terrain' },
    
    // 6ème A - Thursday
    { day: 4, start: '08:00', end: '09:00', subjectCode: 'MATH', room: 'Salle 101' },
    { day: 4, start: '09:00', end: '10:00', subjectCode: 'EN', room: 'Salle 101' },
    { day: 4, start: '10:15', end: '11:15', subjectCode: 'SP', room: 'Labo 1' },
    { day: 4, start: '11:15', end: '12:15', subjectCode: 'HG', room: 'Salle 101' },
    
    // 6ème A - Friday
    { day: 5, start: '08:00', end: '09:00', subjectCode: 'FR', room: 'Salle 101' },
    { day: 5, start: '09:00', end: '10:00', subjectCode: 'MATH', room: 'Salle 101' },
    { day: 5, start: '10:15', end: '11:15', subjectCode: 'SVT', room: 'Labo 2' },
  ];

  // Schedule creation commented out temporarily
  /*
  const sixiemeA = classes.find(c => c.name === '6ème A');
  
  if (sixiemeA) {
    for (const schedule of scheduleData) {
      const subject = subjects.find(s => s.code === schedule.subjectCode);
      const classSubject = await prisma.class_subjects.findFirst({
        where: {
          class_id: sixiemeA.id,
          subject_id: subject?.id
        }
      });

      if (classSubject && subject) {
        await prisma.schedules.create({
          data: {
            class_id: sixiemeA.id,
            subject_id: subject.id,
            teacher_id: classSubject.teacher_id!,
            day_of_week: schedule.day,
            start_time: new Date(`1970-01-01T${schedule.start}:00Z`),
            end_time: new Date(`1970-01-01T${schedule.end}:00Z`),
            room: schedule.room,
            academic_year_id: academicYear.id,
          }
        });
        console.log(`✅ Schedule created: ${subject.name} - Day ${schedule.day} ${schedule.start}-${schedule.end}`);
      }
    }
  }
  */

  // Seed payment types
  // await seedPaymentTypes();

  // Seed students and parents with more data
  // await seedStudentsAndParents();
  
  // Seed staff
  // await seedStaff();
  
  // Seed finance (school fees and payment schedules)
  // await seedFinance();
  
  // Seed finance 2 (revenues, expenses, budgets)
  // await seedFinance2();

  // Seed teachers with their specializations
  await seedTeachers();

  // Seed inscriptions (10 students)
  await seedInscriptions();

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
