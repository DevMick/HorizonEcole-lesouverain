import { randomUUID } from 'crypto';
import { prisma } from '@school/database';

/**
 * Génération automatique du programme (matières + rattachement aux classes)
 * selon l'organisation des enseignements du MENA ivoirien.
 *
 * Les classes sont nommées « <niveau> <division> » (ex. « 6ème 1 »), le niveau
 * se déduit donc du nom en retirant le numéro de division. Les clés de niveau
 * sont celles du générateur de classes (COLLEGE_LEVELS / LYCEE_LEVELS côté web) :
 * 6ème, 5ème, 4ème, 3ème, 2nde A, 2nde C, 1ère A/C/D, Tle A/C/D.
 */

/** Référentiel des matières. Le code sert de clé d'unicité en base. */
const SUBJECTS = {
  FR: 'Français',
  MATH: 'Mathématiques',
  ANG: 'Anglais',
  ESP: 'Espagnol',
  HG: 'Histoire-Géographie',
  SVT: 'Sciences de la Vie et de la Terre',
  PC: 'Physique-Chimie',
  PHILO: 'Philosophie',
  EDHC: 'Éducation aux Droits de l\'Homme et à la Citoyenneté',
  EPS: 'Éducation Physique et Sportive',
} as const;

export type SubjectCode = keyof typeof SUBJECTS;

/** Une matière telle qu'enseignée dans un niveau donné. */
interface CurriculumEntry {
  code: SubjectCode;
  coefficient: number;
  hoursPerWeek: number;
}

const e = (code: SubjectCode, coefficient: number, hoursPerWeek: number): CurriculumEntry =>
  ({ code, coefficient, hoursPerWeek });

// ─── Collège : tronc commun ────────────────────────────────────────────────
// Mêmes disciplines de la 6ème à la 3ème, la LV2 s'ajoutant en 4ème.
const COLLEGE_BASE: CurriculumEntry[] = [
  e('FR', 4, 5),
  e('MATH', 4, 5),
  e('ANG', 2, 3),
  e('HG', 2, 3),
  e('SVT', 2, 2),
  e('PC', 2, 2),
  e('EDHC', 1, 1),
  e('EPS', 1, 2),
];
const COLLEGE_AVEC_LV2: CurriculumEntry[] = [...COLLEGE_BASE, e('ESP', 2, 3)];

// ─── Lycée ────────────────────────────────────────────────────────────────
// Série A (littéraire) : lettres et langues dominantes, sciences allégées.
const SERIE_A: CurriculumEntry[] = [
  e('FR', 4, 5),
  e('HG', 3, 4),
  e('ANG', 3, 4),
  e('ESP', 2, 3),
  e('MATH', 2, 3),
  e('SVT', 1, 2),
  e('EDHC', 1, 1),
  e('EPS', 1, 2),
];

// Série C (sciences exactes) : mathématiques et physique-chimie dominantes.
const SERIE_C: CurriculumEntry[] = [
  e('MATH', 5, 7),
  e('PC', 5, 6),
  e('SVT', 3, 3),
  e('FR', 3, 4),
  e('ANG', 2, 3),
  e('HG', 2, 2),
  e('EDHC', 1, 1),
  e('EPS', 1, 2),
];

// Série D (sciences de la nature) : la SVT y pèse davantage qu'en C.
const SERIE_D: CurriculumEntry[] = [
  e('MATH', 4, 5),
  e('SVT', 4, 5),
  e('PC', 4, 5),
  e('FR', 3, 4),
  e('ANG', 2, 3),
  e('HG', 2, 2),
  e('EDHC', 1, 1),
  e('EPS', 1, 2),
];

/** La philosophie n'apparaît qu'en Terminale, mais dans toutes les séries. */
const PHILO_PAR_SERIE: Record<string, CurriculumEntry> = {
  A: e('PHILO', 4, 5),
  C: e('PHILO', 2, 2),
  D: e('PHILO', 2, 2),
};

const CURRICULUM: Record<string, CurriculumEntry[]> = {
  '6ème': COLLEGE_BASE,
  '5ème': COLLEGE_BASE,
  '4ème': COLLEGE_AVEC_LV2,
  '3ème': COLLEGE_AVEC_LV2,

  '2nde A': SERIE_A,
  '2nde C': SERIE_C,

  '1ère A': SERIE_A,
  '1ère C': SERIE_C,
  '1ère D': SERIE_D,

  'Tle A': [...SERIE_A, PHILO_PAR_SERIE.A],
  'Tle C': [...SERIE_C, PHILO_PAR_SERIE.C],
  'Tle D': [...SERIE_D, PHILO_PAR_SERIE.D],
};

