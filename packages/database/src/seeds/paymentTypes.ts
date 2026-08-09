import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedPaymentTypes() {
  console.log('🌱 Seeding payment types...');

  const paymentTypes = [
    { name: '1er Versement à l\'Inscription' },
    { name: '2ème Versement Octobre' },
    { name: '3ème Versement Novembre' },
    { name: '4ème Versement Décembre' },
    { name: '5ème Versement Janvier' },
  ];

  for (const type of paymentTypes) {
    await prisma.payment_types.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
  }

  console.log('✅ Payment types seeded successfully');
}

