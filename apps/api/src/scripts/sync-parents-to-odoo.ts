/**
 * Synchronise en masse tous les parents existants vers Odoo (Contacts/CRM).
 * Utile pour le backfill initial ; les créations/mises à jour ultérieures se
 * synchronisent automatiquement via ParentService.syncToOdoo.
 *
 * Usage : pnpm --filter api sync:odoo-parents
 */
import { prisma } from '@school/database';
import { ParentService } from '../services/parent.service';

async function main() {
  const parents = await prisma.parents.findMany({ select: { id: true, first_name: true, last_name: true } });
  console.log(`${parents.length} parent(s) à synchroniser vers Odoo...`);

  let ok = 0;
  let ko = 0;
  for (const parent of parents) {
    const before = await prisma.parents.findUnique({ where: { id: parent.id }, select: { odoo_partner_id: true } });
    await ParentService.syncToOdoo(parent.id);
    const after = await prisma.parents.findUnique({ where: { id: parent.id }, select: { odoo_partner_id: true } });
    if (after?.odoo_partner_id) {
      ok++;
      console.log(`✅ ${parent.first_name} ${parent.last_name} → res.partner #${after.odoo_partner_id}${before?.odoo_partner_id ? ' (déjà lié)' : ''}`);
    } else {
      ko++;
      console.log(`❌ ${parent.first_name} ${parent.last_name} → échec (voir avertissement ci-dessus)`);
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