/**
 * Déduit la clé de niveau depuis le nom d'une classe.
 * « 6ème 1 » → « 6ème », « Tle D 2 » → « Tle D », « 2nde C » → « 2nde C ».
 * Retourne null si le niveau n'est pas au programme (classe hors référentiel).
 */
export function deriveLevelKey(className: string): string | null {
  const cleaned = className.trim().replace(/\s+/g, ' ');
  // Retire une éventuelle division numérique finale.
  const withoutDivision = cleaned.replace(/\s*\d+\s*$/, '').trim();

  const candidates = [withoutDivision, cleaned];
  for (const c of candidates) {
    const match = Object.keys(CURRICULUM).find(
      (level) => level.toLowerCase() === c.toLowerCase(),
    );
    if (match) return match;
  }
  return null;
}

export interface CurriculumResult {
  className: string;
  level: string | null;
  subjectsCreated: number;
  linksCreated: number;
  skipped?: string;
}

/**
 * Crée les matières manquantes du référentiel puis les rattache à la classe.
 *
 * Idempotent : les matières sont résolues par `code` et les rattachements
 * respectent la contrainte d'unicité (class_id, subject_id). Relancer la
 * génération ne crée donc pas de doublon et ne modifie pas les coefficients
 * déjà ajustés à la main.
 */
export async function generateCurriculumForClass(
  classId: string,
  className: string,
): Promise<CurriculumResult> {
  const level = deriveLevelKey(className);
  if (!level) {
    return { className, level: null, subjectsCreated: 0, linksCreated: 0,
             skipped: 'niveau hors référentiel' };
  }

  const entries = CURRICULUM[level];
  let subjectsCreated = 0;
  let linksCreated = 0;

  for (const entry of entries) {
    // 1. La matière existe-t-elle déjà dans le référentiel ?
    let subject = await prisma.subjects.findUnique({ where: { code: entry.code } });
    if (!subject) {
      subject = await prisma.subjects.create({
        data: {
          id: randomUUID(),
          name: SUBJECTS[entry.code],
          code: entry.code,
          coefficient: entry.coefficient,
        },
      });
      subjectsCreated += 1;
    }

    // 2. Rattachement à la classe, sans écraser un réglage manuel existant.
    const existingLink = await prisma.class_subjects.findUnique({
      where: { class_id_subject_id: { class_id: classId, subject_id: subject.id } },
    });
    if (!existingLink) {
      await prisma.class_subjects.create({
        data: {
          id: randomUUID(),
          class_id: classId,
          subject_id: subject.id,
          coefficient: entry.coefficient,
          hours_per_week: entry.hoursPerWeek,
        },
      });
      linksCreated += 1;
    }
  }

  return { className, level, subjectsCreated, linksCreated };
}

/**
 * Variante « ne casse jamais l'appelant » : utilisée à la création d'une classe,
 * où un échec de génération ne doit pas faire échouer la création elle-même.
 */
export async function generateCurriculumSafe(classId: string, className: string): Promise<void> {
  try {
    const r = await generateCurriculumForClass(classId, className);
    if (r.skipped) {
      console.warn(`Programme non généré pour « ${className} » : ${r.skipped}.`);
    } else {
      console.log(
        `Programme généré pour « ${className} » (${r.level}) : ` +
        `${r.subjectsCreated} matière(s) créée(s), ${r.linksCreated} rattachement(s).`,
      );
    }
  } catch (err: any) {
    console.warn(`Génération du programme pour « ${className} » échouée :`, err.message);
  }
}

/** Applique la génération à toutes les classes existantes (rattrapage). */
export async function generateCurriculumForAllClasses(): Promise<CurriculumResult[]> {
  const classes = await prisma.schoolClass.findMany({ orderBy: { name: 'asc' } });
  const results: CurriculumResult[] = [];
  for (const c of classes) {
    results.push(await generateCurriculumForClass(c.id, c.name));
  }
  return results;
}

/** Exposé pour les tests et l'affichage : le programme d'un niveau donné. */
export function curriculumForLevel(level: string): CurriculumEntry[] | null {
  return CURRICULUM[level] ?? null;
}
