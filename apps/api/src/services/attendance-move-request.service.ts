import { prisma } from '@school/database';
import { z } from 'zod';
import crypto from 'crypto';
import { AttendancePolicyError } from './attendance-session.service';
import { AttendanceMakeupService } from './attendance-makeup.service';
import { dayOfWeekFor, fmtDate, schoolToday } from './attendance-policy';

/**
 * Demande de déplacement d'un cours à venir (§9.6bis).
 *
 * Contrairement au déplacement direct (`AttendanceMakeupService.move`, réservé
 * à l'ADMIN), l'enseignant ne déplace plus son cours lui-même : il **propose**
 * une date, qui n'occupe rien dans l'agenda tant qu'elle est `PENDING`. C'est
 * l'ADMIN qui tranche :
 *  - **approuve** la date proposée (ou une autre, de son choix) → une décision
 *    `attendance_makeup_sessions` (statut `MOVED`) est créée via
 *    {@link AttendanceMakeupService.applyMove}, exactement comme un
 *    déplacement direct ;
 *  - **refuse** → la demande reste tracée, l'occurrence redevient déplaçable
 *    (l'enseignant peut soumettre une nouvelle demande).
 *
 * Une seule demande active par occurrence (même contrainte d'unicité que
 * `attendance_makeup_sessions`) : une nouvelle demande sur la même occurrence
 * met simplement à jour la précédente si elle n'a pas encore été tranchée.
 */

export const MOVE_REQUEST_PENDING = 'PENDING';
export const MOVE_REQUEST_APPROVED = 'APPROVED';
export const MOVE_REQUEST_REJECTED = 'REJECTED';

const requestSchema = z.object({
  timetableId: z.string().min(1),
  originalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'originalDate attendue au format YYYY-MM-DD'),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'newDate attendue au format YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime attendue au format HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime attendue au format HH:MM'),
  reason: z.string().optional().nullable(),
});

const decisionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  adminNote: z.string().optional().nullable(),
});

const rejectSchema = z.object({
  adminNote: z.string().optional().nullable(),
});

const withTimetable = {
  timetable: {
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      classroom: { select: { id: true, name: true } },
      teacher: { select: { id: true, first_name: true, last_name: true } },
    },
  },
} as const;

function serialize(r: any) {
  return {
    id: r.id,
    timetableId: r.timetable_id,
    originalDate: fmtDate(r.original_date),
    requestedDate: fmtDate(r.requested_date),
    requestedStartTime: r.requested_start_time,
    requestedEndTime: r.requested_end_time,
    reason: r.reason,
    status: r.status,
    decidedDate: r.decided_date ? fmtDate(r.decided_date) : null,
    decidedStartTime: r.decided_start_time,
    decidedEndTime: r.decided_end_time,
    adminNote: r.admin_note,
    decidedAt: r.decided_at,
    class: r.timetable.class,
    subject: r.timetable.subject,
    classroom: r.timetable.classroom,
    teacher: r.timetable.teacher,
    originalStartTime: r.timetable.start_time,
    originalEndTime: r.timetable.end_time,
  };
}

export class AttendanceMoveRequestService {
  /** Enseignant : demande de déplacement d'un cours à venir. */
  static async create(data: unknown, teacherId: string, userId: string) {
    const parsed = requestSchema.parse(data);
    const slot = await AttendanceMakeupService.loadSlot(parsed.timetableId);
    if (slot.teacher_id !== teacherId) {
      throw new AttendancePolicyError("Ce créneau n'est pas assigné à cet enseignant.", 'FORBIDDEN');
    }
    if (dayOfWeekFor(parsed.originalDate) !== slot.day_of_week) {
      throw new AttendancePolicyError("La date d'origine ne correspond pas au jour du créneau.", 'INVALID');
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

    // Une occurrence déjà décidée (rattrapée, déplacée, écartée) ne se
    // redemande pas : elle passe par la décision existante, pas par une
    // nouvelle demande.
    const existingDecision = await prisma.attendance_makeup_sessions.findUnique({
      where: {
        timetable_id_original_date: {
          timetable_id: parsed.timetableId,
          original_date: new Date(`${parsed.originalDate}T00:00:00Z`),
        },
      },
    });
    if (existingDecision) {
      throw new AttendancePolicyError('Cette occurrence a déjà une décision enregistrée.', 'CONFLICT');
    }

    const row = await prisma.attendance_move_requests.upsert({
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
        requested_date: new Date(`${parsed.newDate}T00:00:00Z`),
        requested_start_time: parsed.startTime,
        requested_end_time: parsed.endTime,
        reason: parsed.reason ?? null,
        status: MOVE_REQUEST_PENDING,
        created_by: userId,
      },
      // Ré-application possible tant que la demande précédente n'a pas encore
      // été tranchée (PENDING) — ou pour en soumettre une nouvelle après un
      // refus (REJECTED) : les deux cas repartent d'un état propre.
      update: {
        requested_date: new Date(`${parsed.newDate}T00:00:00Z`),
        requested_start_time: parsed.startTime,
        requested_end_time: parsed.endTime,
        reason: parsed.reason ?? null,
        status: MOVE_REQUEST_PENDING,
        decided_date: null,
        decided_start_time: null,
        decided_end_time: null,
        admin_note: null,
        decided_by: null,
        decided_at: null,
        created_by: userId,
      },
      include: withTimetable,
    });

    return serialize(row);
  }

