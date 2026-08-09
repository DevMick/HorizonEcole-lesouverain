import { prisma } from '@school/database';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'crypto';
import { UserRole } from '@school/types';
import { syncTeacherToOdoo } from './odoo.service';
import { sendAccountCredentialsEmail } from './mail.service';

/**
 * Génère un mot de passe aléatoire lisible (sans caractères ambigus 0/O, 1/l/I).
 * Garantit au moins une majuscule, une minuscule, un chiffre et un symbole.
 */
function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%&*';
  const all = upper + lower + digits + special;
  const bytes = randomBytes(Math.max(length, 4));
  const chars: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    special[bytes[3] % special.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  // Mélange (Fisher–Yates) pour ne pas figer l'ordre des classes de caractères.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Validation schemas
const createTeacherSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(1).max(20),
  contractType: z.enum(['CDI', 'CDD', 'VACATAIRE']),
  hireDate: z.string().transform(str => new Date(str)).optional(),
  specialties: z.string().optional(),
  qualifications: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  subjectIds: z.array(z.string()).optional(),
});

const updateTeacherSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
  contractType: z.enum(['CDI', 'CDD', 'VACATAIRE']).optional(),
  hireDate: z.string().transform(str => new Date(str)).optional(),
  specialties: z.string().optional(),
  qualifications: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  subjectIds: z.array(z.string()).optional(),
});

/** Aplati la relation teacher_subjects (join table) en un simple tableau `subjects`. */
function flattenTeacherSubjects<T extends { subjects?: { subject: any }[] }>(teacher: T) {
  const { subjects, ...rest } = teacher;
  return { ...rest, subjects: (subjects || []).map((s) => s.subject) };
}

/** Remplace l'ensemble des matières habilitées d'un enseignant par `subjectIds`. */
async function setTeacherSubjects(teacherId: string, subjectIds: string[]) {
  await prisma.teacher_subjects.deleteMany({ where: { teacher_id: teacherId } });
  if (subjectIds.length > 0) {
    await prisma.teacher_subjects.createMany({
      data: subjectIds.map((subjectId) => ({ teacher_id: teacherId, subject_id: subjectId })),
      skipDuplicates: true,
    });
  }
}

export class TeacherService {
  /**
   * Synchronise (best-effort) un enseignant vers Odoo (Contacts), et enregistre
   * l'id du partner Odoo obtenu pour les prochaines synchronisations. N'importe
   * quelle erreur (Odoo éteint, non configuré...) est avalée : ça ne doit jamais
   * faire échouer la création/mise à jour de l'enseignant.
   */
  static async syncToOdoo(teacherId: string): Promise<void> {
    try {
      const teacher = await prisma.teachers.findUnique({ where: { id: teacherId } });
      if (!teacher) return;

      const odooPartnerId = await syncTeacherToOdoo({
        id: teacher.id,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        phone: teacher.phone,
        email: teacher.email,
        contractType: teacher.contract_type,
        hireDate: teacher.hire_date,
        specialties: teacher.specialties,
        qualifications: teacher.qualifications,
        odooPartnerId: teacher.odoo_partner_id,
      });

      if (odooPartnerId && odooPartnerId !== teacher.odoo_partner_id) {
        await prisma.teachers.update({
          where: { id: teacherId },
          data: { odoo_partner_id: odooPartnerId },
        });
      }
    } catch (err) {
      console.warn(`Synchronisation Odoo de l'enseignant ${teacherId} échouée :`, (err as Error).message);
    }
  }

  /**
   * Get all teachers with filters
   */
  static async getAll(filters: {
    contractType?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const {
      contractType,
      page = 1,
      limit = 50,
      search,
    } = filters;

    const where: any = {};

    if (contractType) {
      where.contract_type = contractType;
    }

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teachers, total] = await Promise.all([
      prisma.teachers.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          contract_type: true,
          hire_date: true,
          specialties: true,
          qualifications: true,
          attachments: true,
          user_id: true,
          created_at: true,
          updated_at: true,
          subjects: { select: { subject: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.teachers.count({ where }),
    ]);

    return {
      teachers: teachers.map(flattenTeacherSubjects),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get teacher by ID
   */
  static async getById(id: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id },
      include: { subjects: { select: { subject: { select: { id: true, name: true, code: true } } } } },
    });
    return teacher ? flattenTeacherSubjects(teacher) : null;
  }

  /**
   * Create a new teacher
   */
  static async create(data: z.infer<typeof createTeacherSchema>) {
    // Check if email already exists
    const existingTeacher = await prisma.teachers.findUnique({
      where: { email: data.email },
    });

    if (existingTeacher) {
      throw new Error('Un enseignant avec cet email existe déjà');
    }

    const teacher = await prisma.teachers.create({
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        contract_type: data.contractType,
        hire_date: data.hireDate || new Date(),
        specialties: data.specialties || '',
        qualifications: data.qualifications || '',
        attachments: data.attachments || [],
      },
    });

    if (data.subjectIds && data.subjectIds.length > 0) {
      await setTeacherSubjects(teacher.id, data.subjectIds);
    }

    // Création automatique du compte utilisateur de l'enseignant (best-effort :
    // un email déjà utilisé par un autre compte ne doit pas bloquer la création
    // de la fiche enseignant).
    try {
      await TeacherService.createUserAccount(teacher.id);
    } catch (err) {
      console.warn(
        `Auto-création du compte pour l'enseignant ${teacher.id} échouée :`,
        (err as Error).message
      );
    }

    void TeacherService.syncToOdoo(teacher.id);

    // On relit la fiche pour renvoyer user_id / generated_password et matières à jour.
    return TeacherService.getById(teacher.id);
  }

