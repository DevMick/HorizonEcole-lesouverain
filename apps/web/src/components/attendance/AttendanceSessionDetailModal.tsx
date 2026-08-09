import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CalendarClock, Hash, User, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Modal, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PRESENT: { label: 'Présent', cls: 'ds-status-present' },
  LATE: { label: 'Retard', cls: 'ds-status-late' },
  ABSENT: { label: 'Absent', cls: 'ds-status-absent' },
  EXCUSED: { label: 'Excusé', cls: 'ds-status-absent' },
};

interface Props {
  sessionId: string | null;
  onClose: () => void;
  /** Affiche l'enseignant qui a fait l'appel (vue administration). */
  showTeacher?: boolean;
}

/** Détail d'une séance : liste des élèves et leur statut de présence. */
export function AttendanceSessionDetailModal({ sessionId, onClose, showTeacher = false }: Props) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['att-session-detail', sessionId],
    queryFn: async () => (await api.get(`/attendance-sessions/${sessionId}`)).data.data,
    enabled: !!sessionId,
  });

  return (
    <Modal
      open={!!sessionId}
      onClose={onClose}
      width={560}
      title={
        detail ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="ds-seance-badge">
              <Hash width={13} height={13} aria-hidden />
              Séance {detail.session_number}
            </span>
            <span>
              {detail.subject?.name} · {detail.class?.name}
            </span>
          </span>
        ) : (
          'Détail de la séance'
        )
      }
    >
      {isLoading || !detail ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={40} className="rounded-lg" />
          ))}
        </div>
      ) : (
        <div>
          <p className="mb-3 flex flex-wrap items-center gap-3 text-sm text-ds-text-secondary">
            <span className="inline-flex items-center gap-1">
              <CalendarClock width={14} height={14} aria-hidden />
              {dayjs(detail.date).format('dddd D MMMM YYYY')}
              {detail.start_time ? ` · ${detail.start_time}–${detail.end_time || ''}` : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users width={14} height={14} aria-hidden />
              {detail.records?.length ?? 0} élèves
            </span>
            {showTeacher && detail.teacher && (
              <span className="inline-flex items-center gap-1">
                <User width={14} height={14} aria-hidden />
                {detail.teacher.first_name} {detail.teacher.last_name}
              </span>
            )}
          </p>
          <ul className="ds-hist-detail">
            {(detail.records || []).map((r: any) => {
              const meta = STATUS_META[r.status] || STATUS_META.ABSENT;
              return (
                <li key={r.id}>
                  <span>
                    <strong>
                      {r.student?.firstName} {r.student?.lastName}
                    </strong>
                    <span className="text-ds-text-tertiary"> · {r.student?.studentNumber || '—'}</span>
                  </span>
                  <span className={cn('ds-hist-status', meta.cls)}>{meta.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
