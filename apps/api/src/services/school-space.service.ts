import { prisma } from '@school/database';
import { getReleasesBySemester } from './bulletin-release.service';

/**
 * Lecture scolaire d'un élève — socle commun aux espaces Parent et Élève.
 *
 * Les deux espaces montrent exactement les mêmes données (emploi du temps,
 * appels, notes, bulletins) ; seule diffère la façon d'établir *quel* élève on a
 * le droit de lire : filiation `student_parents` côté parent, `students.user_id`
 * côté élève. Ce service porte donc la lecture, et les routeurs portent le
 * contrôle d'accès — jamais l'inverse.
 */

export interface SchoolChild {
  id: string;
  classId: string | null;
  className: string | null;
}

/** Note ramenée sur 20 + coefficient de pondération (barème /10 = demi-poids). */
function normalize(note: number, maxNote: number): { value: number; weight: number } {
  return maxNote === 10 ? { value: (note / 10) * 20, weight: 0.5 } : { value: note, weight: 1 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Coefficients des matières de la classe (défaut 1 si la matière n'y figure pas). */
async function coefficientsOf(classId: string | null): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!classId) return map;
  const rows = await prisma.class_subjects.findMany({
    where: { class_id: classId },
    select: { coefficient: true, subjects: { select: { id: true } } },
  });
  rows.forEach((r) => map.set(r.subjects.id, r.coefficient || 1));
  return map;
}

// ---------------------------------------------------------------------------
// Emploi du temps de la classe de l'élève
// ---------------------------------------------------------------------------
export async function getTimetable(child: SchoolChild, academicYearId?: string) {
  if (!child.classId) return { class: null, entries: [] };

  const entries = await prisma.class_timetables.findMany({
    where: {
      class_id: child.classId,
      ...(academicYearId ? { academic_year_id: academicYearId } : {}),
    },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, first_name: true, last_name: true } },
      classroom: { select: { id: true, name: true } },
    },
    orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
  });

  return { class: { id: child.classId, name: child.className }, entries };
}

