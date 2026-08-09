import { prisma } from '@school/database';

/**
 * Publication des bulletins d'une classe pour un trimestre.
 *
 * Le bulletin n'est pas une entité stockée : il est recalculé à partir des notes
 * à chaque téléchargement. Ce qui est stocké, c'est l'acte administratif — « les
 * bulletins de cette classe, pour ce trimestre, ont été générés le X ». Cet acte
 * porte deux règles métier, et rien d'autre ne doit les porter :
 *
 *  1. Visibilité — tant qu'aucune publication n'existe, les espaces Parent et
 *     Élève ne voient ni le bulletin, ni les moyennes qu'il contient. Une note
 *     saisie par un enseignant ne rend donc plus le bulletin visible ; seule
 *     l'administration ouvre la porte.
 *  2. Date du document — c'est `generated_at`, et non la date du téléchargement,
 *     qui est imprimée sur le PDF (« Fait à Larabia, le … »).
 */

export interface BulletinRelease {
  id: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  generatedAt: Date;
  generatedBy: { id: string; firstName: string; lastName: string } | null;
}

const shape = {
  id: true,
  academic_year_id: true,
  semester_id: true,
  class_id: true,
  generated_at: true,
  generatedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

function toRelease(row: {
  id: string;
  academic_year_id: string;
  semester_id: string;
  class_id: string;
  generated_at: Date;
  generatedBy: { id: string; firstName: string; lastName: string } | null;
}): BulletinRelease {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    semesterId: row.semester_id,
    classId: row.class_id,
    generatedAt: row.generated_at,
    generatedBy: row.generatedBy,
  };
}

/** Publication d'une classe pour un trimestre, ou `null` si les bulletins n'ont pas été générés. */
export async function getRelease(
  classId: string,
  semesterId: string,
  academicYearId: string,
): Promise<BulletinRelease | null> {
  const row = await prisma.bulletin_releases.findUnique({
    where: {
      academic_year_id_semester_id_class_id: {
        academic_year_id: academicYearId,
        semester_id: semesterId,
        class_id: classId,
      },
    },
    select: shape,
  });
  return row ? toRelease(row) : null;
}

/** Publications d'une classe sur toute une année, indexées par trimestre. */
export async function getReleasesBySemester(
  classId: string,
  academicYearId: string,
): Promise<Map<string, BulletinRelease>> {
  const rows = await prisma.bulletin_releases.findMany({
    where: { class_id: classId, academic_year_id: academicYearId },
    select: shape,
  });
  return new Map(rows.map((r) => [r.semester_id, toRelease(r)]));
}

/**
 * Génère (ou regénère) les bulletins d'une classe pour un trimestre.
 * Regénérer met `generated_at` à jour : le document porte toujours la date de la
 * dernière édition, et les parents voient cette date changer — c'est voulu, une
 * correction de notes doit se lire sur le bulletin.
 */
export async function publishRelease(params: {
  classId: string;
  semesterId: string;
  academicYearId: string;
  userId?: string;
}): Promise<BulletinRelease> {
  const { classId, semesterId, academicYearId, userId } = params;
  const now = new Date();

  const row = await prisma.bulletin_releases.upsert({
    where: {
      academic_year_id_semester_id_class_id: {
        academic_year_id: academicYearId,
        semester_id: semesterId,
        class_id: classId,
      },
    },
    create: {
      academic_year_id: academicYearId,
      semester_id: semesterId,
      class_id: classId,
      generated_at: now,
      generated_by: userId ?? null,
    },
    update: {
      generated_at: now,
      generated_by: userId ?? null,
    },
    select: shape,
  });

  return toRelease(row);
}

/** Dépublie : les bulletins redeviennent invisibles côté Parent et Élève. */
export async function unpublishRelease(
  classId: string,
  semesterId: string,
  academicYearId: string,
): Promise<boolean> {
  const { count } = await prisma.bulletin_releases.deleteMany({
    where: { class_id: classId, semester_id: semesterId, academic_year_id: academicYearId },
  });
  return count > 0;
}
