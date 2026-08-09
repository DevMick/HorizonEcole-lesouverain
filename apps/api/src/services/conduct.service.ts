import { prisma } from '@school/database';
import crypto from 'crypto';
import { deleteFile, getFilePath } from '../middleware/upload';

/**
 * Conduite — note de comportement par (année, trimestre, classe, élève).
 *
 * ⚠️ L'unité est l'HEURE DE COURS, pas l'heure d'horloge. Un créneau de l'emploi
 * du temps (07:45–08:35, soit 50 min) vaut 1 heure de cours ; une séance couvrant
 * deux créneaux consécutifs (08:35–10:15) en vaut 2. La conversion se fait en
 * divisant la durée de la séance par `period_minutes` (50 par défaut).
 *
 * Calcul : on part d'une base (20/20) et on retire 1 point par tranche pleine de
 * `hours_per_point` heures de cours manquées (2 par défaut ⇒ moins de 2 h = aucune
 * pénalité, 2 h = -1, 3 h = -1, 4 h = -2…). Les heures proviennent :
 *   1. des séances d'appel (`attendance_sessions` + `attendance_records`),
 *      converties en heures de cours comme ci-dessus ;
 *   2. du journal legacy `student_absences` (heures saisies à la main) ;
 *   3. d'une correction admin par matière (`conduct_absence_overrides`), qui
 *      *remplace* le total des deux sources ci-dessus pour cette matière.
 *
 * Seules les absences `ABSENT` non justifiées comptent (les retards et les
 * absences excusées sont ignorés).
 *
 * La note est entièrement automatique : `final_note` = `computed_note`. L'admin
 * n'agit plus que sur les HEURES retenues par matière (`conduct_absence_overrides`,
 * avec justificatif PDF optionnel), ce qui se répercute aussitôt sur la note. Il
 * n'y a plus d'étape de validation : la conduite est recalculée à chaque lecture
 * et pèse immédiatement dans « Moyennes complètes » et les bulletins.
 */

export const CONDUCT_DEFAULTS = {
  baseNote: 20,
  hoursPerPoint: 2,
  defaultSessionHours: 1,
  periodMinutes: 50,
  coefficient: 1,
};

export interface ConductSettings {
  academicYearId: string;
  baseNote: number;
  hoursPerPoint: number;
  defaultSessionHours: number;
  /** Durée d'un créneau de l'emploi du temps, en minutes (= 1 heure de cours). */
  periodMinutes: number;
  coefficient: number;
}

const num = (v: any, fallback = 0): number => (v === null || v === undefined ? fallback : Number(v));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clampNote = (n: number) => Math.min(20, Math.max(0, round2(n)));

/** 'HH:MM' → heures décimales. Renvoie null si non parsable. */
function parseTime(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2})[:hH](\d{1,2})?/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h + min / 60;
}

/**
 * Nombre d'HEURES DE COURS couvertes par une séance d'appel.
 *
 * On ne compte pas les minutes d'horloge mais les créneaux de l'emploi du temps :
 * la durée de la séance est divisée par `periodMinutes` (durée d'un créneau) puis
 * arrondie, avec un minimum de 1. Avec des créneaux de 50 min :
 *   07:45→08:35 (50 min)  → 1 heure de cours
 *   08:35→10:15 (100 min) → 2 heures de cours
 *   07:45→09:25 (100 min) → 2 heures de cours
 * Une séance sans horaire retombe sur `defaultHours`.
 */
export function sessionDurationHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  defaultHours: number,
  periodMinutes: number = CONDUCT_DEFAULTS.periodMinutes,
): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null) return defaultHours;

  const minutes = (end - start) * 60;
  // Garde-fou : un créneau incohérent (négatif, nul, > 12h) retombe sur la valeur par défaut.
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 12 * 60) return defaultHours;

  const period = periodMinutes > 0 ? periodMinutes : CONDUCT_DEFAULTS.periodMinutes;
  return Math.max(1, Math.round(minutes / period));
}

