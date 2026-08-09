/**
 * Synchronise en masse tous les enseignants existants vers Odoo (Contacts).
 * Utile pour le backfill initial ; les créations/mises à jour ultérieures se
 * synchronisent automatiquement via TeacherService.syncToOdoo.
 *
 * Usage : pnpm --filter api sync:odoo-teachers
 */
import { prisma } from '@school/database';
import { TeacherService } from '../services/teacher.service';

async function main() {
  const teachers = await prisma.teachers.findMany({ select: { id: true, first_name: true, last_name: true } });
  console.log(`${teachers.length} enseignant(s) à synchroniser vers Odoo...`);

  let ok = 0;
  let ko = 0;
  for (const teacher of teachers) {
    const before = await prisma.teachers.findUnique({ where: { id: teacher.id }, select: { odoo_partner_id: true } });
    await TeacherService.syncToOdoo(teacher.id);
    const after = await prisma.teachers.findUnique({ where: { id: teacher.id }, select: { odoo_partner_id: true } });
    if (after?.odoo_partner_id) {
      ok++;
      console.log(`✅ ${teacher.first_name} ${teacher.last_name} → res.partner #${after.odoo_partner_id}${before?.odoo_partner_id ? ' (déjà lié)' : ''}`);
    } else {
      ko++;
      console.log(`❌ ${teacher.first_name} ${teacher.last_name} → échec (voir avertissement ci-dessus)`);
    }
  }

  console.log(`\nTerminé : ${ok} synchronisé(s), ${ko} échec(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
