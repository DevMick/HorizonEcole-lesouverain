/**
 * Backfill : crée un compte utilisateur (login = email, mot de passe généré)
 * pour chaque enseignant qui n'en possède pas encore (user_id NULL).
 * Idempotent : les enseignants ayant déjà un compte sont ignorés.
 *
 * Usage : DATABASE_URL=... tsx src/scripts/backfill-teacher-accounts.ts
 */
import { prisma } from '@school/database';
import { TeacherService } from '../services/teacher.service';

async function main() {
  const teachers = await prisma.teachers.findMany({
    where: { user_id: null },
    select: { id: true, first_name: true, last_name: true, email: true },
    orderBy: { created_at: 'asc' },
  });

  console.log(`Enseignants sans compte : ${teachers.length}`);

  let created = 0;
  for (const t of teachers) {
    try {
      const result = await TeacherService.createUserAccount(t.id);
      created++;
      console.log(
        `✅ ${t.last_name} ${t.first_name} | login=${result.login} | mot de passe=${result.password}`
      );
    } catch (err) {
      console.warn(`⚠️  ${t.last_name} ${t.first_name} (${t.email}) : ${(err as Error).message}`);
    }
  }

  console.log(`\nComptes créés : ${created}/${teachers.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
