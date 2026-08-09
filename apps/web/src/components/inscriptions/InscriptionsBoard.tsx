import { AlertTriangle, FilePlus, Search, UserCheck, Users } from 'lucide-react';
import { Button, Card, Skeleton } from '../ds';

export interface PendingStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  class?: { id: string; name: string } | null;
}

export interface InscriptionsBoardProps {
  currentYearName?: string;
  hasCurrentYear: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  students: PendingStudent[];
  total: number;
  enrolledCount: number;
  loading?: boolean;
  onNew: () => void;
  onInscribe: (student: PendingStudent) => void;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

/**
 * Inscriptions — page dédiée à une seule tâche : inscrire les élèves qui ne
 * sont pas encore rattachés à une classe pour l'année scolaire en cours.
 * Un élève disparaît de cette liste dès qu'il est inscrit ; il ne réapparaît
 * que si une nouvelle année devient « en cours ».
 */
export function InscriptionsBoard(props: InscriptionsBoardProps) {
  const { currentYearName, hasCurrentYear, search, onSearchChange, students, total, enrolledCount, loading, onNew, onInscribe } = props;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Inscriptions</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {hasCurrentYear ? `Élèves à inscrire pour l'année ${currentYearName} (en cours).` : 'Aucune année scolaire en cours.'}
          </p>
        </div>
        <Button icon={<FilePlus aria-hidden />} onClick={onNew} disabled={!hasCurrentYear}>Nouvelle inscription</Button>
      </div>

      {!hasCurrentYear && (
        <Card className="mb-4" accent="warning">
          <div className="flex items-center gap-3">
            <AlertTriangle width={18} height={18} aria-hidden style={{ color: 'var(--amber-600)' }} />
            <span className="text-sm text-ds-text">Aucune année scolaire « en cours ». Définissez-en une pour inscrire des élèves.</span>
          </div>
        </Card>
      )}

      {hasCurrentYear && (
        <div className="ds-stat-grid mb-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {loading ? (
            <><Skeleton height={92} className="rounded-lg" /><Skeleton height={92} className="rounded-lg" /></>
          ) : (
            <>
              <Card accent className="ds-stat">
                <div className="ds-stat-body">
                  <span className="ds-stat-label">À inscrire</span>
                  <span className="ds-stat-value font-mono">{total}</span>
                </div>
                <span className="ds-stat-medallion" aria-hidden><Users width={20} height={20} /></span>
              </Card>
              <Card accent className="ds-stat">
                <div className="ds-stat-body">
                  <span className="ds-stat-label">Inscrits — {currentYearName}</span>
                  <span className="ds-stat-value font-mono">{enrolledCount}</span>
                </div>
                <span className="ds-stat-medallion" aria-hidden><UserCheck width={20} height={20} /></span>
              </Card>
            </>
          )}
        </div>
      )}

      <Card className="mb-4">
        <label className="ds-field max-w-md">
          <span>Rechercher</span>
          <span className="ds-input-wrap">
            <Search aria-hidden />
            <input className="ds-input ds-input-search" placeholder="Nom ou matricule…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </span>
        </label>
      </Card>

      {loading ? (
        <div className="ds-students-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={96} className="rounded-lg" />)}
        </div>
      ) : !hasCurrentYear ? null : students.length === 0 ? (
        <Card className="text-center" accent="success">
          <UserCheck className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Tous les élèves sont inscrits</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Aucun élève en attente d'inscription pour {currentYearName}.</p>
        </Card>
      ) : (
        <div className="ds-students-grid">
          {students.map((s) => (
            <Card key={s.id} accent hover className="ds-student-card" onClick={() => onInscribe(s)}>
              <span className="ds-avatar" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>{initials(s.firstName, s.lastName)}</span>
              <span className="ds-student-info">
                <strong className="truncate">{s.lastName} {s.firstName}</strong>
                <span className="ds-student-tags">
                  {s.class?.name && <span className="ds-badge ds-badge-neutral">Anc. {s.class.name}</span>}
                </span>
              </span>
              <span className="ds-student-actions" onClick={(e) => e.stopPropagation()}>
                <Button variant="secondary" size="sm" onClick={() => onInscribe(s)}>Inscrire</Button>
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