  /**
   * Update a teacher
   */
  static async update(
    id: string,
    data: Partial<z.infer<typeof updateTeacherSchema>>
  ) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    // If email is being updated, check if it's already taken
    if (data.email && data.email !== teacher.email) {
      const existingTeacher = await prisma.teachers.findUnique({
        where: { email: data.email },
      });

      if (existingTeacher) {
        throw new Error('Un enseignant avec cet email existe déjà');
      }
    }

    const updateData: any = {};

    if (data.firstName !== undefined) updateData.first_name = data.firstName;
    if (data.lastName !== undefined) updateData.last_name = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.contractType !== undefined) updateData.contract_type = data.contractType;
    if (data.hireDate !== undefined) updateData.hire_date = data.hireDate;
    if (data.specialties !== undefined) updateData.specialties = data.specialties;
    if (data.qualifications !== undefined) updateData.qualifications = data.qualifications;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;

    if (Object.keys(updateData).length > 0) {
      await prisma.teachers.update({
        where: { id },
        data: updateData,
      });
    }

    if (data.subjectIds !== undefined) {
      await setTeacherSubjects(id, data.subjectIds);
    }

    void TeacherService.syncToOdoo(id);

    return TeacherService.getById(id);
  }

  /**
   * Delete a teacher
   */
  static async delete(id: string) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    return prisma.teachers.delete({
      where: { id },
    });
  }

  /**
   * Create a user account for a teacher.
   * Le login est l'email de l'enseignant. Si aucun mot de passe n'est fourni, un
   * mot de passe est généré automatiquement. Le mot de passe en clair est stocké
   * dans teachers.generated_password afin d'être affiché dans l'onglet « Compte ».
   * @param teacherId - The ID of the teacher
   * @param password - Optional password; generated automatically if omitted
   * @returns The created user, teacher, and the plaintext login/password
   */
  static async createUserAccount(teacherId: string, password?: string) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: { user: true },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    // Check if teacher already has a user account
    if (teacher.user_id) {
      throw new Error('Cet enseignant a déjà un compte utilisateur');
    }

    // Check if email is already used by another user
    const existingUser = await prisma.user.findUnique({
      where: { email: teacher.email },
    });

    if (existingUser) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    const plainPassword = password && password.length > 0 ? password : generatePassword();

    // Hash password
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Create user account
    const userId = randomUUID();
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        email: teacher.email,
        passwordHash,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        role: UserRole.TEACHER,
        phone: teacher.phone,
        isActive: true,
      },
    });

    // Link teacher to user and keep the plaintext password for the "Compte" tab
    await prisma.teachers.update({
      where: { id: teacherId },
      data: { user_id: userId, generated_password: plainPassword },
    });

    const emailSent = await sendAccountCredentialsEmail({
      to: teacher.email, firstName: teacher.first_name, lastName: teacher.last_name,
      role: 'TEACHER', login: teacher.email, password: plainPassword,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
      },
      teacher: {
        id: teacher.id,
        email: teacher.email,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
      },
      login: teacher.email,
      password: plainPassword,
      emailSent,
    };
  }

  /**
   * Reset (regenerate) the password of a teacher's existing account.
   * @param teacherId - The ID of the teacher
   * @param password - Optional new password; generated automatically if omitted
   * @returns The login and the new plaintext password
   */
  static async resetUserPassword(teacherId: string, password?: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    if (!teacher.user_id) {
      throw new Error("Cet enseignant n'a pas encore de compte utilisateur");
    }

    const plainPassword = password && password.length > 0 ? password : generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    await prisma.user.update({
      where: { id: teacher.user_id },
      data: { passwordHash },
    });

    await prisma.teachers.update({
      where: { id: teacherId },
      data: { generated_password: plainPassword },
    });

    const emailSent = await sendAccountCredentialsEmail({
      to: teacher.email, firstName: teacher.first_name, lastName: teacher.last_name,
      role: 'TEACHER', login: teacher.email, password: plainPassword,
    });

    return {
      login: teacher.email,
      password: plainPassword,
      emailSent,
    };
  }

  /**
   * Get teacher's class assignments
   * @param teacherId - The ID of the teacher
   * @param academicYearId - Optional academic year ID to filter
   * @returns List of class assignments with class and subject details
   */
  static async getTeacherClassAssignments(teacherId: string, academicYearId?: string) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    const where: any = { teacher_id: teacherId };
    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }

    const assignments = await prisma.teacher_class_assignments.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        academic_year: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
      },
      orderBy: [
        { academic_year_id: 'desc' },
        { class: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });

    // Group by class and academic year
    const grouped = assignments.reduce((acc: any, assignment: any) => {
      const key = `${assignment.academic_year_id}-${assignment.class_id}`;
      if (!acc[key]) {
        acc[key] = {
          academicYear: assignment.academic_year,
          class: assignment.class,
          subjects: [],
        };
      }
      acc[key].subjects.push(assignment.subject);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  /**
   * Get teacher's timetable
   * @param teacherId - The ID of the teacher
   * @param academicYearId - Optional academic year ID to filter
   * @returns List of timetable entries
   */
  static async getTeacherTimetable(teacherId: string, academicYearId?: string) {
    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    const where: any = { teacher_id: teacherId };
    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }

    const timetables = await prisma.class_timetables.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        classroom: {
          select: {
            id: true,
            name: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
      },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' },
      ],
    });

    return timetables;
  }
}

export { createTeacherSchema, updateTeacherSchema };