/** Pénalité : 1 point par tranche pleine de `hoursPerPoint` heures. */
export function conductPenalty(absenceHours: number, hoursPerPoint: number): number {
  if (hoursPerPoint <= 0) return 0;
  return Math.floor(round1(absenceHours) / hoursPerPoint);
}

export interface ConductSubjectBreakdown {
  subjectId: string;
  subjectName: string;
  sessionHours: number;
  legacyHours: number;
  overrideHours: number | null;
  hours: number;
  /** Justificatif joint à la correction d'heures (PDF/image), s'il existe. */
  justificatifUrl: string | null;
  justificatifFilename: string | null;
}

export interface ConductRow {
  id: string | null;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  baseNote: number;
  absenceHours: number;
  penalty: number;
  computedNote: number;
  manualNote: number | null;
  finalNote: number;
  comment: string | null;
  isValidated: boolean;
  validatedAt: Date | null;
  computedAt: Date | null;
  bySubject: ConductSubjectBreakdown[];
}

export class ConductService {
  // --- Paramètres -----------------------------------------------------------

  static async getSettings(academicYearId: string): Promise<ConductSettings> {
    const row = await prisma.conduct_settings.findUnique({ where: { academic_year_id: academicYearId } });
    return {
      academicYearId,
      baseNote: row ? num(row.base_note, CONDUCT_DEFAULTS.baseNote) : CONDUCT_DEFAULTS.baseNote,
      hoursPerPoint: row ? num(row.hours_per_point, CONDUCT_DEFAULTS.hoursPerPoint) : CONDUCT_DEFAULTS.hoursPerPoint,
      defaultSessionHours: row
        ? num(row.default_session_hours, CONDUCT_DEFAULTS.defaultSessionHours)
        : CONDUCT_DEFAULTS.defaultSessionHours,
      periodMinutes: row ? num(row.period_minutes, CONDUCT_DEFAULTS.periodMinutes) : CONDUCT_DEFAULTS.periodMinutes,
      coefficient: row ? num(row.coefficient, CONDUCT_DEFAULTS.coefficient) : CONDUCT_DEFAULTS.coefficient,
    };
  }

  static async updateSettings(
    academicYearId: string,
    data: {
      baseNote?: number;
      hoursPerPoint?: number;
      defaultSessionHours?: number;
      periodMinutes?: number;
      coefficient?: number;
    },
  ): Promise<ConductSettings> {
    const current = await this.getSettings(academicYearId);
    const merged = {
      base_note: data.baseNote ?? current.baseNote,
      hours_per_point: data.hoursPerPoint ?? current.hoursPerPoint,
      default_session_hours: data.defaultSessionHours ?? current.defaultSessionHours,
      period_minutes: data.periodMinutes ?? current.periodMinutes,
      coefficient: data.coefficient ?? current.coefficient,
    };

    await prisma.conduct_settings.upsert({
      where: { academic_year_id: academicYearId },
      update: merged,
      create: { id: crypto.randomUUID(), academic_year_id: academicYearId, ...merged },
    });

    return this.getSettings(academicYearId);
  }

  // --- Calcul ---------------------------------------------------------------

