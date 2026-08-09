import '../load-env';
import { prisma } from '@school/database';

async function main() {
  const rows = await prisma.schoolClass.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  console.log(JSON.stringify(rows, null, 2));
}
main().catch((e) => console.error('ERR', e)).finally(() => prisma.$disconnect());
