import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedFinance() {
  console.log('🌱 Seeding finance data (school fees and payment schedules)...');

  // Get current academic year
  const currentAcademicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true }
  });

  if (!currentAcademicYear) {
    console.log('⚠️  No current academic year found. Skipping finance seeding.');
    return;
  }

  console.log(`📅 Using academic year: ${currentAcademicYear.name}`);

  // Define school fees for each level
  const feeStructure = [
    // SIXIEME
    {
      level: 'SIXIEME' as const,
      fees: [
        { feeType: 'INSCRIPTION' as const, amount: 50000, description: 'Frais d\'inscription annuels' },
        { feeType: 'SCOLARITE_MENSUELLE' as const, amount: 45000, description: 'Frais de scolarité mensuels' },
        { feeType: 'CANTINE' as const, amount: 25000, description: 'Frais de cantine mensuels' },
        { feeType: 'TRANSPORT' as const, amount: 20000, description: 'Frais de transport mensuels' },
        { feeType: 'UNIFORME' as const, amount: 35000, description: 'Uniforme scolaire' },
        { feeType: 'ACTIVITE' as const, amount: 15000, description: 'Activités extra-scolaires' },
      ]
    },
    // CINQUIEME
    {
      level: 'CINQUIEME' as const,
      fees: [
        { feeType: 'INSCRIPTION' as const, amount: 50000, description: 'Frais d\'inscription annuels' },
        { feeType: 'SCOLARITE_MENSUELLE' as const, amount: 47000, description: 'Frais de scolarité mensuels' },
        { feeType: 'CANTINE' as const, amount: 25000, description: 'Frais de cantine mensuels' },
        { feeType: 'TRANSPORT' as const, amount: 20000, description: 'Frais de transport mensuels' },
        { feeType: 'UNIFORME' as const, amount: 35000, description: 'Uniforme scolaire' },
        { feeType: 'ACTIVITE' as const, amount: 15000, description: 'Activités extra-scolaires' },
      ]
    },
    // QUATRIEME
    {
      level: 'QUATRIEME' as const,
      fees: [
        { feeType: 'INSCRIPTION' as const, amount: 55000, description: 'Frais d\'inscription annuels' },
        { feeType: 'SCOLARITE_MENSUELLE' as const, amount: 50000, description: 'Frais de scolarité mensuels' },
        { feeType: 'CANTINE' as const, amount: 25000, description: 'Frais de cantine mensuels' },
        { feeType: 'TRANSPORT' as const, amount: 20000, description: 'Frais de transport mensuels' },
        { feeType: 'UNIFORME' as const, amount: 35000, description: 'Uniforme scolaire' },
        { feeType: 'ACTIVITE' as const, amount: 15000, description: 'Activités extra-scolaires' },
      ]
    },
    // TROISIEME
    {
      level: 'TROISIEME' as const,
      fees: [
        { feeType: 'INSCRIPTION' as const, amount: 55000, description: 'Frais d\'inscription annuels' },
        { feeType: 'SCOLARITE_MENSUELLE' as const, amount: 52000, description: 'Frais de scolarité mensuels' },
        { feeType: 'CANTINE' as const, amount: 25000, description: 'Frais de cantine mensuels' },
        { feeType: 'TRANSPORT' as const, amount: 20000, description: 'Frais de transport mensuels' },
        { feeType: 'UNIFORME' as const, amount: 35000, description: 'Uniforme scolaire' },
        { feeType: 'ACTIVITE' as const, amount: 20000, description: 'Activités extra-scolaires + préparation BEPC' },
      ]
    },
  ];

  // Create school fees
  const createdFees = [];
  for (const levelFees of feeStructure) {
    for (const fee of levelFees.fees) {
      try {
        // Check if fee already exists
        const existingFee = await prisma.schoolFee.findFirst({
          where: {
            academicYearId: currentAcademicYear.id,
            level: levelFees.level,
            feeType: fee.feeType,
          }
        });

        if (!existingFee) {
          const createdFee = await prisma.schoolFee.create({
            data: {
              academicYearId: currentAcademicYear.id,
              level: levelFees.level,
              feeType: fee.feeType,
              amount: fee.amount,
              description: fee.description,
            }
          });
          createdFees.push(createdFee);
          console.log(`✅ Created fee: ${levelFees.level} - ${fee.feeType} - ${fee.amount} XAF`);
        } else {
          console.log(`⏭️  Fee already exists: ${levelFees.level} - ${fee.feeType}`);
        }
      } catch (error) {
        console.log(`⚠️  Error creating fee for ${levelFees.level} - ${fee.feeType}:`, error);
      }
    }
  }

  console.log(`✅ Created ${createdFees.length} school fees`);

  // Generate payment schedules for students
  const students = await prisma.student.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      schoolClass: {
        select: {
          level: true,
          academicYearId: true,
        }
      }
    },
    take: 20, // Generate for first 20 students as example
  });

  console.log(`📝 Generating payment schedules for ${students.length} students...`);

  let schedulesCreated = 0;

  for (const student of students) {
    if (!student.schoolClass) {
      continue;
    }

    // Check if schedules already exist
    const existingSchedules = await prisma.paymentSchedule.count({
      where: {
        studentId: student.id,
        academicYearId: currentAcademicYear.id,
      }
    });

    if (existingSchedules > 0) {
      console.log(`⏭️  Schedules already exist for student: ${student.firstName} ${student.lastName}`);
      continue;
    }

    // Get fees for this student's level
    const studentFees = await prisma.schoolFee.findMany({
      where: {
        academicYearId: currentAcademicYear.id,
        level: student.schoolClass.level,
      }
    });

    if (studentFees.length === 0) {
      console.log(`⚠️  No fees found for level: ${student.schoolClass.level}`);
      continue;
    }

    // Generate schedules
    const startDate = new Date(currentAcademicYear.startDate);
    const monthlyInterval = 30; // days

    for (const fee of studentFees) {
      try {
        // For monthly tuition, create 10 monthly installments
        if (fee.feeType === 'SCOLARITE_MENSUELLE') {
          const monthlyAmount = Number(fee.amount);
          
          for (let month = 0; month < 10; month++) {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + (month * monthlyInterval));
            dueDate.setDate(5); // Due on 5th of each month

            await prisma.paymentSchedule.create({
              data: {
                studentId: student.id,
                academicYearId: currentAcademicYear.id,
                feeType: fee.feeType,
                totalAmount: monthlyAmount,
                paidAmount: 0,
                remainingAmount: monthlyAmount,
                dueDate,
                status: 'PENDING',
                discountPercentage: 0,
              }
            });
            schedulesCreated++;
          }
        }
        // For other fees, create single schedule
        else {
          const dueDate = new Date(startDate);
          
          // Set specific due dates based on fee type
          if (fee.feeType === 'INSCRIPTION') {
            dueDate.setDate(1); // Due at start of year
          } else if (fee.feeType === 'UNIFORME') {
            dueDate.setDate(15);
          } else {
            dueDate.setDate(5);
          }

          await prisma.paymentSchedule.create({
            data: {
              studentId: student.id,
              academicYearId: currentAcademicYear.id,
              feeType: fee.feeType,
              totalAmount: fee.amount,
              paidAmount: 0,
              remainingAmount: fee.amount,
              dueDate,
              status: 'PENDING',
              discountPercentage: 0,
            }
          });
          schedulesCreated++;
        }
      } catch (error) {
        console.log(`⚠️  Error creating schedule for ${student.firstName} ${student.lastName} - ${fee.feeType}:`, error);
      }
    }

    console.log(`✅ Created schedules for: ${student.firstName} ${student.lastName}`);
  }

  console.log(`✅ Created ${schedulesCreated} payment schedules`);

  // Create some sample payments for testing
  console.log('💰 Creating sample payments...');

  const schedules = await prisma.paymentSchedule.findMany({
    where: {
      academicYearId: currentAcademicYear.id,
      status: 'PENDING',
    },
    take: 10, // Pay first 10 schedules
  });

  let paymentsCreated = 0;

  for (const schedule of schedules) {
    try {
      // Generate receipt number
      const receiptNumber = `REC-${new Date().getFullYear()}-${String(paymentsCreated + 1).padStart(6, '0')}`;

      // Create payment (full or partial)
      const isFullPayment = Math.random() > 0.3; // 70% full payments
      const paymentAmount = isFullPayment 
        ? Number(schedule.totalAmount) 
        : Number(schedule.totalAmount) / 2;

      const payment = await prisma.payment.create({
        data: {
          paymentScheduleId: schedule.id,
          studentId: schedule.studentId,
          receiptNumber,
          amount: paymentAmount,
          paymentMethod: ['CASH', 'MOBILE_MONEY', 'VIREMENT'][Math.floor(Math.random() * 3)] as any,
          paymentDate: new Date(),
          notes: 'Paiement test - seed data',
        }
      });

      // Update schedule
      const newPaidAmount = Number(schedule.paidAmount) + paymentAmount;
      const newRemainingAmount = Number(schedule.totalAmount) - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL';

      await prisma.paymentSchedule.update({
        where: { id: schedule.id },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        }
      });

      paymentsCreated++;
      console.log(`✅ Created payment: ${receiptNumber} - ${paymentAmount} XAF`);
    } catch (error) {
      console.log(`⚠️  Error creating payment:`, error);
    }
  }

  console.log(`✅ Created ${paymentsCreated} sample payments`);

  console.log('✅ Finance seeding completed!');
}