  /**
   * Calcule (sans écrire) la conduite de tous les élèves d'une classe pour un
   * trimestre, en fusionnant le calcul système avec la ligne déjà enregistrée
   * (note forcée, commentaire, statut de validation).
   */
  static async computeClass(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    settings?: ConductSettings;
  }): Promise<{ rows: ConductRow[]; settings: ConductSettings }> {
    const { academicYearId, semesterId, classId } = params;
    const settings = params.settings ?? (await this.getSettings(academicYearId));

    const semester = await prisma.semesters.findUnique({ where: { id: semesterId } });
    if (!semester) throw new Error('Semester not found');
    if (semester.academic_year_id !== academicYearId) {
      throw new Error('Semester does not belong to this academic year');
    }

    const students = await prisma.student.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, studentNumber: true, gender: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    if (students.length === 0) return { rows: [], settings };

    const studentIds = students.map((s) => s.id);
    const period = { gte: semester.start_date, lte: semester.end_date };

    // 1. Heures issues des séances d'appel, sur la période du trimestre.
    const sessions = await prisma.attendance_sessions.findMany({
      where: { academic_year_id: academicYearId, class_id: classId, date: period },
      select: {
        id: true,
        subject_id: true,
        start_time: true,
        end_time: true,
        subject: { select: { id: true, name: true } },
      },
    });

    const records = sessions.length
      ? await prisma.attendance_records.findMany({
          where: {
            session_id: { in: sessions.map((s) => s.id) },
            student_id: { in: studentIds },
            status: 'ABSENT',
            is_justified: false,
          },
          select: { session_id: true, student_id: true },
        })
      : [];

    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const subjectNames = new Map<string, string>();
    sessions.forEach((s) => subjectNames.set(s.subject_id, s.subject?.name || '—'));

    // clé « studentId::subjectId » → heures
    const sessionHours = new Map<string, number>();
    for (const r of records) {
      const s = sessionById.get(r.session_id);
      if (!s) continue;
      const hours = sessionDurationHours(
        s.start_time,
        s.end_time,
        settings.defaultSessionHours,
        settings.periodMinutes,
      );
      const key = `${r.student_id}::${s.subject_id}`;
      sessionHours.set(key, round1((sessionHours.get(key) ?? 0) + hours));
    }

    // 2. Journal legacy des heures d'absence (saisie manuelle enseignant).
    const legacy = await prisma.student_absences.groupBy({
      by: ['student_id', 'subject_id'],
      where: {
        academic_year_id: academicYearId,
        class_id: classId,
        semester_id: semesterId,
        student_id: { in: studentIds },
      },
      _sum: { hours_absent: true },
    });
    const legacyHours = new Map<string, number>();
    for (const l of legacy) {
      legacyHours.set(`${l.student_id}::${l.subject_id}`, round1(num(l._sum.hours_absent)));
    }

    // 3. Corrections admin (justifications) : remplacent le total par matière,
    //    avec justificatif PDF/image optionnel.
    const overrides = await prisma.conduct_absence_overrides.findMany({
      where: { academic_year_id: academicYearId, semester_id: semesterId, student_id: { in: studentIds } },
      select: {
        student_id: true,
        subject_id: true,
        hours: true,
        justificatif_url: true,
        justificatif_filename: true,
        subject: { select: { name: true } },
      },
    });
    const overrideHours = new Map<string, number>();
    const overrideJustificatif = new Map<string, { url: string | null; filename: string | null }>();
    for (const o of overrides) {
      const key = `${o.student_id}::${o.subject_id}`;
      overrideHours.set(key, round1(num(o.hours)));
      overrideJustificatif.set(key, {
        url: o.justificatif_url ?? null,
        filename: o.justificatif_filename ?? null,
      });
      if (!subjectNames.has(o.subject_id)) subjectNames.set(o.subject_id, o.subject?.name || '—');
    }

    // Noms des matières restantes (legacy sans séance).
    const missingNames = [...legacyHours.keys()]
      .map((k) => k.split('::')[1])
      .filter((sid) => !subjectNames.has(sid));
    if (missingNames.length) {
      const subs = await prisma.subjects.findMany({
        where: { id: { in: [...new Set(missingNames)] } },
        select: { id: true, name: true },
      });
      subs.forEach((s) => subjectNames.set(s.id, s.name));
    }

    // Lignes déjà enregistrées (note forcée / validation).
    const existing = await prisma.conduct_grades.findMany({
      where: { academic_year_id: academicYearId, semester_id: semesterId, class_id: classId },
    });
    const existingByStudent = new Map(existing.map((e) => [e.student_id, e]));

    const rows: ConductRow[] = students.map((st) => {
      const bySubject: ConductSubjectBreakdown[] = [];

      for (const [subjectId, subjectName] of subjectNames) {
        const key = `${st.id}::${subjectId}`;
        const sh = sessionHours.get(key) ?? 0;
        const lh = legacyHours.get(key) ?? 0;
        const oh = overrideHours.has(key) ? (overrideHours.get(key) as number) : null;
        const hours = oh !== null ? oh : round1(sh + lh);
        // On n'affiche que les matières où il se passe quelque chose.
        if (sh === 0 && lh === 0 && oh === null) continue;
        const just = overrideJustificatif.get(key);
        bySubject.push({
          subjectId,
          subjectName,
          sessionHours: sh,
          legacyHours: lh,
          overrideHours: oh,
          hours,
          justificatifUrl: just?.url ?? null,
          justificatifFilename: just?.filename ?? null,
        });
      }
      bySubject.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

      const absenceHours = round1(bySubject.reduce((acc, s) => acc + s.hours, 0));
      const penalty = conductPenalty(absenceHours, settings.hoursPerPoint);
      const computedNote = clampNote(settings.baseNote - penalty);

      // Note 100 % automatique : plus de note forcée ni d'étape de validation.
      const prev = existingByStudent.get(st.id);

      return {
        id: prev?.id ?? null,
        studentId: st.id,
        studentNumber: st.studentNumber,
        firstName: st.firstName,
        lastName: st.lastName,
        gender: st.gender,
        baseNote: settings.baseNote,
        absenceHours,
        penalty,
        computedNote,
        manualNote: null,
        finalNote: computedNote,
        comment: null,
        isValidated: false,
        validatedAt: null,
        computedAt: prev?.computed_at ?? null,
        bySubject,
      };
    });

    return { rows, settings };
  }

  /**
   * Calcule *et enregistre* la conduite. `classId` omis ⇒ toutes les classes
   * (bouton « calculer pour toutes les classes » en fin de trimestre).
   *
   * Une ligne déjà validée n'est pas écrasée, sauf `force`. La note forcée par
   * l'admin (`manual_note`) est toujours conservée : seul le calcul système est
   * rafraîchi.
   */
  static async recalculate(params: {
    academicYearId: string;
    semesterId: string;
    classId?: string;
    force?: boolean;
  }): Promise<{ classes: number; updated: number; skipped: number }> {
    const { academicYearId, semesterId, classId, force = false } = params;
    const settings = await this.getSettings(academicYearId);

    const classes = classId
      ? [{ id: classId }]
      : await prisma.schoolClass.findMany({ select: { id: true }, orderBy: { name: 'asc' } });

    let updated = 0;
    let skipped = 0;
    let touchedClasses = 0;

    for (const klass of classes) {
      const { rows } = await this.computeClass({
        academicYearId,
        semesterId,
        classId: klass.id,
        settings,
      });
      if (rows.length === 0) continue;
      touchedClasses++;

      const now = new Date();
      for (const row of rows) {
        if (row.isValidated && !force) {
          skipped++;
          continue;
        }

        const finalNote = row.manualNote !== null ? row.manualNote : row.computedNote;
        await prisma.conduct_grades.upsert({
          where: {
            academic_year_id_semester_id_class_id_student_id: {
              academic_year_id: academicYearId,
              semester_id: semesterId,
              class_id: klass.id,
              student_id: row.studentId,
            },
          },
          update: {
            base_note: settings.baseNote,
            absence_hours: row.absenceHours,
            penalty: row.penalty,
            computed_note: row.computedNote,
            final_note: finalNote,
            computed_at: now,
          },
          create: {
            id: crypto.randomUUID(),
            academic_year_id: academicYearId,
            semester_id: semesterId,
            class_id: klass.id,
            student_id: row.studentId,
            base_note: settings.baseNote,
            absence_hours: row.absenceHours,
            penalty: row.penalty,
            computed_note: row.computedNote,
            manual_note: null,
            final_note: row.computedNote,
            computed_at: now,
          },
        });
        updated++;
      }
    }

    return { classes: touchedClasses, updated, skipped };
  }

  // --- Lecture --------------------------------------------------------------

  /**
   * Notes de conduite pour « Notes par matière », « Moyennes complètes » et les
   * bulletins. La conduite est désormais **toujours en direct** : on la recalcule
   * à chaque lecture à partir des séances d'appel et des corrections d'heures — il
   * n'y a plus d'étape de validation. Le paramètre `onlyValidated` est conservé
   * pour compatibilité mais ignoré.
   */
  static async getStored(params: {
    academicYearId: string;
    semesterId: string;
    classId?: string;
    studentId?: string;
    onlyValidated?: boolean;
  }) {
    const { academicYearId, semesterId, classId, studentId } = params;

    // Cas courant : classe connue ⇒ calcul en direct (heures d'appel + corrections).
    if (classId) {
      const { rows } = await this.computeClass({ academicYearId, semesterId, classId });
      const wanted = studentId ? rows.filter((r) => r.studentId === studentId) : rows;
      return wanted.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        classId,
        baseNote: r.baseNote,
        absenceHours: r.absenceHours,
        penalty: r.penalty,
        computedNote: r.computedNote,
        manualNote: null as number | null,
        finalNote: r.finalNote,
        comment: null as string | null,
        isValidated: true,
        validatedAt: null as Date | null,
      }));
    }

    // Repli (sans classe) : lecture des lignes déjà enregistrées, sans filtre de validation.
    const where: any = { academic_year_id: academicYearId, semester_id: semesterId };
    if (studentId) where.student_id = studentId;

    const rows = await prisma.conduct_grades.findMany({
      where,
      select: {
        id: true,
        student_id: true,
        class_id: true,
        absence_hours: true,
        penalty: true,
        base_note: true,
        computed_note: true,
        final_note: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      classId: r.class_id,
      baseNote: num(r.base_note),
      absenceHours: num(r.absence_hours),
      penalty: num(r.penalty),
      computedNote: num(r.computed_note),
      manualNote: null as number | null,
      // final_note historique : on retombe sur computed_note pour rester cohérent
      // avec le nouveau modèle (plus de note forcée).
      finalNote: num(r.computed_note),
      comment: null as string | null,
      isValidated: true,
      validatedAt: null as Date | null,
    }));
  }

  /**
   * Bilan d'assiduité par élève pour la carte « Assiduité » du bulletin.
   *
   * Les trois chiffres s'additionnent (total = justifiées + non justifiées), ce
   * qui n'était pas le cas auparavant :
   *   - **non justifiées** = les heures retenues par la conduite (celles qui
   *     coûtent des points) ;
   *   - **justifiées** = les absences excusées dès l'appel (`is_justified`) +
   *     les heures annulées par un justificatif validé par l'administration
   *     (différence entre les heures d'appel et les heures retenues) ;
   *   - **total** = la somme des deux.
   *
   * ⚠️ Le journal legacy `student_absences` ne porte aucune notion de
   * justification : ses heures sont donc toujours comptées comme non justifiées.
   */
  static async getAttendanceSummary(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
  }): Promise<Map<string, { justifiedHours: number; unjustifiedHours: number; totalHours: number }>> {
    const { academicYearId, semesterId, classId } = params;

    const settings = await this.getSettings(academicYearId);
    const semester = await prisma.semesters.findUnique({ where: { id: semesterId } });
    if (!semester) throw new Error('Semester not found');

    const { rows } = await this.computeClass({ academicYearId, semesterId, classId, settings });

    // Absences excusées dès l'appel : `computeClass` les ignore (elles ne pèsent
    // pas sur la note), il faut donc les recompter ici pour les afficher.
    const sessions = await prisma.attendance_sessions.findMany({
      where: {
        academic_year_id: academicYearId,
        class_id: classId,
        date: { gte: semester.start_date, lte: semester.end_date },
      },
      select: { id: true, start_time: true, end_time: true },
    });

    const justifiedRecords = sessions.length
      ? await prisma.attendance_records.findMany({
          where: {
            session_id: { in: sessions.map((s) => s.id) },
            status: 'ABSENT',
            is_justified: true,
          },
          select: { session_id: true, student_id: true },
        })
      : [];

    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const excusedAtCall = new Map<string, number>();
    for (const r of justifiedRecords) {
      const s = sessionById.get(r.session_id);
      if (!s) continue;
      const hours = sessionDurationHours(
        s.start_time,
        s.end_time,
        settings.defaultSessionHours,
        settings.periodMinutes,
      );
      excusedAtCall.set(r.student_id, round1((excusedAtCall.get(r.student_id) ?? 0) + hours));
    }

    const summary = new Map<string, { justifiedHours: number; unjustifiedHours: number; totalHours: number }>();
    for (const row of rows) {
      // Heures effacées par un justificatif accepté par l'administration.
      const excusedByAdmin = row.bySubject.reduce(
        (acc, s) => acc + Math.max(0, round1(s.sessionHours + s.legacyHours) - s.hours),
        0,
      );
      const justifiedHours = round1((excusedAtCall.get(row.studentId) ?? 0) + excusedByAdmin);
      const unjustifiedHours = row.absenceHours;
      summary.set(row.studentId, {
        justifiedHours,
        unjustifiedHours,
        totalHours: round1(justifiedHours + unjustifiedHours),
      });
    }

    return summary;
  }

  // --- Corrections admin ----------------------------------------------------

  /** Force (ou libère, si `manualNote` = null) la note de conduite d'un élève. */
  static async setManualNote(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    studentId: string;
    manualNote: number | null;
    comment?: string | null;
  }) {
    const { academicYearId, semesterId, classId, studentId, manualNote, comment } = params;

    if (manualNote !== null && (manualNote < 0 || manualNote > 20)) {
      throw new Error('La note doit être comprise entre 0 et 20');
    }

    // On s'assure que la ligne existe et que le calcul système est à jour.
    const settings = await this.getSettings(academicYearId);
    const { rows } = await this.computeClass({ academicYearId, semesterId, classId, settings });
    const row = rows.find((r) => r.studentId === studentId);
    if (!row) throw new Error('Student not found in this class');

    const finalNote = manualNote !== null ? manualNote : row.computedNote;
    const key = {
      academic_year_id: academicYearId,
      semester_id: semesterId,
      class_id: classId,
      student_id: studentId,
    };

    const saved = await prisma.conduct_grades.upsert({
      where: { academic_year_id_semester_id_class_id_student_id: key },
      update: {
        base_note: settings.baseNote,
        absence_hours: row.absenceHours,
        penalty: row.penalty,
        computed_note: row.computedNote,
        manual_note: manualNote,
        final_note: finalNote,
        ...(comment !== undefined ? { comment } : {}),
        computed_at: new Date(),
      },
      create: {
        id: crypto.randomUUID(),
        ...key,
        base_note: settings.baseNote,
        absence_hours: row.absenceHours,
        penalty: row.penalty,
        computed_note: row.computedNote,
        manual_note: manualNote,
        final_note: finalNote,
        comment: comment ?? null,
        computed_at: new Date(),
      },
    });

    return saved;
  }

  /**
   * Corrige les heures d'absence retenues pour une matière (justification), avec
   * un justificatif (PDF/image) optionnel.
   *   - `hours` = null ⇒ suppression de la correction (retour au calcul système),
   *     le justificatif éventuel est supprimé du disque.
   *   - `justificatifUrl`/`justificatifFilename` fournis ⇒ nouveau fichier (l'ancien
   *     est supprimé). `removeJustificatif` ⇒ retire le fichier sans toucher aux heures.
   *   - fichier non fourni ⇒ le justificatif existant est conservé.
   */
  static async setAbsenceOverride(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    studentId: string;
    subjectId: string;
    hours: number | null;
    reason?: string | null;
    justificatifUrl?: string | null;
    justificatifFilename?: string | null;
    removeJustificatif?: boolean;
  }) {
    const {
      academicYearId,
      semesterId,
      classId,
      studentId,
      subjectId,
      hours,
      reason,
      justificatifUrl,
      justificatifFilename,
      removeJustificatif,
    } = params;

    if (hours !== null && (hours < 0 || hours > 999)) {
      throw new Error("Le nombre d'heures est invalide");
    }

    const key = {
      academic_year_id: academicYearId,
      semester_id: semesterId,
      student_id: studentId,
      subject_id: subjectId,
    };

    // Justificatif déjà attaché (pour nettoyage disque lors d'un remplacement/reset).
    const existing = await prisma.conduct_absence_overrides.findUnique({
      where: { academic_year_id_semester_id_student_id_subject_id: key },
      select: { justificatif_url: true },
    });
    const oldFilename = existing?.justificatif_url ? existing.justificatif_url.split('/').pop() : null;

    const removeOldFile = async () => {
      if (!oldFilename) return;
      try {
        await deleteFile(getFilePath(oldFilename, 'justificatif'));
      } catch (e) {
        console.error('Conduct: suppression du justificatif échouée', e);
      }
    };

    if (hours === null) {
      // Reset complet : on efface la correction et son justificatif.
      await prisma.conduct_absence_overrides.deleteMany({ where: key });
      await removeOldFile();
    } else {
      // Champs justificatif à écrire : nouveau fichier > retrait explicite > inchangé.
      const justFields =
        justificatifUrl !== undefined
          ? { justificatif_url: justificatifUrl, justificatif_filename: justificatifFilename ?? null }
          : removeJustificatif
            ? { justificatif_url: null, justificatif_filename: null }
            : {};

      await prisma.conduct_absence_overrides.upsert({
        where: { academic_year_id_semester_id_student_id_subject_id: key },
        update: { hours, reason: reason ?? null, ...justFields },
        create: {
          id: crypto.randomUUID(),
          ...key,
          class_id: classId,
          hours,
          reason: reason ?? null,
          justificatif_url: justificatifUrl ?? null,
          justificatif_filename: justificatifFilename ?? null,
        },
      });

      // L'ancien fichier n'est plus référencé : on le supprime du disque.
      if ((justificatifUrl !== undefined || removeJustificatif) && oldFilename) {
        await removeOldFile();
      }
    }

    // Les heures ont changé ⇒ on rafraîchit et on persiste le calcul de la classe.
    await this.recalculate({ academicYearId, semesterId, classId, force: true });

    return this.computeClass({ academicYearId, semesterId, classId });
  }

  // --- Validation -----------------------------------------------------------

  /** Valide (ou dévalide) la conduite d'une classe pour le trimestre. */
  static async setValidation(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    validated: boolean;
    userId: string;
  }): Promise<{ count: number }> {
    const { academicYearId, semesterId, classId, validated, userId } = params;

    // La validation porte sur des notes calculées : on s'assure qu'elles existent.
    if (validated) {
      await this.recalculate({ academicYearId, semesterId, classId });
    }

    const result = await prisma.conduct_grades.updateMany({
      where: { academic_year_id: academicYearId, semester_id: semesterId, class_id: classId },
      data: validated
        ? { is_validated: true, validated_at: new Date(), validated_by: userId }
        : { is_validated: false, validated_at: null, validated_by: null },
    });

    return { count: result.count };
  }
}
