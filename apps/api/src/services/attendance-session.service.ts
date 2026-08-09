import { prisma } from '@school/database';
import { z } from 'zod';
import crypto from 'crypto';
import { AttendanceService } from './attendance.service';
import {
  addMinutesToTime,
  computeSlotStatus,
  dayOfWeekFor,
  editWindowMinutesLeft,
  fmtDate,
  GRACE_MINUTES,
  isWritable,
  refusalReason,
  type SlotStatus,
} from './attendance-policy';

// Un appel = une séance de cours (matière) rattachée à un créneau de l'emploi
// du temps. La numérotation « Séance N » est portée par session_number, scopée
// par (année, classe, matière, enseignant).
//
// Le créneau (`timetableId`) est obligatoire : il n'existe pas de séance hors
// emploi du temps. C'est lui qui détermine classe, matière et horaires — le
// client ne fait que le désigner. Voir attendance-policy.ts pour les fenêtres.

/** Erreur métier d'appel — la route la traduit en 403/409/400. */
export class AttendancePolicyError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONFLICT' | 'FORBIDDEN' | 'INVALID',
  ) {
    super(message);
    this.name = 'AttendancePolicyError';
  }
}

const recordItemSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  excuse: z.string().optional().nullable(),
  isJustified: z.boolean().optional().default(false),
});

export const saveSessionSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format YYYY-MM-DD'),
  timetableId: z.string().min(1, "Le créneau de l'emploi du temps est requis"),
  notes: z.string().optional().nullable(),
  records: z.array(recordItemSchema),
});
// Note : `startTime`/`endTime` ne sont volontairement plus acceptés. Ils forment
// la clé d'unicité de la séance et sont dérivés du créneau — les recevoir du
// client permettrait de forger un doublon en décalant l'horaire. Zod retire les
// clés inconnues, un ancien client qui les envoie est donc simplement ignoré.

export type SaveSessionInput = z.infer<typeof saveSessionSchema>;

export class AttendanceSessionService {
  /**
   * Agenda d'appel d'un enseignant pour une date : ses créneaux de ce jour,
   * chacun enrichi de son statut et, s'il existe, de la séance déjà saisie.
   *
   * C'est la source de vérité unique de l'écran d'appel : le client n'a plus à
   * croiser emploi du temps × séances ni à décider ce qui est modifiable.
   */
  static async getAgenda(params: { teacherId: string; academicYearId: string; date: string }) {
    const { teacherId, academicYearId, date } = params;

    const dayOfWeek = dayOfWeekFor(date);
    const dateObj = new Date(`${date}T00:00:00Z`);

    // Décisions de réaménagement touchant ce jour (§9.6). Deux sens :
    //  - `makeup_date` = ce jour → l'occurrence *arrive* ici (rattrapage d'une
    //    séance manquée, ou cours déplacé). Elle s'ajoute aux cours réguliers —
    //    y compris un dimanche, où la grille est vide.
    //  - `original_date` = ce jour → l'occurrence *part* d'ici : le cours
    //    régulier correspondant ne doit plus figurer dans l'agenda, sans quoi un
    //    cours déplacé serait appelable deux fois.
    // Les statuts sont écrits en clair : le service de rattrapage importe déjà
    // ce module, l'inverse créerait un cycle (cf. `recordSession`).
    const decisions = await prisma.attendance_makeup_sessions.findMany({
      where: {
        OR: [{ makeup_date: dateObj, status: { in: ['SCHEDULED', 'MOVED'] } }, { original_date: dateObj }],
        timetable: { teacher_id: teacherId, academic_year_id: academicYearId },
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
    });

    const makeups = decisions.filter(
      (d) => d.makeup_date && fmtDate(d.makeup_date) === date && d.status !== 'DISMISSED',
    );
    // Créneaux dont l'occurrence du jour a été replacée ailleurs ou écartée.
    const vacated = new Set(
      decisions.filter((d) => fmtDate(d.original_date) === date).map((d) => d.timetable_id),
    );

    const regularAll = dayOfWeek
      ? await prisma.class_timetables.findMany({
          where: { teacher_id: teacherId, academic_year_id: academicYearId, day_of_week: dayOfWeek as any },
          include: {
            class: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true, code: true } },
            classroom: { select: { id: true, name: true } },
          },
          orderBy: { start_time: 'asc' },
        })
      : [];

