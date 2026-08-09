import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedStaff() {
  console.log('🌱 Seeding staff data...');

  // Create staff members
  const staffMembers = [
    {
      firstName: 'Jean',
      lastName: 'Mballa',
      phone: '+237 6 12 34 56 78',
      email: 'jean.mballa@ecolesouverain.cm',
      address: 'Quartier Essos, Yaoundé',
      function: 'DIRECTEUR' as const,
      specialization: 'Administration Scolaire',
      contractType: 'CDI' as const,
      hireDate: new Date('2020-09-01'),
      baseSalary: 350000,
      cvUrl: '/uploads/staff/jean-mballa-cv.pdf',
      diplomaUrl: '/uploads/staff/jean-mballa-diploma.pdf',
      contractUrl: '/uploads/staff/jean-mballa-contract.pdf',
      idCardUrl: '/uploads/staff/jean-mballa-id.pdf',
    },
    {
      firstName: 'Marie',
      lastName: 'Nguema',
      phone: '+237 6 23 45 67 89',
      email: 'marie.nguema@ecolesouverain.cm',
      address: 'Quartier Mfoundi, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Mathématiques',
      contractType: 'CDI' as const,
      hireDate: new Date('2021-09-01'),
      baseSalary: 280000,
      cvUrl: '/uploads/staff/marie-nguema-cv.pdf',
      diplomaUrl: '/uploads/staff/marie-nguema-diploma.pdf',
    },
    {
      firstName: 'Paul',
      lastName: 'Essomba',
      phone: '+237 6 34 56 78 90',
      email: 'paul.essomba@ecolesouverain.cm',
      address: 'Quartier Bastos, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Physique-Chimie',
      contractType: 'CDI' as const,
      hireDate: new Date('2021-09-01'),
      baseSalary: 280000,
      cvUrl: '/uploads/staff/paul-essomba-cv.pdf',
      diplomaUrl: '/uploads/staff/paul-essomba-diploma.pdf',
    },
    {
      firstName: 'Claire',
      lastName: 'Tchoumi',
      phone: '+237 6 45 67 89 01',
      email: 'claire.tchoumi@ecolesouverain.cm',
      address: 'Quartier Emana, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Français',
      contractType: 'CDI' as const,
      hireDate: new Date('2022-09-01'),
      baseSalary: 260000,
      cvUrl: '/uploads/staff/claire-tchoumi-cv.pdf',
      diplomaUrl: '/uploads/staff/claire-tchoumi-diploma.pdf',
    },
    {
      firstName: 'Pierre',
      lastName: 'Mfoumou',
      phone: '+237 6 56 78 90 12',
      email: 'pierre.mfoumou@ecolesouverain.cm',
      address: 'Quartier Odza, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Histoire-Géographie',
      contractType: 'CDI' as const,
      hireDate: new Date('2022-09-01'),
      baseSalary: 260000,
    },
    {
      firstName: 'Grace',
      lastName: 'Fouda',
      phone: '+237 6 67 89 01 23',
      email: 'grace.fouda@ecolesouverain.cm',
      address: 'Quartier Nsam, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Anglais',
      contractType: 'CDI' as const,
      hireDate: new Date('2022-09-01'),
      baseSalary: 260000,
      cvUrl: '/uploads/staff/grace-fouda-cv.pdf',
    },
    {
      firstName: 'Alain',
      lastName: 'Nkoulou',
      phone: '+237 6 78 90 12 34',
      email: 'alain.nkoulou@ecolesouverain.cm',
      address: 'Quartier Mendong, Yaoundé',
      function: 'SURVEILLANT' as const,
      contractType: 'CDI' as const,
      hireDate: new Date('2021-09-01'),
      baseSalary: 180000,
    },
    {
      firstName: 'Béatrice',
      lastName: 'Mvondo',
      phone: '+237 6 89 01 23 45',
      email: 'beatrice.mvondo@ecolesouverain.cm',
      address: 'Quartier Nlongkak, Yaoundé',
      function: 'SECRETAIRE' as const,
      contractType: 'CDI' as const,
      hireDate: new Date('2020-09-01'),
      baseSalary: 220000,
      cvUrl: '/uploads/staff/beatrice-mvondo-cv.pdf',
      diplomaUrl: '/uploads/staff/beatrice-mvondo-diploma.pdf',
    },
    {
      firstName: 'François',
      lastName: 'Ngono',
      phone: '+237 6 90 12 34 56',
      email: 'francois.ngono@ecolesouverain.cm',
      address: 'Quartier Mvog-Ada, Yaoundé',
      function: 'COMPTABLE' as const,
      contractType: 'CDI' as const,
      hireDate: new Date('2020-09-01'),
      baseSalary: 300000,
      cvUrl: '/uploads/staff/francois-ngono-cv.pdf',
      diplomaUrl: '/uploads/staff/francois-ngono-diploma.pdf',
    },
    {
      firstName: 'Joseph',
      lastName: 'Mballa',
      phone: '+237 6 01 23 45 67',
      email: 'joseph.mballa@ecolesouverain.cm',
      address: 'Quartier Cité Verte, Yaoundé',
      function: 'MAINTENANCE' as const,
      contractType: 'CDI' as const,
      hireDate: new Date('2021-09-01'),
      baseSalary: 160000,
    },
    {
      firstName: 'Sylvie',
      lastName: 'Ngo',
      phone: '+237 6 12 34 56 78',
      email: 'sylvie.ngo@ecolesouverain.cm',
      address: 'Quartier Ekounou, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'SVT',
      contractType: 'CDD' as const,
      hireDate: new Date('2023-09-01'),
      endDate: new Date('2024-08-31'),
      baseSalary: 240000,
    },
    {
      firstName: 'Marc',
      lastName: 'Tchoumi',
      phone: '+237 6 23 45 67 89',
      email: 'marc.tchoumi@ecolesouverain.cm',
      address: 'Quartier Mbankomo, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Éducation Physique',
      contractType: 'VACATAIRE' as const,
      hireDate: new Date('2023-09-01'),
      baseSalary: 200000,
    },
    {
      firstName: 'Caroline',
      lastName: 'Essomba',
      phone: '+237 6 34 56 78 90',
      email: 'caroline.essomba@ecolesouverain.cm',
      address: 'Quartier Nkomkana, Yaoundé',
      function: 'ENSEIGNANT' as const,
      specialization: 'Arts Plastiques',
      contractType: 'VACATAIRE' as const,
      hireDate: new Date('2023-09-01'),
      baseSalary: 200000,
    },
    {
      firstName: 'Roger',
      lastName: 'Mfoumou',
      phone: '+237 6 45 67 89 01',
      email: 'roger.mfoumou@ecolesouverain.cm',
      address: 'Quartier Essomba, Yaoundé',
      function: 'SURVEILLANT' as const,
      contractType: 'CDD' as const,
      hireDate: new Date('2023-09-01'),
      endDate: new Date('2024-08-31'),
      baseSalary: 170000,
    },
    {
      firstName: 'Patience',
      lastName: 'Fouda',
      phone: '+237 6 56 78 90 12',
      email: 'patience.fouda@ecolesouverain.cm',
      address: 'Quartier Obobogo, Yaoundé',
      function: 'SECRETAIRE' as const,
      contractType: 'CDD' as const,
      hireDate: new Date('2023-09-01'),
      endDate: new Date('2024-08-31'),
      baseSalary: 200000,
    },
  ];

  const createdStaff = [];
  for (const staffData of staffMembers) {
    try {
      const staff = await prisma.staff.create({
        data: staffData,
      });
      createdStaff.push(staff);
      console.log(`✅ Created staff: ${staff.firstName} ${staff.lastName}`);
    } catch (error) {
      console.log(`⚠️  Staff already exists or error: ${staffData.firstName} ${staffData.lastName}`);
    }
  }

  console.log(`✅ Created ${createdStaff.length} staff members`);

  // Generate sample salaries for current year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (const staff of createdStaff) {
    // Generate salaries for the last 3 months
    for (let month = Math.max(1, currentMonth - 2); month <= currentMonth; month++) {
      try {
        // Check if salary already exists
        const existingSalary = await prisma.staffSalary.findUnique({
          where: {
            staffId_month_year: {
              staffId: staff.id,
              month: month,
              year: currentYear,
            }
          }
        });

        if (!existingSalary) {
          // Calculate salary components
          const baseSalary = staff.baseSalary;
          const allowances = 15000 + 25000; // Transport + Housing
          const overtimeHours = Math.floor(Math.random() * 10); // 0-10 hours
          const overtimeRate = 2000; // 2000 XAF per hour
          const bonuses = month === 12 ? 50000 : 0; // End of year bonus
          
          const grossSalary = baseSalary + allowances + (overtimeHours * overtimeRate) + bonuses;
          
          // Calculate deductions
          const cnpsEmployee = grossSalary * 0.08; // 8% CNPS
          const incomeTax = Math.max(0, (grossSalary - 50000) * 0.15); // 15% income tax above 50,000 XAF
          const otherDeductions = 5000; // Other deductions
          
          const totalDeductions = cnpsEmployee + incomeTax + otherDeductions;
          const netSalary = grossSalary - totalDeductions;

          await prisma.staffSalary.create({
            data: {
              staffId: staff.id,
              month: month,
              year: currentYear,
              baseSalary,
              allowances,
              overtimeHours,
              overtimeRate,
              bonuses,
              deductions: otherDeductions,
              cnpsEmployee,
              incomeTax,
              grossSalary,
              netSalary,
              status: 'APPROVED',
              notes: `Salaire ${month}/${currentYear}`,
            }
          });

          console.log(`✅ Generated salary for ${staff.firstName} ${staff.lastName} - ${month}/${currentYear}`);
        }
      } catch (error) {
        console.log(`⚠️  Salary generation error for ${staff.firstName} ${staff.lastName} - ${month}/${currentYear}:`, error);
      }
    }
  }

  console.log('✅ Staff seeding completed!');
  return createdStaff;
}
