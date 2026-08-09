import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ClipboardCheck, Clock, ShieldCheck, TrendingDown, User } from 'lucide-react';
import { Button, Card, Skeleton, StatusBadge } from '../ds';
import { ATTENDANCE_BADGE, type AttendanceStatus } from './attendance-status';

dayjs.locale('fr');

/**
 * Historique des appels par séance (§5.12, vu depuis la famille ou l'élève).
 *
 * L'enseignant *saisit* un appel ; le parent et l'élève le *relisent*. La grille
 * de vignettes tactile n'a donc aucun sens ici : on affiche une chronologie
 * inversée (le plus récent d'abord — la question porte presque toujours sur
 * hier), précédée de compteurs qui donnent la tendance avant même qu'on lise une
 * ligne.
 */

export interface AttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  presenceRate: number | null;
}

export interface AttendanceBoardProps {
  sessions: any[];
  stats?: AttendanceStats;
  loading?: boolean;
  /** Vrai si un filtre trimestre/matière est actif — change le texte de l'état vide. */
  filtered?: boolean;
  emptyText?: string;
  /** Découpe l'historique en pages (10 / 50 / 100 séances) plutôt que tout dérouler. */
  paginated?: boolean;
}

const PAGE_SIZES = [10, 50, 100];

const RATE_TONE = (rate: number | null) => {
  if (rate === null) return { accent: 'info' as const, label: 'Aucun appel' };
  if (rate >= 90) return { accent: 'success' as const, label: 'Assiduité satisfaisante' };
  if (rate >= 75) return { accent: 'warning' as const, label: 'Assiduité à surveiller' };
  return { accent: 'danger' as const, label: 'Assiduité préoccupante' };
};

export function AttendanceBoard({
  sessions,
  stats,
  loading,
  filtered,
  emptyText,
  paginated,
}: AttendanceBoardProps) {
  const tone = RATE_TONE(stats?.presenceRate ?? null);

  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  // Un changement de filtre (ou de taille de page) ramène en tête de liste :
  // rester page 4 sur un historique qui n'en compte plus qu'une afficherait vide.
  useEffect(() => { setPage(1); }, [sessions.length, pageSize]);

  const totalPages = paginated ? Math.max(1, Math.ceil(sessions.length / pageSize)) : 1;
  const current = Math.min(page, totalPages);
  const visible = useMemo(
    () => (paginated ? sessions.slice((current - 1) * pageSize, current * pageSize) : sessions),
    [sessions, paginated, current, pageSize],
  );
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, sessions.length);

  return (
    <>
      <div className="ds-stat-grid mb-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} className="rounded-lg" />
          ))
        ) : (
          <>
            <Card accent={tone.accent} className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">{tone.label}</span>
                <span className="ds-stat-value">
                  {stats.presenceRate === null ? '—' : `${stats.presenceRate}%`}
                </span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <ClipboardCheck width={20} height={20} />
              </span>
            </Card>
            <Card accent="warning" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Retards</span>
                <span className="ds-stat-value">{stats.late}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <Clock width={20} height={20} />
              </span>
            </Card>
            <Card accent="danger" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Absences non justifiées</span>
                <span className="ds-stat-value">{stats.absent}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <TrendingDown width={20} height={20} />
              </span>
            </Card>
            <Card accent="info" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Absences excusées</span>
                <span className="ds-stat-value">{stats.excused}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <ShieldCheck width={20} height={20} />
              </span>
            </Card>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={64} className="rounded-lg" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="text-center" accent="info">
          <ClipboardCheck className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun appel enregistré</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {filtered ? 'Aucune séance ne correspond à ces filtres.' : emptyText}
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border px-4 py-3">
            <strong className="font-display text-ds-text">Historique des séances</strong>
            <span className="flex items-center gap-3">
              {paginated && sessions.length > PAGE_SIZES[0] && (
                <label className="flex items-center gap-2 text-[.78rem] text-ds-text-secondary">
                  Afficher
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={setPageSize}
                    options={PAGE_SIZES.map((n) => ({ value: n, label: `${n}` }))}
                    style={{ width: 76 }}
                    aria-label="Nombre de séances par page"
                  />
                </label>
              )}
              <span className="ds-badge ds-badge-neutral">{sessions.length}</span>
            </span>
          </div>
          <ul className="ds-course-list p-2">
            {visible.map((s: any) => {
              const badge = ATTENDANCE_BADGE[s.status as AttendanceStatus] ?? {
                label: s.status,
                kind: 'neutral' as const,
              };
              return (
                <li key={s.id} className="ds-course-item">
                  <span className="ds-course-time">
                    {dayjs(s.date).format('DD/MM')}
                    <span>{s.startTime || `Séance ${s.sessionNumber}`}</span>
                  </span>
                  <span className="ds-course-main">
                    <strong>{s.subject?.name || 'Matière'}</strong>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="ds-seance-badge">Séance {s.sessionNumber}</span>
                      {s.teacher && (
                        <span className="inline-flex items-center gap-1">
                          <User width={11} height={11} aria-hidden />
                          {s.teacher.first_name} {s.teacher.last_name}
                        </span>
                      )}
                      {s.class?.name ? <span>· {s.class.name}</span> : null}
                    </span>
                    {s.excuse ? (
                      <span className="mt-1 block text-[.78rem] italic text-ds-text-tertiary">
                        « {s.excuse} »
                      </span>
                    ) : null}
                  </span>
                  <StatusBadge status={badge.kind}>{badge.label}</StatusBadge>
                </li>
              );
            })}
          </ul>
          {paginated && sessions.length > pageSize && (
            <div className="ds-pager border-t border-ds-border px-4 py-3" style={{ marginTop: 0 }}>
              <Button variant="secondary" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                Précédent
              </Button>
              <span className="text-sm text-ds-text-secondary">
                <span className="font-mono">{from}</span>–<span className="font-mono">{to}</span> sur{' '}
                <span className="font-mono">{sessions.length}</span>
                {' · '}page <span className="font-mono">{current}</span> / <span className="font-mono">{totalPages}</span>
              </span>
              <Button variant="secondary" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
                Suivant
              </Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
