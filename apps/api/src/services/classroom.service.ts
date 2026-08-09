import { prisma } from '@school/database';
import { z } from 'zod';

// Validation schemas
export const createClassroomSchema = z.object({
  name: z.string().min(1, 'Le nom de la salle est requis').max(100, 'Le nom ne doit pas dépasser 100 caractères'),
});

export const updateClassroomSchema = z.object({
  name: z.string().min(1, 'Le nom de la salle est requis').max(100, 'Le nom ne doit pas dépasser 100 caractères').optional(),
});

export class ClassroomService {
  static async getAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.classrooms.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.classrooms.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getById(id: string) {
    const classroom = await prisma.classrooms.findUnique({
      where: { id },
    });

    if (!classroom) {
      throw new Error('Salle de classe non trouvée');
    }

    return classroom;
  }

  static async create(data: z.infer<typeof createClassroomSchema>) {
    // Vérifier si une salle avec le même nom existe déjà
    const existing = await prisma.classrooms.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new Error('Une salle avec ce nom existe déjà');
    }

    const classroom = await prisma.classrooms.create({
      data: {
        name: data.name.trim(),
      },
    });

    return classroom;
  }

  static async update(id: string, data: z.infer<typeof updateClassroomSchema>) {
    // Vérifier si la salle existe
    const existing = await prisma.classrooms.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Salle de classe non trouvée');
    }

    // Si le nom est modifié, vérifier qu'il n'existe pas déjà
    if (data.name && data.name.trim() !== existing.name) {
      const duplicate = await prisma.classrooms.findFirst({
        where: {
          name: {
            equals: data.name.trim(),
            mode: 'insensitive',
          },
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new Error('Une salle avec ce nom existe déjà');
      }
    }

    const classroom = await prisma.classrooms.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
      },
    });

    return classroom;
  }

  static async delete(id: string) {
    // Vérifier si la salle existe
    const existing = await prisma.classrooms.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Salle de classe non trouvée');
    }

    await prisma.classrooms.delete({
      where: { id },
    });

    return { message: 'Salle de classe supprimée avec succès' };
  }
}