// ---------------------------------------------------------------------------
// Appels par séance (attendance_sessions / attendance_records)
// ---------------------------------------------------------------------------
export async function getAttendance(
  child: SchoolChild,
  filters: { academicYearId?: string; subjectId?: string; semesterId?: string },
) {
  const { academicYearId, subjectId, semesterId } = filters;

  // Le trimestre borne la période : les séances n'ont pas de semester_id, elles
  // sont datées — on filtre donc sur l'intervalle du trimestre.
  let dateRange: { gte: Date; lte: Date } | undefined;
  if (semesterId) {
    const semester = await prisma.semesters.findUnique({
      where: { id: semesterId },
      select: { start_date: true, end_date: true },
    });
    if (semester) dateRange = { gte: semester.start_date, lte: semester.end_date };
  }

  const sessionWhere = {
    ...(academicYearId ? { academic_year_id: academicYearId } : {}),
    ...(subjectId ? { subject_id: subjectId } : {}),
    ...(dateRange ? { date: dateRange } : {}),
  };

  const [records, allYearRecords] = await Promise.all([
    prisma.attendance_records.findMany({
      where: { student_id: child.id, session: sessionWhere },
      include: {
        session: {
          select: {
            id: true,
            date: true,
            start_time: true,
            end_time: true,
            session_number: true,
            notes: true,
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { id: true, first_name: true, last_name: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
    }),
    // Sans filtre matière : alimente la liste déroulante des matières appelées.
    prisma.attendance_records.findMany({
      where: {
        student_id: child.id,
        session: academicYearId ? { academic_year_id: academicYearId } : {},
      },
      select: { session: { select: { subject: { select: { id: true, name: true } } } } },
    }),
  ]);

  const sessions = records
    .map((r) => ({
      id: r.id,
      status: r.status,
      excuse: r.excuse,
      isJustified: r.is_justified,
      sessionId: r.session.id,
      date: r.session.date,
      startTime: r.session.start_time,
      endTime: r.session.end_time,
      sessionNumber: r.session.session_number,
      notes: r.session.notes,
      subject: r.session.subject,
      teacher: r.session.teacher,
      class: r.session.class,
    }))
    .sort((a, b) => {
      const d = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (d !== 0) return d;
      return String(b.startTime ?? '').localeCompare(String(a.startTime ?? ''));
    });

  const count = (status: string) => sessions.filter((s) => s.status === status).length;
  const total = sessions.length;
  const present = count('PRESENT');
  const late = count('LATE');

  const subjectsMap = new Map<string, { id: string; name: string }>();
  allYearRecords.forEach((r) => {
    const s = r.session.subject;
    if (s) subjectsMap.set(s.id, { id: s.id, name: s.name });
  });

  return {
    sessions,
    subjects: Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    stats: {
      total,
      present,
      late,
      absent: count('ABSENT'),
      excused: count('EXCUSED'),
      // Le retard reste une présence effective en cours ; l'absence excusée non.
      presenceRate: total > 0 ? Math.round(((present + late) / total) * 100) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Notes, regroupées par matière, avec leur type d'évaluation
// ---------------------------------------------------------------------------
export async function getGrades(
  child: SchoolChild,
  filters: { academicYearId: string; semesterId?: string; subjectId?: string },
) {
  const { academicYearId, semesterId, subjectId } = filters;

  const [grades, yearGrades, coefficientOf] = await Promise.all([
    prisma.grades.findMany({
      where: {
        student_id: child.id,
        academic_year_id: academicYearId,
        ...(semesterId ? { semester_id: semesterId } : {}),
        ...(subjectId ? { subject_id: subjectId } : {}),
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        note: true,
        max_note: true,
        created_at: true,
        subject_id: true,
        subject: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true } },
        teacher: { select: { id: true, first_name: true, last_name: true } },
        evaluationType: {
          select: { id: true, name: true, number: true, coefficient: true, max_note: true },
        },
      },
    }),
    prisma.grades.findMany({
      where: { student_id: child.id, academic_year_id: academicYearId },
      select: { subject: { select: { id: true, name: true } } },
    }),
    coefficientsOf(child.classId),
  ]);

  // Regroupement par matière : c'est l'unité de lecture d'un élève comme d'un
  // parent, pas la date. La chronologie reste dans l'ordre des notes du groupe.
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      code?: string | null;
      coefficient: number;
      sum: number;
      weight: number;
      grades: any[];
    }
  >();

  grades.forEach((g) => {
    const { value, weight } = normalize(Number(g.note), g.max_note);
    const group = groups.get(g.subject_id) ?? {
      id: g.subject_id,
      name: g.subject?.name ?? 'Matière',
      code: g.subject?.code,
      coefficient: coefficientOf.get(g.subject_id) ?? 1,
      sum: 0,
      weight: 0,
      grades: [] as any[],
    };
    group.sum += value * weight;
    group.weight += weight;
    group.grades.push({
      id: g.id,
      note: Number(g.note),
      maxNote: g.max_note,
      date: g.created_at,
      semester: g.semester,
      teacher: g.teacher,
      evaluationType: g.evaluationType
        ? {
            id: g.evaluationType.id,
            name: g.evaluationType.name,
            number: g.evaluationType.number,
            coefficient: g.evaluationType.coefficient,
            maxNote: g.evaluationType.max_note,
          }
        : null,
    });
    groups.set(g.subject_id, group);
  });

  const bySubject = Array.from(groups.values())
    .map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      coefficient: g.coefficient,
      gradesCount: g.grades.length,
      average: g.weight > 0 ? round2(g.sum / g.weight) : null,
      grades: g.grades,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let weighted = 0;
  let coefficients = 0;
  bySubject.forEach((s) => {
    if (s.average !== null) {
      weighted += s.average * s.coefficient;
      coefficients += s.coefficient;
    }
  });

  const subjectsMap = new Map<string, { id: string; name: string }>();
  yearGrades.forEach((g) => {
    if (g.subject) subjectsMap.set(g.subject.id, { id: g.subject.id, name: g.subject.name });
  });

  return {
    class: child.classId ? { id: child.classId, name: child.className } : null,
    subjects: Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    bySubject,
    stats: {
      gradesCount: grades.length,
      subjectsCount: bySubject.length,
      generalAverage: coefficients > 0 ? round2(weighted / coefficients) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Bulletins — un par trimestre de l'année, visible une fois généré par l'admin
//
// La saisie des notes ne rend rien visible : tant que l'administration n'a pas
// généré les bulletins de la classe pour le trimestre, le trimestre est renvoyé
// « en attente » et *sans* ses moyennes — sinon le bulletin serait lisible en
// ligne avant d'être publié, ce qui reviendrait au même.
// ---------------------------------------------------------------------------
export async function getBulletins(child: SchoolChild, academicYearId: string) {
  const [semesters, grades, coefficientOf, releases] = await Promise.all([
    prisma.semesters.findMany({
      where: { academic_year_id: academicYearId },
      orderBy: { start_date: 'asc' },
      select: { id: true, name: true, start_date: true, end_date: true },
    }),
    prisma.grades.findMany({
      where: { student_id: child.id, academic_year_id: academicYearId },
      select: {
        semester_id: true,
        subject_id: true,
        note: true,
        max_note: true,
        subject: { select: { id: true, name: true } },
      },
    }),
    coefficientsOf(child.classId),
    child.classId
      ? getReleasesBySemester(child.classId, academicYearId)
      : Promise.resolve(new Map()),
  ]);

  const bulletins = semesters.map((semester) => {
    const release = releases.get(semester.id) ?? null;

    if (!release) {
      return {
        semester: {
          id: semester.id,
          name: semester.name,
          startDate: semester.start_date,
          endDate: semester.end_date,
        },
        available: false,
        publishedAt: null,
        gradesCount: 0,
        generalAverage: null,
        subjects: [],
      };
    }

    const semesterGrades = grades.filter((g) => g.semester_id === semester.id);

    // Moyenne par matière : notes ramenées sur 20, barème /10 à demi-poids
    // (formule identique à celle du bulletin PDF et de « Moyennes complètes »).
    const bySubject = new Map<string, { name: string; sum: number; weight: number; count: number }>();
    semesterGrades.forEach((g) => {
      const { value, weight } = normalize(Number(g.note), g.max_note);
      const entry = bySubject.get(g.subject_id) ?? {
        name: g.subject?.name ?? 'Matière',
        sum: 0,
        weight: 0,
        count: 0,
      };
      entry.sum += value * weight;
      entry.weight += weight;
      entry.count += 1;
      bySubject.set(g.subject_id, entry);
    });

    const subjects = Array.from(bySubject.entries()).map(([id, e]) => ({
      id,
      name: e.name,
      coefficient: coefficientOf.get(id) ?? 1,
      gradesCount: e.count,
      average: e.weight > 0 ? round2(e.sum / e.weight) : null,
    }));

    let weighted = 0;
    let coefficients = 0;
    subjects.forEach((s) => {
      if (s.average !== null) {
        weighted += s.average * s.coefficient;
        coefficients += s.coefficient;
      }
    });

    return {
      semester: {
        id: semester.id,
        name: semester.name,
        startDate: semester.start_date,
        endDate: semester.end_date,
      },
      available: true,
      publishedAt: release.generatedAt,
      gradesCount: semesterGrades.length,
      generalAverage: coefficients > 0 ? round2(weighted / coefficients) : null,
      subjects: subjects.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  return {
    class: child.classId ? { id: child.classId, name: child.className } : null,
    bulletins,
  };
}