    const regular = regularAll.filter((s) => !vacated.has(s.id));

    // Occurrences du jour : cours réguliers + occurrences replacées ici. Une
    // occurrence replacée porte ses propres horaires et garde une trace de la
    // date d'origine.
    const slots = [
      ...regular.map((s) => ({
        slot: s,
        startTime: s.start_time,
        endTime: s.end_time,
        makeupOf: null as string | null,
        kind: null as 'MAKEUP' | 'MOVE' | null,
      })),
      ...makeups.map((m) => ({
        slot: m.timetable,
        startTime: m.start_time ?? m.timetable.start_time,
        endTime: m.end_time ?? m.timetable.end_time,
        makeupOf: fmtDate(m.original_date),
        kind: (m.status === 'MOVED' ? 'MOVE' : 'MAKEUP') as 'MAKEUP' | 'MOVE',
      })),
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!slots.length) return { date, dayOfWeek, slots: [] };

    const [sessions, maxNumbers] = await Promise.all([
      prisma.attendance_sessions.findMany({
        where: { teacher_id: teacherId, academic_year_id: academicYearId, date: dateObj },
        include: { records: { select: { status: true } } },
      }),
      prisma.attendance_sessions.groupBy({
        by: ['class_id', 'subject_id'],
        where: { teacher_id: teacherId, academic_year_id: academicYearId },
        _max: { session_number: true },
      }),
    ]);

    // Rattachement séance → occurrence. La clé inclut l'horaire : un rattrapage
    // partage le créneau de son cours d'origine mais se tient à un autre
    // horaire, et c'est (date, start_time) qui identifie une séance.
    // Repli sur (classe, matière, horaire) pour les séances antérieures à
    // l'obligation du créneau. Les anciennes « séances libres » (start_time
    // null) n'ont pas de créneau : elles restent dans l'historique, hors agenda.
    const byTimetable = new Map(
      sessions.filter((s) => s.timetable_id).map((s) => [`${s.timetable_id}|${s.start_time ?? ''}`, s]),
    );
    const byTriplet = new Map(sessions.map((s) => [`${s.class_id}|${s.subject_id}|${s.start_time ?? ''}`, s]));

    // « Séance N » à afficher pour une occurrence pas encore appelée : max + 1
    // par (classe, matière). Le compteur avance si le même cours revient
    // plusieurs fois dans la journée, pour ne pas afficher deux fois le même
    // numéro.
    const nextByCombo = new Map(
      maxNumbers.map((m) => [`${m.class_id}|${m.subject_id}`, (m._max.session_number ?? 0) + 1]),
    );

    const now = new Date();
    const enriched = slots.map(({ slot, startTime, endTime, makeupOf, kind }) => {
      const session =
        byTimetable.get(`${slot.id}|${startTime}`) ??
        byTriplet.get(`${slot.class_id}|${slot.subject_id}|${startTime}`);
      const status: SlotStatus = computeSlotStatus(date, startTime, session?.created_at ?? null, now);

      let sessionNumber: number;
      const comboKey = `${slot.class_id}|${slot.subject_id}`;
      if (session) {
        sessionNumber = session.session_number;
      } else {
        sessionNumber = nextByCombo.get(comboKey) ?? 1;
        nextByCombo.set(comboKey, sessionNumber + 1);
      }

      const counts = { present: 0, late: 0, absent: 0, excused: 0, total: session?.records.length ?? 0 };
      session?.records.forEach((r) => {
        if (r.status === 'PRESENT') counts.present++;
        else if (r.status === 'LATE') counts.late++;
        else if (r.status === 'EXCUSED') counts.excused++;
        else counts.absent++;
      });

      return {
        timetableId: slot.id,
        classId: slot.class_id,
        subjectId: slot.subject_id,
        academicYearId: slot.academic_year_id,
        class: slot.class,
        subject: slot.subject,
        classroom: slot.classroom,
        dayOfWeek: slot.day_of_week,
        startTime,
        endTime,
        /** Heure limite (HH:MM) du délai de grâce avant confiscation à l'administration. */
        graceEndsAt: addMinutesToTime(startTime, GRACE_MINUTES),
        date,
        /** Date d'origine, si cette occurrence a été rattrapée ou déplacée. */
        makeupOf,
        /** 'MAKEUP' (séance manquée reprogrammée) ou 'MOVE' (cours déplacé). */
        occurrenceKind: kind,
        status,
        writable: isWritable(status),
        sessionId: session?.id ?? null,
        sessionNumber,
        recordedAt: session?.created_at ?? null,
        editMinutesLeft: session ? editWindowMinutesLeft(session.created_at, now) : 0,
        counts: session ? counts : null,
      };
    });

