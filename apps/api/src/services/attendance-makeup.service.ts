import { prisma } from '@school/database';
import { z } from 'zod';
import crypto from 'crypto';
import { AttendancePolicyError } from './attendance-session.service';
import {
  addDays,
  addMinutesToTime,
  dayOfWeekFor,
  fmtDate,
  GRACE_MINUTES,
  occurrenceDates,
  schoolNowTime,
  schoolToday,
  timeRangesOverlap,
} from './attendance-policy';

/**
 * Réaménagement d'une occurrence de l'emploi du temps (§9.6).
 *
 * Une même table porte les deux gestes de l'enseignant sur UNE occurrence,
 * repérée par (créneau, date d'origine) :
 *
 *  - `SCHEDULED` — **rattrapage** : l'occurrence est *passée* et n'a pas eu
 *    lieu (aucun appel). Elle est reprogrammée à une date ultérieure.
 *  - `MOVED` — **déplacement** : l'occurrence est *à venir* et l'enseignant la
 *    reporte à une autre heure ou un autre jour, avant qu'elle n'ait lieu.
 *  - `DISMISSED` — écartée (« pas de cours ce jour » : férié, vacances).
 *
 * Rattrapage et déplacement produisent la même chose — une occurrence qui se
 * tient ailleurs que dans la grille hebdomadaire — et suivent donc le même
 * chemin : même contrôle de conflit, même injection dans l'agenda d'appel. Seule
 * la fenêtre autorisée diffère (passé vs futur), d'où deux statuts distincts :
 * le libellé rendu à l'enseignant n'est pas le même, et « rattrapé le » pour un
 * cours jamais manqué serait faux.
 *
 * ⚠️ Le système n'a pas de calendrier de fermeture (fériés / vacances) : un jour
 * férié est donc indiscernable d'un cours réellement sauté. C'est pourquoi
 * l'enseignant peut **écarter** une occurrence (`DISMISSED`) — la décision est
 * mémorisée, sinon le férié reviendrait indéfiniment dans la liste.
 */

export const MAKEUP_SCHEDULED = 'SCHEDULED';
export const MAKEUP_MOVED = 'MOVED';
export const MAKEUP_DISMISSED = 'DISMISSED';

/**
 * Statuts qui *replacent* l'occurrence à une autre date : ceux qui comptent pour
 * l'agenda d'appel et pour la recherche de conflits. `DISMISSED` en est exclu —
 * une occurrence écartée n'occupe plus rien.
 */
export const MAKEUP_ACTIVE_STATUSES = [MAKEUP_SCHEDULED, MAKEUP_MOVED];

/** Horizon par défaut (en semaines) des occurrences à venir proposées. */
const UPCOMING_WEEKS_DEFAULT = 4;
const UPCOMING_WEEKS_MAX = 12;

const scheduleSchema = z.object({
  timetableId: z.string().min(1),
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'originalDate attendue au format YYYY-MM-DD'),
  makeupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'makeupDate attendue au format YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime attendue au format HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime attendue au format HH:MM'),
  reason: z.string().optional().nullable(),
});

/** Déplacement : mêmes champs, la date cible se nomme `newDate` côté client. */
const moveSchema = z.object({
  timetableId: z.string().min(1),
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'originalDate attendue au format YYYY-MM-DD'),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate attendue au format YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime attendue au format HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime attendue au format HH:MM'),
  reason: z.string().optional().nullable(),
});

const dismissSchema = z.object({
  timetableId: z.string().min(1),
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'originalDate attendue au format YYYY-MM-DD'),
  reason: z.string().optional().nullable(),
});