  /** Enseignant : ses demandes (toutes périodes/statuts confondus). */
  static async listMine(params: { teacherId: string; academicYearId: string; classId?: string; subjectId?: string }) {
    const { teacherId, academicYearId, classId, subjectId } = params;
    const rows = await prisma.attendance_move_requests.findMany({
      where: {
        timetable: {
          teacher_id: teacherId,
          academic_year_id: academicYearId,
          ...(classId ? { class_id: classId } : {}),
          ...(subjectId ? { subject_id: subjectId } : {}),
        },
      },
      include: withTimetable,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(serialize);
  }

  /** Admin : demandes en attente (ou d'un statut donné), tous enseignants confondus. */
  static async listForAdmin(params: {
    academicYearId: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }) {
    const { academicYearId, classId, subjectId, teacherId, status } = params;
    const rows = await prisma.attendance_move_requests.findMany({
      where: {
        status: status || MOVE_REQUEST_PENDING,
        timetable: {
          academic_year_id: academicYearId,
          ...(classId ? { class_id: classId } : {}),
          ...(subjectId ? { subject_id: subjectId } : {}),
          ...(teacherId ? { teacher_id: teacherId } : {}),
        },
      },
      include: withTimetable,
      orderBy: { created_at: 'asc' },
    });
    return rows.map(serialize);
  }

  /**
   * Admin : valide la demande — à la date proposée, ou à une autre si `data`
   * en fournit une. Rejoue exactement les mêmes contrôles qu'un déplacement
   * direct (conflits, appel déjà fait…) : un refus ici laisse la demande
   * `PENDING`, l'admin peut réessayer avec une autre date.
   */
  static async approve(id: string, data: unknown, adminUserId: string) {
    const parsed = decisionSchema.parse(data);
    const request = await prisma.attendance_move_requests.findUnique({ where: { id } });
    if (!request) throw new AttendancePolicyError('Demande introuvable.', 'INVALID');
    if (request.status !== MOVE_REQUEST_PENDING) {
      throw new AttendancePolicyError('Cette demande a déjà été traitée.', 'CONFLICT');
    }

    const finalDate = parsed.date ?? fmtDate(request.requested_date);
    const finalStart = parsed.startTime ?? request.requested_start_time;
    const finalEnd = parsed.endTime ?? request.requested_end_time;

    const slot = await AttendanceMakeupService.loadSlot(request.timetable_id);
    const result = await AttendanceMakeupService.applyMove(
      slot,
      {
        timetableId: request.timetable_id,
        originalDate: fmtDate(request.original_date),
        newDate: finalDate,
        startTime: finalStart,
        endTime: finalEnd,
        reason: request.reason,
      },
      adminUserId,
    );

    const overridden =
      finalDate !== fmtDate(request.requested_date) ||
      finalStart !== request.requested_start_time ||
      finalEnd !== request.requested_end_time;

    const updated = await prisma.attendance_move_requests.update({
      where: { id },
      data: {
        status: MOVE_REQUEST_APPROVED,
        decided_date: new Date(`${finalDate}T00:00:00Z`),
        decided_start_time: finalStart,
        decided_end_time: finalEnd,
        admin_note: parsed.adminNote ?? (overridden ? "Date proposée par l'administration." : null),
        decided_by: adminUserId,
        decided_at: new Date(),
      },
      include: withTimetable,
    });

    return { request: serialize(updated), makeup: result, overridden };
  }

  /** Admin : refuse la demande. L'occurrence redevient déplaçable. */
  static async reject(id: string, data: unknown, adminUserId: string) {
    const parsed = rejectSchema.parse(data);
    const request = await prisma.attendance_move_requests.findUnique({ where: { id } });
    if (!request) throw new AttendancePolicyError('Demande introuvable.', 'INVALID');
    if (request.status !== MOVE_REQUEST_PENDING) {
      throw new AttendancePolicyError('Cette demande a déjà été traitée.', 'CONFLICT');
    }
    const updated = await prisma.attendance_move_requests.update({
      where: { id },
      data: {
        status: MOVE_REQUEST_REJECTED,
        admin_note: parsed.adminNote ?? null,
        decided_by: adminUserId,
        decided_at: new Date(),
      },
      include: withTimetable,
    });
    return serialize(updated);
  }

  /** Enseignant : annule sa propre demande, tant qu'elle n'est pas tranchée. */
  static async cancel(id: string, teacherId: string) {
    const request = await prisma.attendance_move_requests.findUnique({ where: { id }, include: { timetable: true } });
    if (!request) throw new AttendancePolicyError('Demande introuvable.', 'INVALID');
    if (request.timetable.teacher_id !== teacherId) {
      throw new AttendancePolicyError("Cette demande n'est pas la vôtre.", 'FORBIDDEN');
    }
    if (request.status !== MOVE_REQUEST_PENDING) {
      throw new AttendancePolicyError('Cette demande a déjà été traitée.', 'CONFLICT');
    }
    await prisma.attendance_move_requests.delete({ where: { id } });
    return { id };
  }
}
