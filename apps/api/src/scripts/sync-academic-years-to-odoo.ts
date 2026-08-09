/**
 * Synchronise en masse toutes les années scolaires existantes vers Odoo
 * (Facturation > Années scolaires). Utile pour le backfill initial ; les
 * inscriptions ultérieures synchronisent l'année en cours automatiquement
 * (voir `createInscriptionInvoice` dans odoo.service.ts).
 *
 * Usage : pnpm --filter api sync:odoo-academic-years
 */
import { prisma } from '@school/database';
import { syncAcademicYearToOdoo } from '../services/odoo.service';

async function main() {
  const years = await prisma.academicYear.findMany({
    select: { id: true, name: true, startYear: true, endYear: true, isCurrent: true },
    orderBy: { startYear: 'asc' },
  });
  console.log(`${years.length} année(s) scolaire(s) à synchroniser vers Odoo...`);

  let ok = 0;
  let ko = 0;
  for (const year of years) {
    try {
      const odooId = await syncAcademicYearToOdoo(year);
      if (odooId) {
        ok++;
        console.log(`✅ ${year.name}${year.isCurrent ? ' (en cours)' : ''} → csl.school.year #${odooId}`);
      } else {
        ko++;
        console.log(`❌ ${year.name} → Odoo non configuré ou injoignable`);
      }
    } catch (err) {
      ko++;
      console.log(`❌ ${year.name} → échec :`, (err as Error).message);
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
