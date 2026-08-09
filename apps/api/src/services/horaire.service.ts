import { prisma } from '@school/database';
import { z } from 'zod';

export const HORAIRE_TYPES = ['COURS', 'RECREATION', 'PAUSE'] as const;

export const createHoraireSchema = z.object({
  startTime: z.string().min(1, "L'heure de début est requise").max(10),
  endTime: z.string().min(1, "L'heure de fin est requise").max(10),
  type: z.enum(HORAIRE_TYPES).optional().default('COURS'),
});

export class HoraireService {
  static async getAll() {
    return prisma.horaires.findMany({ orderBy: { start_time: 'asc' } });
  }

  static async create(data: z.infer<typeof createHoraireSchema>) {
    if (data.endTime <= data.startTime) {
      throw new Error("L'heure de fin doit être après l'heure de début");
    }
    const type = data.type ?? 'COURS';

    // RÉCRÉATION et PAUSE sont des bandes uniques (une seule par école) : on
    // met à jour la ligne existante de ce type plutôt que d'en insérer une
    // nouvelle, sinon changer l'horaire fait apparaître une deuxième bande.
    if (type === 'RECREATION' || type === 'PAUSE') {
      const existing = await prisma.horaires.findFirst({ where: { type } });
      if (existing) {
        return prisma.horaires.update({
          where: { id: existing.id },
          data: { start_time: data.startTime, end_time: data.endTime },
        });
      }
    }

    return prisma.horaires.upsert({
      where: { start_time_end_time: { start_time: data.startTime, end_time: data.endTime } },
      update: { type },
      create: { start_time: data.startTime, end_time: data.endTime, type },
    });
  }

  static async delete(id: string) {
    const existing = await prisma.horaires.findUnique({ where: { id } });
    if (!existing) throw new Error('Créneau horaire non trouvé');
    return prisma.horaires.delete({ where: { id } });
  }
}
