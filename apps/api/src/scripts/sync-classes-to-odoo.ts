/**
 * Synchronise en masse toutes les classes existantes vers Odoo (Facturation >
 * Classes & Produits). Utile pour le backfill initial ; les créations/mises à
 * jour ultérieures se synchronisent automatiquement (voir schoolClasses.ts).
 *
 * Usage : pnpm --filter api sync:odoo-classes
 */
import { prisma } from '@school/database';
import { syncClassToOdoo } from '../services/odoo.service';

async function main() {
  const classes = await prisma.schoolClass.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  console.log(`${classes.length} classe(s) à synchroniser vers Odoo...`);

  let ok = 0;
  let ko = 0;
  for (const schoolClass of classes) {
    try {
      const odooId = await syncClassToOdoo({ id: schoolClass.id, name: schoolClass.name });
      if (odooId) {
        ok++;
        console.log(`✅ ${schoolClass.name} → csl.school.class #${odooId}`);
      } else {
        ko++;
        console.log(`❌ ${schoolClass.name} → Odoo non configuré ou injoignable`);
      }
    } catch (err) {
      ko++;
      console.log(`❌ ${schoolClass.name} → échec :`, (err as Error).message);
    }
  }

  console.log(`\nTerminé : ${ok} synchronisée(s), ${ko} échec(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
