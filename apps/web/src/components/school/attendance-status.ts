import type { BadgeStatus } from '../ds';

/** Statuts d'appel de l'API (enum AttendanceStatus). */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

/**
 * Traduction des statuts d'appel vers le vocabulaire du design system (§5.3).
 * « Excusé » est bien une absence, mais justifiée : ambre plutôt que rouge, pour
 * qu'un parent distingue d'un coup d'œil ce qui appelle une action de ce qui est
 * déjà réglé.
 */
export const ATTENDANCE_BADGE: Record<AttendanceStatus, { label: string; kind: BadgeStatus }> = {
  PRESENT: { label: 'Présent', kind: 'success' },
  LATE: { label: 'En retard', kind: 'warning' },
  EXCUSED: { label: 'Absence excusée', kind: 'warning' },
  ABSENT: { label: 'Absent', kind: 'danger' },
};
