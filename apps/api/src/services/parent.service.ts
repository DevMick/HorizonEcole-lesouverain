import { prisma } from '@school/database';
import { ParentRelation, UserRole } from '@prisma/client';
import crypto, { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { syncParentToOdoo } from './odoo.service';
import { sendAccountCredentialsEmail } from './mail.service';

/**
 * Génère un mot de passe aléatoire lisible (sans caractères ambigus 0/O, 1/l/I).
 * Garantit au moins une majuscule, une minuscule, un chiffre et un symbole.
 * (Même logique que Teacher/Student.)
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
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Domaine interne des logins de secours quand le parent n'a pas d'email. Ces
 * comptes restent inactifs tant qu'aucune vraie adresse n'est renseignée.
 */
const PLACEHOLDER_EMAIL_DOMAIN = 'comptes.souverain.local';

/** Indique si une valeur d'email est une vraie adresse (et pas un placeholder). */
function isRealEmail(email?: string | null): email is string {
  return !!email && email.trim().length > 0 && !email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);
}

/** Construit un login placeholder unique à partir de l'id du parent. */
function placeholderEmailFor(parentId: string): string {
  const slug = parentId.replace(/[^a-z0-9]+/gi, '').toLowerCase().slice(0, 24) || 'parent';
  return `parent-${slug}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export interface CreateParentData {
  firstName: string;
  lastName: string;
  relation: ParentRelation;
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

export interface UpdateParentData extends Partial<CreateParentData> {}

export interface ParentSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  relation?: ParentRelation;
  isPrimaryContact?: boolean;
  isFinancialResponsible?: boolean;
}

export interface ParentWithRelations {
  id: string;
  firstName: string;
  lastName: string;
  relation: ParentRelation;
  phone: string;
  email?: string;
  address?: string;
  profession?: string;
  workplace?: string;
  avatarUrl?: string;
  isPrimaryContact: boolean;
  isFinancialResponsible: boolean;
  userId?: string | null;
  generatedPassword?: string | null;
  user?: { id: string; email: string; isActive: boolean; role: string } | null;
  createdAt: Date;
  updatedAt: Date;
  studentParents?: Array<{
    id: string;
    relation: ParentRelation;
    student: {
      id: string;
      studentNumber: string;
      firstName: string;
      lastName: string;
      class?: {
        id: string;
        name: string;
        level: string;
      };
    };
  }>;
}

export class ParentService {
  /**
   * Synchronise (best-effort) un parent vers Odoo (Contacts/CRM) et enregistre
   * l'id du partner Odoo obtenu pour les prochaines synchronisations.
   * N'importe quelle erreur (Odoo éteint, non configuré...) est avalée : ça ne
   * doit jamais faire échouer la création/mise à jour du parent.
   */
  static async syncToOdoo(parentId: string): Promise<void> {
    try {
      const parent = await prisma.parents.findUnique({
        where: { id: parentId },
        include: {
          student_parents: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
              },
            },
          },
        },
      });
      if (!parent) return;

      const odooPartnerId = await syncParentToOdoo({
        id: parent.id,
        firstName: parent.first_name,
        lastName: parent.last_name,
        phone: parent.phone,
        email: parent.email,
        relation: parent.relation,
        odooPartnerId: parent.odoo_partner_id,
        children: parent.student_parents.map((sp) => ({
          id: sp.student.id,
          firstName: sp.student.firstName,
          lastName: sp.student.lastName,
          className: sp.student.class?.name ?? null,
        })),
      });

      if (odooPartnerId && odooPartnerId !== parent.odoo_partner_id) {
        await prisma.parents.update({
          where: { id: parentId },
          data: { odoo_partner_id: odooPartnerId },
        });
      }
    } catch (err) {
      console.warn(`Synchronisation Odoo du parent ${parentId} échouée :`, (err as Error).message);
    }
  }

  /**
   * Get parents with pagination and filters
   */
  static async getParents(params: ParentSearchParams) {
    const { page = 1, limit = 10, search, relation, isPrimaryContact, isFinancialResponsible } = params;

    const where: any = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { profession: { contains: search, mode: 'insensitive' } },
        { workplace: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (relation) {
      where.relation = relation;
    }

    if (isPrimaryContact !== undefined) {
      where.is_primary_contact = isPrimaryContact;
    }

    if (isFinancialResponsible !== undefined) {
      where.is_financial_responsible = isFinancialResponsible;
    }

    const skip = (page - 1) * limit;

    const [parents, total] = await Promise.all([
      prisma.parents.findMany({
        where,
        include: {
          student_parents: {
            include: {
              student: {
                select: {
                  id: true,
                  studentNumber: true,
                  firstName: true,
                  lastName: true,
                  class: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.parents.count({ where }),
    ]);

    const transformedParents = parents.map((parent) => ({
      id: parent.id,
      firstName: parent.first_name,
      lastName: parent.last_name,
      relation: parent.relation,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      profession: parent.profession,
      workplace: parent.workplace,
      avatarUrl: parent.avatar_url,
      isPrimaryContact: parent.is_primary_contact,
      isFinancialResponsible: parent.is_financial_responsible,
      createdAt: parent.created_at,
      updatedAt: parent.updated_at,
      studentParents: parent.student_parents?.map((sp) => ({
        id: sp.id,
        relation: sp.relation,
        student: {
          id: sp.student.id,
          studentNumber: sp.student.studentNumber,
          firstName: sp.student.firstName,
          lastName: sp.student.lastName,
          class: sp.student.class ? { id: sp.student.class.id, name: sp.student.class.name } : undefined,
        },
      })),
    }));

    return {
      parents: transformedParents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get parent by ID with all relations
   */
  static async getParentById(id: string): Promise<ParentWithRelations | null> {
    const parent = await prisma.parents.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true, role: true } },
        student_parents: {
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                firstName: true,
                lastName: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) return null;

    // Transform snake_case to camelCase for ParentWithRelations
    return {
      id: parent.id,
      firstName: parent.first_name,
      lastName: parent.last_name,
      relation: parent.relation,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      profession: parent.profession,
      workplace: parent.workplace,
      avatarUrl: parent.avatar_url,
      isPrimaryContact: parent.is_primary_contact,
      isFinancialResponsible: parent.is_financial_responsible,
      userId: parent.user_id,
      generatedPassword: parent.generated_password,
      user: parent.user,
      createdAt: parent.created_at,
      updatedAt: parent.updated_at,
      studentParents: parent.student_parents?.map(sp => ({
        id: sp.id,
        relation: sp.relation,
        student: {
          id: sp.student.id,
          studentNumber: sp.student.studentNumber,
          firstName: sp.student.firstName,
          lastName: sp.student.lastName,
          class: sp.student.class ? {
            id: sp.student.class.id,
            name: sp.student.class.name,
            level: (sp.student.class as any).level || '',
          } : undefined,
        },
      })),
    };
  }

  /**
   * Create new parent
   */
  static async createParent(data: CreateParentData & { userId?: string }) {
    const parentData: any = {
      id: crypto.randomUUID(),
      first_name: data.firstName,
      last_name: data.lastName,
      relation: data.relation,
      phone: data.phone,
      email: data.email,
      address: data.address,
      profession: data.profession,
      workplace: data.workplace,
      is_primary_contact: data.isPrimaryContact || false,
      is_financial_responsible: data.isFinancialResponsible || false,
    };
    if (data.userId) {
      parentData.user_id = data.userId;
    }
    const parent = await prisma.parents.create({
      data: parentData,
      include: {
        student_parents: {
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                firstName: true,
                lastName: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Création automatique du compte de connexion du parent (best-effort). Le
    // compte est ACTIF si une adresse email réelle est fournie, sinon INACTIF
    // (login placeholder) jusqu'à ce qu'une adresse soit renseignée.
    let account: { userId: string | null; generatedPassword: string | null } = {
      userId: parent.user_id,
      generatedPassword: null,
    };
    if (!parent.user_id) {
      try {
        await ParentService.createUserAccount(parent.id);
        const refreshed = await prisma.parents.findUnique({
          where: { id: parent.id },
          select: { user_id: true, generated_password: true },
        });
        account = { userId: refreshed?.user_id ?? null, generatedPassword: refreshed?.generated_password ?? null };
      } catch (err) {
        console.warn(
          `Auto-création du compte pour le parent ${parent.id} échouée :`,
          (err as Error).message
        );
      }
    }

    void ParentService.syncToOdoo(parent.id);

    return {
      id: parent.id,
      firstName: parent.first_name,
      lastName: parent.last_name,
      relation: parent.relation,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      profession: parent.profession,
      workplace: parent.workplace,
      avatarUrl: parent.avatar_url,
      isPrimaryContact: parent.is_primary_contact,
      isFinancialResponsible: parent.is_financial_responsible,
      userId: account.userId,
      generatedPassword: account.generatedPassword,
      createdAt: parent.created_at,
      updatedAt: parent.updated_at,
      studentParents: parent.student_parents,
    };
  }

  /**
   * Create a login account for a parent.
   *
   * Comme pour les élèves, l'email d'un parent est facultatif :
   *   - email réel → login = cet email, compte ACTIF ;
   *   - pas d'email → login placeholder unique dérivé de l'id, compte INACTIF.
   *
   * @param parentId - The ID of the parent
   * @param password - Optional password; generated automatically if omitted
   */
  static async createUserAccount(parentId: string, password?: string) {
    const parent = await prisma.parents.findUnique({ where: { id: parentId } });

    if (!parent) {
      throw new Error('Parent non trouvé');
    }

    if (parent.user_id) {
      throw new Error('Ce parent a déjà un compte utilisateur');
    }

    const hasRealEmail = isRealEmail(parent.email);
    const loginEmail = hasRealEmail ? parent.email!.trim() : placeholderEmailFor(parent.id);

    const plainPassword = password && password.length > 0 ? password : generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // Un compte peut déjà exister avec cet email (compte parent orphelin issu
    // d'un import ou d'une tentative antérieure, non rattaché à cette fiche).
    // S'il est du bon rôle et libre, on l'ADOPTE plutôt que d'échouer ; sinon
    // c'est un vrai conflit (email utilisé par un autre compte/personne).
    const existingUser = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (existingUser) {
      const linkedElsewhere = await prisma.parents.findFirst({
        where: { user_id: existingUser.id, NOT: { id: parentId } },
        select: { id: true },
      });
      if (existingUser.role !== UserRole.PARENT || linkedElsewhere) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      const adopted = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          firstName: parent.first_name,
          lastName: parent.last_name,
          phone: parent.phone || null,
          isActive: hasRealEmail ? true : existingUser.isActive,
        },
      });

      await prisma.parents.update({
        where: { id: parentId },
        data: { user_id: adopted.id, generated_password: plainPassword },
      });

      const emailSent = hasRealEmail
        ? await sendAccountCredentialsEmail({
            to: loginEmail, firstName: parent.first_name, lastName: parent.last_name,
            role: 'PARENT', login: loginEmail, password: plainPassword,
          })
        : false;

      return {
        user: {
          id: adopted.id,
          email: adopted.email,
          firstName: adopted.firstName,
          lastName: adopted.lastName,
          role: adopted.role,
          isActive: adopted.isActive,
        },
        login: loginEmail,
        password: plainPassword,
        isActive: adopted.isActive,
        adopted: true,
        emailSent,
      };
    }

    const userId = crypto.randomUUID();
    const newUser = await prisma.user.create({
      data: {
        id: userId,
        email: loginEmail,
        passwordHash,
        firstName: parent.first_name,
        lastName: parent.last_name,
        role: UserRole.PARENT,
        phone: parent.phone || null,
        isActive: hasRealEmail,
      },
    });

    await prisma.parents.update({
      where: { id: parentId },
      data: { user_id: userId, generated_password: plainPassword },
    });

    const emailSent = hasRealEmail
      ? await sendAccountCredentialsEmail({
          to: loginEmail, firstName: parent.first_name, lastName: parent.last_name,
          role: 'PARENT', login: loginEmail, password: plainPassword,
        })
      : false;

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isActive: newUser.isActive,
      },
      login: loginEmail,
      password: plainPassword,
      isActive: hasRealEmail,
      emailSent,
    };
  }

  /**
   * Reset (regenerate) the password of a parent's existing account.
   */
  static async resetUserPassword(parentId: string, password?: string) {
    const parent = await prisma.parents.findUnique({ where: { id: parentId } });

    if (!parent) {
      throw new Error('Parent non trouvé');
    }

    if (!parent.user_id) {
      throw new Error("Ce parent n'a pas encore de compte utilisateur");
    }

    const plainPassword = password && password.length > 0 ? password : generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    await prisma.user.update({
      where: { id: parent.user_id },
      data: { passwordHash },
    });

    await prisma.parents.update({
      where: { id: parentId },
      data: { generated_password: plainPassword },
    });

    const user = await prisma.user.findUnique({
      where: { id: parent.user_id },
      select: { email: true, isActive: true },
    });

    const emailSent = user?.isActive && user.email
      ? await sendAccountCredentialsEmail({
          to: user.email, firstName: parent.first_name, lastName: parent.last_name,
          role: 'PARENT', login: user.email, password: plainPassword,
        })
      : false;

    return {
      login: user?.email,
      password: plainPassword,
      isActive: user?.isActive ?? false,
      emailSent,
    };
  }

  /**
   * Réconcilie le compte de connexion d'un parent avec son email courant :
   * crée le compte s'il manque, et l'ACTIVE + met à jour le login dès qu'une
   * vraie adresse email est renseignée. Ne désactive jamais un compte actif.
   */
  static async syncUserAccountWithEmail(parentId: string) {
    const parent = await prisma.parents.findUnique({
      where: { id: parentId },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
    if (!parent) return;

    if (!parent.user_id || !parent.user) {
      try {
        await ParentService.createUserAccount(parentId);
      } catch (err) {
        console.warn(`Sync compte parent ${parentId} : création échouée —`, (err as Error).message);
      }
      return;
    }

    if (!isRealEmail(parent.email)) return;

    const desiredEmail = parent.email!.trim();
    const needsEmailChange = desiredEmail !== parent.user.email;
    const needsActivation = !parent.user.isActive;
    if (!needsEmailChange && !needsActivation) return;

    if (needsEmailChange) {
      const clash = await prisma.user.findUnique({ where: { email: desiredEmail } });
      if (clash && clash.id !== parent.user_id) {
        console.warn(`Sync compte parent ${parentId} : email ${desiredEmail} déjà utilisé, activation ignorée.`);
        return;
      }
    }

    await prisma.user.update({
      where: { id: parent.user_id },
      data: { email: desiredEmail, isActive: true },
    });
  }

  /**
   * Update parent
   */
  static async updateParent(id: string, data: UpdateParentData) {
    // Check if parent exists
    const existingParent = await prisma.parents.findUnique({
      where: { id },
    });

    if (!existingParent) {
      throw new Error('Parent not found');
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.first_name = data.firstName;
    if (data.lastName !== undefined) updateData.last_name = data.lastName;
    if (data.relation !== undefined) updateData.relation = data.relation;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.profession !== undefined) updateData.profession = data.profession;
    if (data.workplace !== undefined) updateData.workplace = data.workplace;
    if (data.isPrimaryContact !== undefined) updateData.is_primary_contact = data.isPrimaryContact;
    if (data.isFinancialResponsible !== undefined) updateData.is_financial_responsible = data.isFinancialResponsible;
    updateData.updated_at = new Date();

    const parent = await prisma.parents.update({
      where: { id },
      data: updateData,
      include: {
        student_parents: {
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                firstName: true,
                lastName: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Réconcilie le compte : création si absent, activation + mise à jour du
    // login dès qu'une vraie adresse email est renseignée.
    let synced: { userId: string | null; generatedPassword: string | null } = {
      userId: parent.user_id,
      generatedPassword: parent.generated_password,
    };
    try {
      await ParentService.syncUserAccountWithEmail(id);
      const refreshed = await prisma.parents.findUnique({
        where: { id },
        select: { user_id: true, generated_password: true },
      });
      synced = { userId: refreshed?.user_id ?? null, generatedPassword: refreshed?.generated_password ?? null };
    } catch (err) {
      console.warn(`Sync compte parent ${id} après mise à jour échouée :`, (err as Error).message);
    }

    void ParentService.syncToOdoo(id);

    return {
      id: parent.id,
      firstName: parent.first_name,
      lastName: parent.last_name,
      relation: parent.relation,
      phone: parent.phone,
      email: parent.email,
      address: parent.address,
      profession: parent.profession,
      workplace: parent.workplace,
      avatarUrl: parent.avatar_url,
      isPrimaryContact: parent.is_primary_contact,
      isFinancialResponsible: parent.is_financial_responsible,
      userId: synced.userId,
      generatedPassword: synced.generatedPassword,
      createdAt: parent.created_at,
      updatedAt: parent.updated_at,
      studentParents: parent.student_parents,
    };
  }

  /**
   * Delete parent
   */
  static async deleteParent(id: string) {
    // Check if parent exists
    const existingParent = await prisma.parents.findUnique({
      where: { id },
    });

    if (!existingParent) {
      throw new Error('Parent not found');
    }

    // Check if parent has linked students
    const linkedStudents = await prisma.student_parents.count({
        where: { parent_id: id },
    });

    if (linkedStudents > 0) {
      throw new Error('Cannot delete parent with linked students. Unlink students first.');
    }

    await prisma.parents.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Update parent avatar
   */
  static async updateAvatar(id: string, avatarUrl: string) {
    const parent = await prisma.parents.update({
      where: { id },
        data: { avatar_url: avatarUrl },
      select: {
        id: true,
        avatar_url: true,
      },
    });

    return parent;
  }

  /**
   * Get parent statistics
   */
  static async getParentStats() {
    const [
      totalParents,
      parentsByRelation,
      primaryContacts,
      financialResponsibles,
    ] = await Promise.all([
      prisma.parents.count(),
      prisma.parents.groupBy({
        by: ['relation'],
        _count: { relation: true },
      }),
      prisma.parents.count({ where: { is_primary_contact: true } }),
      prisma.parents.count({ where: { is_financial_responsible: true } }),
    ]);

    return {
      totalParents,
      parentsByRelation,
      primaryContacts,
      financialResponsibles,
    };
  }

  /**
   * Search parents by phone or email
   */
  static async searchParents(query: string) {
    const parents = await prisma.parents.findMany({
      where: {
        OR: [
          { phone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone: true,
        email: true,
        relation: true,
      },
      take: 10,
    });

    return parents;
  }
}