export class AttendanceMakeupService {
  /** Charge un créneau de l'emploi du temps, sans contrôle de propriété. */
  static async loadSlot(timetableId: string) {
    const slot = await prisma.class_timetables.findUnique({
      where: { id: timetableId },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        classroom: { select: { id: true, name: true } },
      },
    });
    if (!slot) throw new AttendancePolicyError("Ce créneau n'existe pas dans l'emploi du temps.", 'INVALID');
    return slot;
  }

  /** Charge un créneau et vérifie qu'il appartient bien à l'enseignant. */
  private static async ownedSlot(timetableId: string, teacherId: string) {
    const slot = await this.loadSlot(timetableId);
    if (slot.teacher_id !== teacherId) {
      throw new AttendancePolicyError("Ce créneau n'est pas assigné à cet enseignant.", 'FORBIDDEN');
    }
    return slot;
  }

  /** Bornes de la période analysée (un trimestre, ou toute l'année). */
  private static async periodBounds(academicYearId: string, semesterId?: string) {
    const semesters = await prisma.semesters.findMany({
      where: semesterId ? { id: semesterId } : { academic_year_id: academicYearId },
      orderBy: { start_date: 'asc' },
    });
    if (!semesters.length) return null;
    return {
      from: fmtDate(semesters[0].start_date),
      to: fmtDate(semesters[semesters.length - 1].end_date),
    };
  }

  /**
   * Occurrences passées sans appel ni décision, pour un enseignant.
   *
   * Borne haute = hier : un cours du jour n'est pas « manqué », il est encore
   * appelable (cf. politique « appel le jour du cours »).
   */
  static async getCandidates(params: {
    teacherId: string;
    academicYearId: string;
    semesterId?: string;
    classId?: string;
    subjectId?: string;
  }) {
    const { teacherId, academicYearId, semesterId, classId, subjectId } = params;

    const bounds = await this.periodBounds(academicYearId, semesterId);
    if (!bounds) return { candidates: [], period: null };

    const today = schoolToday();
    const upper = bounds.to < addDays(today, -1) ? bounds.to : addDays(today, -1);
    const period = { from: bounds.from, to: upper, notStarted: bounds.from > upper };
    if (period.notStarted) return { candidates: [], period };

    const slots = await prisma.class_timetables.findMany({
      where: {
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        ...(classId ? { class_id: classId } : {}),
        ...(subjectId ? { subject_id: subjectId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        classroom: { select: { id: true, name: true } },
      },
      orderBy: { start_time: 'asc' },
    });
    if (!slots.length) return { candidates: [], period };

    const slotIds = slots.map((s) => s.id);
    const [sessions, decisions] = await Promise.all([
      prisma.attendance_sessions.findMany({
        where: {
          teacher_id: teacherId,
          academic_year_id: academicYearId,
          date: { gte: new Date(`${period.from}T00:00:00Z`), lte: new Date(`${upper}T00:00:00Z`) },
        },
        select: { class_id: true, subject_id: true, date: true, start_time: true, timetable_id: true },
      }),
      prisma.attendance_makeup_sessions.findMany({ where: { timetable_id: { in: slotIds } } }),
    ]);

    // Appel enregistré : on rattache par créneau, avec repli sur
    // (classe, matière, horaire) pour les séances antérieures à l'obligation du
    // créneau — même logique que l'agenda.
    const doneByTimetable = new Set(
      sessions.filter((s) => s.timetable_id).map((s) => `${s.timetable_id}|${fmtDate(s.date)}`),
    );
    const doneByTriplet = new Set(
      sessions.map((s) => `${s.class_id}|${s.subject_id}|${s.start_time ?? ''}|${fmtDate(s.date)}`),
    );
    const decided = new Set(decisions.map((d) => `${d.timetable_id}|${fmtDate(d.original_date)}`));

    const candidates: any[] = [];
    for (const slot of slots) {
      for (const date of occurrenceDates(slot.day_of_week, period.from, upper)) {
        if (doneByTimetable.has(`${slot.id}|${date}`)) continue;
        if (doneByTriplet.has(`${slot.class_id}|${slot.subject_id}|${slot.start_time}|${date}`)) continue;
        if (decided.has(`${slot.id}|${date}`)) continue;
        candidates.push({
          timetableId: slot.id,
          originalDate: date,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          class: slot.class,
          subject: slot.subject,
          classroom: slot.classroom,
        });
      }
    }
    candidates.sort((a, b) => a.originalDate.localeCompare(b.originalDate) || a.startTime.localeCompare(b.startTime));

    return { candidates, period };
  }

  /**
   * Occurrences **à venir** d'un enseignant : ce qu'il peut encore déplacer.
   *
   * Borne basse = aujourd'hui (un cours du jour reste déplaçable tant que
   * l'appel n'a pas été fait), borne haute = l'horizon demandé, plafonné par la
   * fin de la période. Une occurrence déjà décidée (déplacée, rattrapée,
   * écartée) ou déjà appelée n'est plus proposée.
   */
  static async getUpcoming(params: {
    teacherId: string;
    academicYearId: string;
    semesterId?: string;
    classId?: string;
    subjectId?: string;
    weeks?: number;
  }) {
    const { teacherId, academicYearId, semesterId, classId, subjectId } = params;
    const weeks = Math.min(Math.max(params.weeks ?? UPCOMING_WEEKS_DEFAULT, 1), UPCOMING_WEEKS_MAX);

    const bounds = await this.periodBounds(academicYearId, semesterId);
    if (!bounds) return { occurrences: [], period: null };

    const today = schoolToday();
    // Une période à venir se déroule depuis son début, pas depuis aujourd'hui :
    // sinon un trimestre qui commence dans deux mois n'afficherait rien.
    const from = bounds.from > today ? bounds.from : today;
    const horizon = addDays(from, weeks * 7);
    const to = bounds.to < horizon ? bounds.to : horizon;
    const period = { from, to, ended: from > to };
    if (period.ended) return { occurrences: [], period };

    const slots = await prisma.class_timetables.findMany({
      where: {
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        ...(classId ? { class_id: classId } : {}),
        ...(subjectId ? { subject_id: subjectId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        classroom: { select: { id: true, name: true } },
      },
      orderBy: { start_time: 'asc' },
    });
    if (!slots.length) return { occurrences: [], period };

    const slotIds = slots.map((s) => s.id);
    const [sessions, decisions, moveRequests] = await Promise.all([
      prisma.attendance_sessions.findMany({
        where: {
          teacher_id: teacherId,
          academic_year_id: academicYearId,
          date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
        },
        select: { class_id: true, subject_id: true, date: true, start_time: true, timetable_id: true },
      }),
      prisma.attendance_makeup_sessions.findMany({ where: { timetable_id: { in: slotIds } } }),
      prisma.attendance_move_requests.findMany({
        where: { timetable_id: { in: slotIds } },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const doneByTimetable = new Set(
      sessions.filter((s) => s.timetable_id).map((s) => `${s.timetable_id}|${fmtDate(s.date)}`),
    );
    const doneByTriplet = new Set(
      sessions.map((s) => `${s.class_id}|${s.subject_id}|${s.start_time ?? ''}|${fmtDate(s.date)}`),
    );
    const decided = new Set(decisions.map((d) => `${d.timetable_id}|${fmtDate(d.original_date)}`));
    // Demande la plus récente par occurrence — `orderBy created_at desc` fait
    // gagner la première rencontrée. Une demande APPROVED n'apparaît pas ici :
    // l'occurrence est alors `decided` (attendance_makeup_sessions) et déjà
    // exclue plus haut, avant même de regarder les demandes.
    const requestByOccurrence = new Map<string, (typeof moveRequests)[number]>();
    for (const r of moveRequests) {
      const key = `${r.timetable_id}|${fmtDate(r.original_date)}`;
      if (!requestByOccurrence.has(key)) requestByOccurrence.set(key, r);
    }

    const occurrences: any[] = [];
    for (const slot of slots) {
      for (const date of occurrenceDates(slot.day_of_week, from, to)) {
        if (decided.has(`${slot.id}|${date}`)) continue;
        if (doneByTimetable.has(`${slot.id}|${date}`)) continue;
        if (doneByTriplet.has(`${slot.class_id}|${slot.subject_id}|${slot.start_time}|${date}`)) continue;
        const req = requestByOccurrence.get(`${slot.id}|${date}`);
        occurrences.push({
          timetableId: slot.id,
          originalDate: date,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          isToday: date === today,
          moveRequest:
            req && req.status !== 'APPROVED'
              ? {
                  id: req.id,
                  status: req.status,
                  requestedDate: fmtDate(req.requested_date),
                  requestedStartTime: req.requested_start_time,
                  requestedEndTime: req.requested_end_time,
                  adminNote: req.admin_note,
                }
              : null,
          class: slot.class,
          subject: slot.subject,
          classroom: slot.classroom,
        });
      }
    }
    occurrences.sort((a, b) => a.originalDate.localeCompare(b.originalDate) || a.startTime.localeCompare(b.startTime));

    return { occurrences, period };
  }

  /**
   * Séances « non tenues », tous enseignants confondus (page admin §9.6ter).
   *
   * Une séance est non tenue quand :
   *  - elle est **passée** (jour révolu) sans appel ni décision (rattrapage,
   *    déplacement, écart) — même base que {@link getCandidates}, sans filtre
   *    enseignant ;
   *  - ou elle est **du jour même**, mais le délai de grâce de
   *    {@link GRACE_MINUTES} minutes après le début du cours est dépassé sans
   *    appel — c'est le pendant, côté admin, de `GRACE_EXPIRED` dans
   *    `attendance-policy.ts`.
   *
   * Les occurrences déjà rattrapées/déplacées (`attendance_makeup_sessions`,
   * statut actif) sont incluses sous leur propre date d'arrivée si elles
   * tombent, elles aussi, dans un de ces deux cas — un rattrapage manqué ne
   * doit pas disparaître du radar de l'administration.
   */
  static async getUncalledSessions(params: {
    academicYearId: string;
    semesterId?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
  }) {
    const { academicYearId, semesterId, classId, subjectId, teacherId } = params;

    const bounds = await this.periodBounds(academicYearId, semesterId);
    if (!bounds) return { sessions: [], period: null };

    const today = schoolToday();
    const nowTime = schoolNowTime();
    const upper = bounds.to < today ? bounds.to : today;
    const period = { from: bounds.from, to: upper, notStarted: bounds.from > upper };
    if (period.notStarted) return { sessions: [], period };

    const slots = await prisma.class_timetables.findMany({
      where: {
        academic_year_id: academicYearId,
        ...(classId ? { class_id: classId } : {}),
        ...(subjectId ? { subject_id: subjectId } : {}),
        ...(teacherId ? { teacher_id: teacherId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        classroom: { select: { id: true, name: true } },
        teacher: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: { start_time: 'asc' },
    });
    if (!slots.length) return { sessions: [], period };

    const slotIds = slots.map((s) => s.id);
    const [sessions, decisions] = await Promise.all([
      prisma.attendance_sessions.findMany({
        where: {
          academic_year_id: academicYearId,
          ...(teacherId ? { teacher_id: teacherId } : {}),
          date: { gte: new Date(`${period.from}T00:00:00Z`), lte: new Date(`${upper}T00:00:00Z`) },
        },
        select: { class_id: true, subject_id: true, teacher_id: true, date: true, start_time: true, timetable_id: true },
      }),
      prisma.attendance_makeup_sessions.findMany({ where: { timetable_id: { in: slotIds } } }),
    ]);

    const doneByTimetable = new Set(
      sessions.filter((s) => s.timetable_id).map((s) => `${s.timetable_id}|${fmtDate(s.date)}`),
    );
    const doneByQuad = new Set(
      sessions.map((s) => `${s.class_id}|${s.subject_id}|${s.teacher_id}|${s.start_time ?? ''}|${fmtDate(s.date)}`),
    );
    const decided = new Set(decisions.map((d) => `${d.timetable_id}|${fmtDate(d.original_date)}`));

    // Un jour du jour même n'est « non tenu » que si le délai de grâce est dépassé.
    const graceExpiredToday = (startTime: string) => nowTime >= addMinutesToTime(startTime, GRACE_MINUTES);

    const out: any[] = [];
    for (const slot of slots) {
      for (const date of occurrenceDates(slot.day_of_week, period.from, upper)) {
        if (date === today && !graceExpiredToday(slot.start_time)) continue;
        if (doneByTimetable.has(`${slot.id}|${date}`)) continue;
        if (doneByQuad.has(`${slot.class_id}|${slot.subject_id}|${slot.teacher_id}|${slot.start_time}|${date}`)) continue;
        if (decided.has(`${slot.id}|${date}`)) continue;
        out.push({
          timetableId: slot.id,
          originalDate: date,
          makeupOf: null as string | null,
          occurrenceKind: null as 'MAKEUP' | 'MOVE' | null,
          dayOfWeek: slot.day_of_week,
          startTime: slot.start_time,
          endTime: slot.end_time,
          graceEndsAt: addMinutesToTime(slot.start_time, GRACE_MINUTES),
          isToday: date === today,
          class: slot.class,
          subject: slot.subject,
          classroom: slot.classroom,
          teacher: slot.teacher,
          academicYearId,
        });
      }
    }

    // Rattrapages / déplacements dont l'échéance elle-même est non tenue.
    const slotById = new Map(slots.map((s) => [s.id, s]));
    for (const m of decisions) {
      if (!MAKEUP_ACTIVE_STATUSES.includes(m.status) || !m.makeup_date) continue;
      const date = fmtDate(m.makeup_date);
      if (date < period.from || date > upper) continue;
      const slot = slotById.get(m.timetable_id);
      if (!slot) continue;
      const startTime = m.start_time ?? slot.start_time;
      if (date === today && !graceExpiredToday(startTime)) continue;
      if (doneByTimetable.has(`${slot.id}|${date}`)) continue;
      if (doneByQuad.has(`${slot.class_id}|${slot.subject_id}|${slot.teacher_id}|${startTime}|${date}`)) continue;
      out.push({
        timetableId: slot.id,
        originalDate: date,
        makeupOf: fmtDate(m.original_date),
        occurrenceKind: (m.status === MAKEUP_MOVED ? 'MOVE' : 'MAKEUP') as 'MAKEUP' | 'MOVE',
        dayOfWeek: slot.day_of_week,
        startTime,
        endTime: m.end_time ?? slot.end_time,
        graceEndsAt: addMinutesToTime(startTime, GRACE_MINUTES),
        isToday: date === today,
        class: slot.class,
        subject: slot.subject,
        classroom: slot.classroom,
        teacher: slot.teacher,
        academicYearId,
      });
    }

    out.sort((a, b) => a.originalDate.localeCompare(b.originalDate) || a.startTime.localeCompare(b.startTime));

    return { sessions: out, period };
  }

  /** Rattrapages déjà programmés (et occurrences écartées) d'un enseignant. */
  static async getDecisions(params: {
    teacherId: string;
    academicYearId: string;
    semesterId?: string;
    classId?: string;
    subjectId?: string;
    status?: string;
  }) {
    const { teacherId, academicYearId, semesterId, classId, subjectId, status } = params;
    const bounds = await this.periodBounds(academicYearId, semesterId);

    const rows = await prisma.attendance_makeup_sessions.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(bounds
          ? {
              original_date: {
                gte: new Date(`${bounds.from}T00:00:00Z`),
                lte: new Date(`${bounds.to}T00:00:00Z`),
              },
            }
          : {}),
        timetable: {
          teacher_id: teacherId,
          academic_year_id: academicYearId,
          ...(classId ? { class_id: classId } : {}),
          ...(subjectId ? { subject_id: subjectId } : {}),
        },
      },
      include: {
        timetable: {
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true, code: true } },
            classroom: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ makeup_date: 'asc' }, { original_date: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      timetableId: r.timetable_id,
      originalDate: fmtDate(r.original_date),
      makeupDate: r.makeup_date ? fmtDate(r.makeup_date) : null,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
      reason: r.reason,
      class: r.timetable.class,
      subject: r.timetable.subject,
      classroom: r.timetable.classroom,
      originalStartTime: r.timetable.start_time,
      originalEndTime: r.timetable.end_time,
    }));
  }

  /**
   * Conflits d'une date/heure cible : l'enseignant ou la classe est-il déjà
   * occupé à ce moment-là ? On regarde l'emploi du temps régulier **et** les
   * occurrences déjà replacées (rattrapages, déplacements).
   *
   * Deux occurrences ne comptent pas :
   *  - celle qu'on est en train de replacer (sinon un cours serait en conflit
   *    avec lui-même dès qu'on ne change que l'horaire du même jour) ;
   *  - une occurrence régulière déjà déplacée ou écartée ce jour-là : sa place
   *    dans la grille est libérée, c'est précisément l'intérêt du déplacement.
   */
  static async findConflicts(params: {
    academicYearId: string;
    teacherId: string;
    classId: string;
    date: string;
    startTime: string;
    endTime: string;
    excludeTimetableId?: string;
    excludeOriginalDate?: string;
  }) {
    const { academicYearId, teacherId, classId, date, startTime, endTime } = params;
    const dow = dayOfWeekFor(date);
    const dateObj = new Date(`${date}T00:00:00Z`);
    const conflicts: { kind: 'TEACHER' | 'CLASS'; label: string }[] = [];

    // Toutes les décisions touchant cette date : celles qui libèrent une case de
    // la grille (occurrence d'origine ce jour-là) et celles qui en occupent une
    // (occurrence replacée ce jour-là).
    const decisions = await prisma.attendance_makeup_sessions.findMany({
      where: {
        OR: [{ original_date: dateObj }, { makeup_date: dateObj, status: { in: MAKEUP_ACTIVE_STATUSES } }],
        timetable: {
          academic_year_id: academicYearId,
          OR: [{ teacher_id: teacherId }, { class_id: classId }],
        },
      },
      include: {
        timetable: { include: { class: { select: { name: true } }, subject: { select: { name: true } } } },
      },
    });

    // Occurrences régulières libérées ce jour-là (déplacées ailleurs ou écartées).
    const vacated = new Set(
      decisions.filter((d) => fmtDate(d.original_date) === date).map((d) => d.timetable_id),
    );

    if (dow) {
      const slots = await prisma.class_timetables.findMany({
        where: {
          academic_year_id: academicYearId,
          day_of_week: dow as any,
          OR: [{ teacher_id: teacherId }, { class_id: classId }],
        },
        include: {
          class: { select: { name: true } },
          subject: { select: { name: true } },
        },
      });
      for (const s of slots) {
        if (vacated.has(s.id)) continue;
        if (s.id === params.excludeTimetableId && date === params.excludeOriginalDate) continue;
        if (!timeRangesOverlap(s.start_time, s.end_time, startTime, endTime)) continue;
        conflicts.push({
          kind: s.teacher_id === teacherId ? 'TEACHER' : 'CLASS',
          label: `${s.subject.name} · ${s.class.name} (${s.start_time}–${s.end_time}, cours régulier)`,
        });
      }
    }

    for (const m of decisions) {
      if (fmtDate(m.makeup_date ?? new Date(0)) !== date) continue;
      if (!MAKEUP_ACTIVE_STATUSES.includes(m.status)) continue;
      // Ne pas se déclarer en conflit avec soi-même lors d'une reprogrammation.
      if (
        params.excludeTimetableId === m.timetable_id &&
        params.excludeOriginalDate === fmtDate(m.original_date)
      ) {
        continue;
      }
      if (!m.start_time || !m.end_time) continue;
      if (!timeRangesOverlap(m.start_time, m.end_time, startTime, endTime)) continue;
      conflicts.push({
        kind: m.timetable.teacher_id === teacherId ? 'TEACHER' : 'CLASS',
        label: `${m.timetable.subject.name} · ${m.timetable.class.name} (${m.start_time}–${m.end_time}, ${
          m.status === MAKEUP_MOVED ? 'cours déplacé' : 'rattrapage'
        })`,
      });
    }

    return conflicts;
  }

  /**
   * Contrôle de conflit sans rien écrire : c'est ce que l'UI interroge pendant
   * que l'enseignant choisit sa date, pour l'avertir *avant* de valider. La
   * validation reste rejouée à l'écriture — l'UI n'est qu'un miroir.
   */
  static async checkConflicts(
    params: {
      timetableId: string;
      originalDate: string;
      date: string;
      startTime: string;
      endTime: string;
    },
    teacherId: string,
  ) {
    const slot = await this.ownedSlot(params.timetableId, teacherId);
    if (!dayOfWeekFor(params.date)) {
      return {
        conflicts: [],
        blocked: true,
        message: 'Aucun cours ne peut être placé un dimanche.',
      };
    }
    if (params.startTime >= params.endTime) {
      return { conflicts: [], blocked: true, message: "L'heure de fin doit suivre l'heure de début." };
    }

    const conflicts = await this.findConflicts({
      academicYearId: slot.academic_year_id,
      teacherId,
      classId: slot.class_id,
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      excludeTimetableId: params.timetableId,
      excludeOriginalDate: params.originalDate,
    });

    return {
      conflicts,
      blocked: conflicts.length > 0,
      message: conflicts.length ? this.conflictMessage(conflicts) : null,
    };
  }

  /** Message unique d'un conflit, partagé par le contrôle live et l'écriture. */
  private static conflictMessage(conflicts: { kind: 'TEACHER' | 'CLASS'; label: string }[]) {
    const who = conflicts[0].kind === 'TEACHER' ? 'Vous avez' : 'La classe a';
    return `Créneau indisponible : ${who} déjà ${conflicts[0].label}.`;
  }

  /** Programme (ou reprogramme) le rattrapage d'une occurrence manquée. */
  static async schedule(data: unknown, teacherId: string, userId: string) {
    const parsed = scheduleSchema.parse(data);
    const slot = await this.ownedSlot(parsed.timetableId, teacherId);

    // L'occurrence d'origine doit être une vraie occurrence du créneau.
    if (dayOfWeekFor(parsed.originalDate) !== slot.day_of_week) {
      throw new AttendancePolicyError(
        "La date d'origine ne correspond pas au jour du créneau.",
        'INVALID',
      );
    }

    // « à une date ultérieure » : le rattrapage se programme dans le futur (ou
    // aujourd'hui). Une date passée serait de toute façon inappelable — la
    // politique n'autorise l'appel que le jour même.
    const today = schoolToday();
    if (parsed.makeupDate < today) {
      throw new AttendancePolicyError(
        'Le rattrapage doit être programmé à une date ultérieure.',
        'INVALID',
      );
    }
    if (parsed.makeupDate <= parsed.originalDate) {
      throw new AttendancePolicyError(
        "Le rattrapage doit être postérieur à la séance manquée.",
        'INVALID',
      );
    }
    if (parsed.startTime >= parsed.endTime) {
      throw new AttendancePolicyError("L'heure de fin doit suivre l'heure de début.", 'INVALID');
    }
    if (!dayOfWeekFor(parsed.makeupDate)) {
      throw new AttendancePolicyError('Le rattrapage ne peut pas être programmé un dimanche.', 'INVALID');
    }

    const conflicts = await this.findConflicts({
      academicYearId: slot.academic_year_id,
      teacherId,
      classId: slot.class_id,
      date: parsed.makeupDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      excludeTimetableId: parsed.timetableId,
      excludeOriginalDate: parsed.originalDate,
    });
    if (conflicts.length) {
      throw new AttendancePolicyError(this.conflictMessage(conflicts), 'CONFLICT');
    }

    const row = await prisma.attendance_makeup_sessions.upsert({
      where: {
        timetable_id_original_date: {
          timetable_id: parsed.timetableId,
          original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        },
      },
      create: {
        id: crypto.randomUUID(),
        timetable_id: parsed.timetableId,
        original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        makeup_date: new Date(`${parsed.makeupDate}T00:00:00Z`),
        start_time: parsed.startTime,
        end_time: parsed.endTime,
        status: MAKEUP_SCHEDULED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
      update: {
        makeup_date: new Date(`${parsed.makeupDate}T00:00:00Z`),
        start_time: parsed.startTime,
        end_time: parsed.endTime,
        status: MAKEUP_SCHEDULED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
    });

    return { id: row.id, status: row.status, makeupDate: parsed.makeupDate };
  }

  /**
   * Déplace une occurrence **à venir** vers une autre heure ou un autre jour.
   *
   * Différences avec le rattrapage : l'occurrence d'origine n'est pas encore
   * passée (rien n'a été « manqué »), et la destination peut tomber *avant*
   * elle — avancer le cours de vendredi à mercredi est un déplacement
   * parfaitement normal. Seule contrainte de sens : ne pas viser une date
   * passée, qui serait inappelable.
   */
  static async move(data: unknown, teacherId: string, userId: string) {
    const parsed = moveSchema.parse(data);
    const slot = await this.ownedSlot(parsed.timetableId, teacherId);
    return this.applyMove(slot, parsed, userId);
  }

  /**
   * Écrit effectivement un déplacement (statut `MOVED`) : mêmes contrôles que
   * ci-dessus, extraits pour être rejoués tels quels par l'admin qui approuve
   * une demande de déplacement (§9.6bis) — `slot.teacher_id` fait foi, pas un
   * paramètre séparé qui pourrait diverger.
   *
   * Le type du 2e paramètre est dérivé de `moveSchema` (pas ré-écrit à la
   * main) : sous ce `tsconfig` (`strict: false`, donc pas de
   * `strictNullChecks`), zod infère tous les champs d'un objet comme
   * optionnels — un type écrit à la main avec des champs requis ne serait
   * alors jamais assignable depuis `moveSchema.parse(...)`.
   */
  static async applyMove(
    slot: Awaited<ReturnType<typeof AttendanceMakeupService.loadSlot>>,
    parsed: z.infer<typeof moveSchema>,
    userId: string,
  ) {
    const teacherId = slot.teacher_id;

    if (dayOfWeekFor(parsed.originalDate) !== slot.day_of_week) {
      throw new AttendancePolicyError(
        "La date d'origine ne correspond pas au jour du créneau.",
        'INVALID',
      );
    }

    const today = schoolToday();
    if (parsed.originalDate < today) {
      throw new AttendancePolicyError(
        "Ce cours est déjà passé : il relève du rattrapage, pas du déplacement.",
        'INVALID',
      );
    }
    if (parsed.newDate < today) {
      throw new AttendancePolicyError('Un cours ne peut pas être déplacé dans le passé.', 'INVALID');
    }
    if (parsed.startTime >= parsed.endTime) {
      throw new AttendancePolicyError("L'heure de fin doit suivre l'heure de début.", 'INVALID');
    }
    if (!dayOfWeekFor(parsed.newDate)) {
      throw new AttendancePolicyError('Un cours ne peut pas être déplacé un dimanche.', 'INVALID');
    }
    if (
      parsed.newDate === parsed.originalDate &&
      parsed.startTime === slot.start_time &&
      parsed.endTime === slot.end_time
    ) {
      throw new AttendancePolicyError(
        "La nouvelle date et l'horaire sont identiques au cours d'origine.",
        'INVALID',
      );
    }

    // Un cours du jour dont l'appel est déjà fait a eu lieu : le déplacer
    // laisserait une séance enregistrée sans occurrence pour la porter.
    const alreadyCalled = await prisma.attendance_sessions.findFirst({
      where: {
        academic_year_id: slot.academic_year_id,
        class_id: slot.class_id,
        subject_id: slot.subject_id,
        teacher_id: teacherId,
        date: new Date(`${parsed.originalDate}T00:00:00Z`),
        start_time: slot.start_time,
      },
      select: { id: true },
    });
    if (alreadyCalled) {
      throw new AttendancePolicyError(
        "L'appel de ce cours a déjà été fait : il ne peut plus être déplacé.",
        'CONFLICT',
      );
    }

    const conflicts = await this.findConflicts({
      academicYearId: slot.academic_year_id,
      teacherId,
      classId: slot.class_id,
      date: parsed.newDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      excludeTimetableId: parsed.timetableId,
      excludeOriginalDate: parsed.originalDate,
    });
    if (conflicts.length) {
      throw new AttendancePolicyError(this.conflictMessage(conflicts), 'CONFLICT');
    }

    const row = await prisma.attendance_makeup_sessions.upsert({
      where: {
        timetable_id_original_date: {
          timetable_id: parsed.timetableId,
          original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        },
      },
      create: {
        id: crypto.randomUUID(),
        timetable_id: parsed.timetableId,
        original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        makeup_date: new Date(`${parsed.newDate}T00:00:00Z`),
        start_time: parsed.startTime,
        end_time: parsed.endTime,
        status: MAKEUP_MOVED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
      update: {
        makeup_date: new Date(`${parsed.newDate}T00:00:00Z`),
        start_time: parsed.startTime,
        end_time: parsed.endTime,
        status: MAKEUP_MOVED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
    });

    return { id: row.id, status: row.status, newDate: parsed.newDate };
  }

  /** Écarte une occurrence (« pas de cours ce jour » : férié, vacances…). */
  static async dismiss(data: unknown, teacherId: string, userId: string) {
    const parsed = dismissSchema.parse(data);
    const slot = await this.ownedSlot(parsed.timetableId, teacherId);
    if (dayOfWeekFor(parsed.originalDate) !== slot.day_of_week) {
      throw new AttendancePolicyError(
        "La date d'origine ne correspond pas au jour du créneau.",
        'INVALID',
      );
    }

    const row = await prisma.attendance_makeup_sessions.upsert({
      where: {
        timetable_id_original_date: {
          timetable_id: parsed.timetableId,
          original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        },
      },
      create: {
        id: crypto.randomUUID(),
        timetable_id: parsed.timetableId,
        original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        makeup_date: null,
        status: MAKEUP_DISMISSED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
      update: {
        makeup_date: null,
        start_time: null,
        end_time: null,
        status: MAKEUP_DISMISSED,
        reason: parsed.reason ?? null,
        created_by: userId,
      },
    });

    return { id: row.id, status: row.status };
  }

  /**
   * Annule une décision : l'occurrence redevient « à traiter ».
   * Refusé si l'appel du rattrapage a déjà été fait — sinon la séance
   * enregistrée n'aurait plus de rattrapage pour la justifier.
   */
  static async cancel(id: string, teacherId: string) {
    const row = await prisma.attendance_makeup_sessions.findUnique({
      where: { id },
      include: { timetable: true },
    });
    if (!row) throw new AttendancePolicyError('Décision introuvable.', 'INVALID');
    if (row.timetable.teacher_id !== teacherId) {
      throw new AttendancePolicyError("Cette décision n'est pas la vôtre.", 'FORBIDDEN');
    }

    if (MAKEUP_ACTIVE_STATUSES.includes(row.status) && row.makeup_date && row.start_time) {
      const recorded = await prisma.attendance_sessions.findFirst({
        where: {
          academic_year_id: row.timetable.academic_year_id,
          class_id: row.timetable.class_id,
          subject_id: row.timetable.subject_id,
          teacher_id: row.timetable.teacher_id,
          date: row.makeup_date,
          start_time: row.start_time,
        },
      });
      if (recorded) {
        throw new AttendancePolicyError(
          "L'appel de ce rattrapage a déjà été fait : il ne peut plus être annulé.",
          'CONFLICT',
        );
      }
    }

    await prisma.attendance_makeup_sessions.delete({ where: { id } });
    return { id };
  }
}