    return { date, dayOfWeek, slots: enriched };
  }

  /** Présences déjà saisies d'une séance, pour ré-affichage à la correction. */
  static async getSessionRecords(sessionId: string) {
    return prisma.attendance_records.findMany({
      where: { session_id: sessionId },
      select: { student_id: true, status: true, excuse: true, is_justified: true },
    });
  }

  /**
   * Enregistre (ou corrige) une séance et ses présences.
   *
   * L'appel est strictement adossé à un créneau de l'emploi du temps : le
   * créneau est vérifié, et classe/matière/horaires en sont *dérivés*. Les
   * fenêtres temporelles (appel le jour du cours, correction 30 min) sont
   * appliquées ici — l'UI ne fait que les refléter. Un ADMIN reste exempté des
   * fenêtres : c'est la voie de correction annoncée à l'enseignant.
   */
  static async recordSession(
    data: unknown,
    recordedByUserId: string,
    actorRole: 'ADMIN' | 'TEACHER' = 'TEACHER',
  ) {
    const parsed = saveSessionSchema.parse(data);
    const enforceWindows = actorRole !== 'ADMIN';

    // 1. Le créneau doit exister et appartenir à l'enseignant de la séance.
    const slot = await prisma.class_timetables.findUnique({
      where: { id: parsed.timetableId },
    });
    if (!slot) {
      throw new AttendancePolicyError("Ce créneau n'existe pas dans l'emploi du temps.", 'INVALID');
    }
    if (slot.teacher_id !== parsed.teacherId) {
      throw new AttendancePolicyError("Ce créneau n'est pas assigné à cet enseignant.", 'FORBIDDEN');
    }

    // 2. Le payload ne doit pas contredire le créneau. Sans ça, un client forgé
    //    ferait l'appel d'une classe qu'il n'enseigne pas en réutilisant un de
    //    ses propres créneaux.
    if (
      slot.class_id !== parsed.classId ||
      slot.subject_id !== parsed.subjectId ||
      slot.academic_year_id !== parsed.academicYearId
    ) {
      throw new AttendancePolicyError(
        'Classe, matière ou année scolaire incohérente avec le créneau.',
        'INVALID',
      );
    }
    // 3. La date doit être soit une occurrence normale du créneau, soit une
    //    occurrence replacée à cette date — rattrapage ou cours déplacé (§9.6).
    //    On interroge la table directement plutôt que d'appeler le service de
    //    rattrapage : celui-ci importe déjà ce module, l'inverse créerait un
    //    cycle.
    // 'YYYY-MM-DD' est un jour calendaire : on l'ancre en UTC pour rester
    // indépendant de la TZ du serveur (colonne @db.Date).
    const dateObj = new Date(`${parsed.date}T00:00:00Z`);
    const makeup = await prisma.attendance_makeup_sessions.findFirst({
      where: {
        timetable_id: slot.id,
        status: { in: ['SCHEDULED', 'MOVED'] },
        makeup_date: dateObj,
      },
    });
    if (!makeup && dayOfWeekFor(parsed.date) !== slot.day_of_week) {
      throw new AttendancePolicyError("La date ne correspond pas au jour du créneau.", 'INVALID');
    }

    // Une occurrence déplacée hors de ce jour n'y est plus appelable : sans ce
    // garde-fou, l'appel du cours d'origine resterait possible en plus de celui
    // du cours déplacé.
    if (!makeup) {
      const vacated = await prisma.attendance_makeup_sessions.findFirst({
        where: { timetable_id: slot.id, original_date: dateObj },
      });
      if (vacated) {
        throw new AttendancePolicyError(
          vacated.status === 'DISMISSED'
            ? "Cette séance a été écartée (pas de cours ce jour)."
            : "Ce cours a été déplacé : l'appel se fait à sa nouvelle date.",
          'INVALID',
        );
      }
    }

    // 4. Horaires dérivés du créneau — ou de l'occurrence replacée, qui peut se
    //    tenir à un autre horaire. Jamais du client : c'est la clé d'unicité de
    //    la séance.
    const startTime = makeup?.start_time ?? slot.start_time;
    const endTime = makeup?.end_time ?? slot.end_time;

    // La classe doit exister et les élèves lui appartenir.
    const klass = await prisma.schoolClass.findUnique({
      where: { id: parsed.classId },
      include: { students: { select: { id: true } } },
    });
    if (!klass) throw new Error('Class not found');
    const classStudentIds = new Set(klass.students.map((s) => s.id));

    const combo = {
      academic_year_id: parsed.academicYearId,
      class_id: parsed.classId,
      subject_id: parsed.subjectId,
      teacher_id: parsed.teacherId,
    };

    const existing = await prisma.attendance_sessions.findFirst({
      where: { ...combo, date: dateObj, start_time: startTime },
    });

    // 5. Fenêtres : appel le jour du cours (ou du rattrapage, `parsed.date`
    //    portant alors la date reprogrammée), correction limitée après coup.
    if (enforceWindows) {
      const status = computeSlotStatus(parsed.date, startTime, existing?.created_at ?? null);
      if (!isWritable(status)) {
        throw new AttendancePolicyError(refusalReason(status), status === 'DONE' ? 'CONFLICT' : 'FORBIDDEN');
      }
    }

    let sessionId: string;
    let sessionNumber: number;

    if (existing) {
      sessionId = existing.id;
      sessionNumber = existing.session_number;
      await prisma.attendance_sessions.update({
        where: { id: existing.id },
        data: {
          end_time: endTime,
          timetable_id: parsed.timetableId,
          notes: parsed.notes ?? null,
          recorded_by: recordedByUserId,
        },
      });
    } else {
      const agg = await prisma.attendance_sessions.aggregate({
        where: combo,
        _max: { session_number: true },
      });
      sessionNumber = (agg._max.session_number ?? 0) + 1;
      sessionId = crypto.randomUUID();
      await prisma.attendance_sessions.create({
        data: {
          id: sessionId,
          ...combo,
          date: dateObj,
          start_time: startTime,
          end_time: endTime,
          timetable_id: parsed.timetableId,
          session_number: sessionNumber,
          notes: parsed.notes ?? null,
          recorded_by: recordedByUserId,
        },
      });
    }

    // Ne garder que les élèves réellement dans la classe.
    const validRecords = parsed.records.filter((r) => classStudentIds.has(r.studentId));

    // Remplace l'ensemble des présences de la séance (transaction).
    await prisma.$transaction([
      prisma.attendance_records.deleteMany({ where: { session_id: sessionId } }),
      prisma.attendance_records.createMany({
        data: validRecords.map((r) => ({
          id: crypto.randomUUID(),
          session_id: sessionId,
          student_id: r.studentId,
          status: r.status,
          excuse: r.excuse ?? null,
          is_justified: r.isJustified ?? false,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Rafraîchit le résumé mensuel (profil élève) — union legacy + séances.
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    for (const r of validRecords) {
      await AttendanceService.updateAttendanceSummary(r.studentId, month, year);
    }

    return {
      sessionId,
      sessionNumber,
      summary: {
        total: parsed.records.length,
        successful: validRecords.length,
        failed: parsed.records.length - validRecords.length,
      },
    };
  }

  /** Historique des séances (filtres année/classe/matière/enseignant/séance). */
  static async getHistory(filters: {
    academicYearId?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    sessionNumber?: number | string;
    page?: number;
    limit?: number;
  }) {
    const { academicYearId, classId, subjectId, teacherId, sessionNumber, page = 1, limit = 100 } = filters;

    const where: any = {};
    if (academicYearId) where.academic_year_id = academicYearId;
    if (classId) where.class_id = classId;
    if (subjectId) where.subject_id = subjectId;
    if (teacherId) where.teacher_id = teacherId;
    if (sessionNumber) where.session_number = Number(sessionNumber);

    const [sessions, total] = await Promise.all([
      prisma.attendance_sessions.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
          records: { select: { status: true } },
        },
        orderBy: [{ date: 'desc' }, { start_time: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.attendance_sessions.count({ where }),
    ]);

    const data = sessions.map((s) => {
      const counts = { present: 0, late: 0, absent: 0, excused: 0, total: s.records.length };
      s.records.forEach((r) => {
        if (r.status === 'PRESENT') counts.present++;
        else if (r.status === 'LATE') counts.late++;
        else if (r.status === 'EXCUSED') counts.excused++;
        else counts.absent++;
      });
      const { records, ...rest } = s;
      return { ...rest, counts };
    });

    return {
      sessions: data,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  /**
   * Vue d'ensemble administration : cumul des présences sur une année scolaire,
   * agrégé par matière, par classe et (si une classe est choisie) par élève.
   *
   * « Séances » = nombre d'appels effectués ; « pointages » = nombre d'élèves
   * effectivement pointés (séances × effectif présent à l'appel). Le taux de
   * présence compte les retards comme présence effective.
   */
  static async getOverview(filters: {
    academicYearId: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
  }) {
    const { academicYearId, classId, subjectId, teacherId } = filters;

    const where: any = { academic_year_id: academicYearId };
    if (classId) where.class_id = classId;
    if (subjectId) where.subject_id = subjectId;
    if (teacherId) where.teacher_id = teacherId;

    const sessions = await prisma.attendance_sessions.findMany({
      where,
      select: {
        id: true,
        class_id: true,
        subject_id: true,
        date: true,
        session_number: true,
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: [{ date: 'desc' }],
    });

    const records = sessions.length
      ? await prisma.attendance_records.findMany({
          where: { session_id: { in: sessions.map((s) => s.id) } },
          select: { session_id: true, student_id: true, status: true },
        })
      : [];

    // Effectifs par classe (élèves actifs) — sert de base au « nombre attendu »
    // de pointages : séances × effectif.
    const classIds = [...new Set(sessions.map((s) => s.class_id))];
    if (classId && !classIds.includes(classId)) classIds.push(classId);
    const headcounts = classIds.length
      ? await prisma.student.groupBy({
          by: ['classId'],
          where: { classId: { in: classIds }, status: 'ACTIVE' },
          _count: { _all: true },
        })
      : [];
    const headcountByClass = new Map(headcounts.map((h) => [h.classId as string, h._count._all]));

    const blank = () => ({ present: 0, late: 0, absent: 0, excused: 0, marks: 0 });
    const bump = (acc: ReturnType<typeof blank>, status: string) => {
      acc.marks++;
      if (status === 'PRESENT') acc.present++;
      else if (status === 'LATE') acc.late++;
      else if (status === 'EXCUSED') acc.excused++;
      else acc.absent++;
    };
    const rate = (a: { present: number; late: number; marks: number }) =>
      a.marks > 0 ? Math.round(((a.present + a.late) / a.marks) * 1000) / 10 : 0;

    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    // --- Par matière -----------------------------------------------------
    const subjectAcc = new Map<string, any>();
    for (const s of sessions) {
      let row = subjectAcc.get(s.subject_id);
      if (!row) {
        row = {
          subjectId: s.subject_id,
          name: s.subject?.name || '—',
          code: s.subject?.code || '',
          sessions: 0,
          teachers: new Set<string>(),
          expected: 0,
          ...blank(),
        };
        subjectAcc.set(s.subject_id, row);
      }
      row.sessions++;
      row.expected += headcountByClass.get(s.class_id) ?? 0;
      if (s.teacher) row.teachers.add(`${s.teacher.first_name} ${s.teacher.last_name}`.trim());
    }

    // --- Par classe ------------------------------------------------------
    const classAcc = new Map<string, any>();
    for (const s of sessions) {
      let row = classAcc.get(s.class_id);
      if (!row) {
        row = {
          classId: s.class_id,
          name: s.class?.name || '—',
          students: headcountByClass.get(s.class_id) ?? 0,
          sessions: 0,
          subjects: new Set<string>(),
          expected: 0,
          ...blank(),
        };
        classAcc.set(s.class_id, row);
      }
      row.sessions++;
      row.subjects.add(s.subject_id);
      row.expected += row.students;
    }

    // --- Par élève (seulement si une classe est sélectionnée) -------------
    const studentAcc = new Map<string, any>();
    let students: any[] = [];
    if (classId) {
      students = await prisma.student.findMany({
        where: { classId, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, studentNumber: true, gender: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      for (const st of students) {
        studentAcc.set(st.id, {
          studentId: st.id,
          firstName: st.firstName,
          lastName: st.lastName,
          studentNumber: st.studentNumber,
          gender: st.gender,
          bySubject: new Map<string, any>(),
          ...blank(),
        });
      }
    }

    const totals = blank();
    for (const r of records) {
      const s = sessionById.get(r.session_id);
      if (!s) continue;
      bump(totals, r.status);
      bump(subjectAcc.get(s.subject_id), r.status);
      bump(classAcc.get(s.class_id), r.status);

      const st = studentAcc.get(r.student_id);
      if (st) {
        bump(st, r.status);
        let sub = st.bySubject.get(s.subject_id);
        if (!sub) {
          sub = { subjectId: s.subject_id, name: s.subject?.name || '—', ...blank() };
          st.bySubject.set(s.subject_id, sub);
        }
        bump(sub, r.status);
      }
    }

    // Nombre de séances par matière dans le périmètre : sert de dénominateur
    // « séances » pour chaque élève (une séance non pointée pour lui = manquante).
    const sessionsBySubject = new Map<string, number>();
    for (const s of sessions) {
      sessionsBySubject.set(s.subject_id, (sessionsBySubject.get(s.subject_id) ?? 0) + 1);
    }

    const bySubject = [...subjectAcc.values()]
      .map((r) => ({ ...r, teachers: [...r.teachers], rate: rate(r) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const byClass = [...classAcc.values()]
      .map((r) => ({ ...r, subjects: r.subjects.size, rate: rate(r) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const byStudent = [...studentAcc.values()].map((st) => ({
      ...st,
      sessions: sessions.length,
      missing: Math.max(0, sessions.length - st.marks),
      rate: rate(st),
      bySubject: [...st.bySubject.values()]
        .map((sub: any) => ({
          ...sub,
          sessions: sessionsBySubject.get(sub.subjectId) ?? 0,
          rate: rate(sub),
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)),
    }));

    return {
      totals: {
        ...totals,
        sessions: sessions.length,
        classes: classAcc.size,
        subjects: subjectAcc.size,
        students: classId ? students.length : [...headcountByClass.values()].reduce((a, b) => a + b, 0),
        expected: sessions.reduce((acc, s) => acc + (headcountByClass.get(s.class_id) ?? 0), 0),
        rate: rate(totals),
        lastSessionDate: sessions[0]?.date ?? null,
      },
      bySubject,
      byClass,
      byStudent,
    };
  }

  /** Détail d'une séance : présences par élève. */
  static async getSessionDetail(id: string) {
    const session = await prisma.attendance_sessions.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, first_name: true, last_name: true } },
        records: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
          },
        },
      },
    });

    if (!session) throw new Error('Session not found');

    session.records.sort((a, b) =>
      (a.student?.lastName || '').localeCompare(b.student?.lastName || ''),
    );

    return session;
  }
}
