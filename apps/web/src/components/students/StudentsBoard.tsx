import { Select } from 'antd';
import { Eye, Grid3x3, GraduationCap, List as ListIcon, Pencil, School, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Button, Card, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export interface StudentRow {
  id: string;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
  gender?: string;
  status?: string;
  isStateAssigned?: boolean;
  class?: { id: string; name: string } | null;
}
export interface ClassOpt { id: string; name: string }
export interface AcademicYearOpt { id: string; name: string; isCurrent?: boolean }

export interface StudentsBoardProps {
  students: StudentRow[];
  total: number;
  loading?: boolean;
  statsLoading?: boolean;
  totalStudentsStat: number;
  activeClassesStat: number;
  search: string;
  onSearchChange: (v: string) => void;
  classId: string;
  onClassChange: (v: string) => void;
  academicYearId: string;
  onAcademicYearChange: (v: string) => void;
  academicYears: AcademicYearOpt[];
  classes: ClassOpt[];
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  onNew: () => void;
  onView: (s: StudentRow) => void;
  onEdit: (s: StudentRow) => void;
  onDelete: (s: StudentRow) => void;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

function CardActions({ s, onView, onEdit, onDelete }: { s: StudentRow; onView: (s: StudentRow) => void; onEdit: (s: StudentRow) => void; onDelete: (s: StudentRow) => void }) {
  return (
    <span className="ds-student-actions" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" iconOnly icon={<Eye aria-hidden />} aria-label="Voir la fiche" onClick={() => onView(s)} />
      <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" onClick={() => onEdit(s)} />
      <Button variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label="Supprimer" onClick={() => onDelete(s)} />
    </span>
  );
}

/**
 * Liste des élèves (§9.3) — présentation pure « Encre & Craie ».
 * Recherche + filtres (classe, année scolaire), bascule grille/liste, cartes
 * élève avec icônes d'action (voir/modifier/supprimer) → fiche détail en page
 * dédiée. Un seul bouton d'action primaire.
 */
export function StudentsBoard(props: StudentsBoardProps) {
  const {
    students, total, loading, statsLoading, totalStudentsStat, activeClassesStat,
    search, onSearchChange, classId, onClassChange,
    academicYearId, onAcademicYearChange, academicYears, classes,
    view, onViewChange, page, pageSize, onPageChange, onPageSizeChange, onNew, onView, onEdit, onDelete,
  } = props;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const scopedYearLabel = academicYearId ? (academicYears.find((y) => y.id === academicYearId)?.name || 'année sélectionnée') : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Élèves</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">{total} élève{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}.</p>
        </div>
        <Button icon={<UserPlus aria-hidden />} onClick={onNew}>Nouvel élève</Button>
      </div>

      {/* Stat-cards */}
      <div className="ds-stat-grid mb-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {statsLoading ? (
          <><Skeleton height={92} className="rounded-lg" /><Skeleton height={92} className="rounded-lg" /></>
        ) : (
          <>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">{scopedYearLabel ? `Inscrits — ${scopedYearLabel}` : 'Total élèves'}</span>
                <span className="ds-stat-value font-mono">{totalStudentsStat}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden><GraduationCap width={20} height={20} /></span>
            </Card>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">{scopedYearLabel ? `Classes actives — ${scopedYearLabel}` : 'Classes actives'}</span>
                <span className="ds-stat-value font-mono">{activeClassesStat}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden><School width={20} height={20} /></span>
            </Card>
          </>
        )}
      </div>

      {/* Filtres */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="ds-field min-w-[220px] flex-1">
            <span>Rechercher</span>
            <span className="ds-input-wrap">
              <Search aria-hidden />
              <input className="ds-input ds-input-search" placeholder="Nom, matricule, contact…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
            </span>
          </label>
          <label className="ds-field w-48">
            <span>Année scolaire</span>
            <Select
              value={academicYearId || undefined}
              placeholder="Toutes"
              allowClear
              onChange={(v) => onAcademicYearChange(v || '')}
              onClear={() => onAcademicYearChange('')}
              options={academicYears.map((y) => ({ value: y.id, label: y.isCurrent ? `${y.name} (en cours)` : y.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field w-44">
            <span>Classe</span>
            <Select
              value={classId || undefined}
              placeholder="Toutes"
              allowClear
              onChange={(v) => onClassChange(v || '')}
              onClear={() => onClassChange('')}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <div className="ds-segment" role="tablist" aria-label="Affichage">
            <button type="button" role="tab" aria-selected={view === 'grid'} className={cn(view === 'grid' && 'ds-seg-active')} onClick={() => onViewChange('grid')} title="Grille"><Grid3x3 width={16} height={16} aria-hidden /></button>
            <button type="button" role="tab" aria-selected={view === 'list'} className={cn(view === 'list' && 'ds-seg-active')} onClick={() => onViewChange('list')} title="Liste"><ListIcon width={16} height={16} aria-hidden /></button>
          </div>
        </div>
      </Card>

      {/* Résultats */}
      {loading ? (
        <div className={view === 'grid' ? 'ds-students-grid' : 'space-y-2'}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={view === 'grid' ? 96 : 56} className="rounded-lg" />)}
        </div>
      ) : students.length === 0 ? (
        <Card className="text-center" accent="info">
          <Users className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun élève</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Aucun élève ne correspond à ces filtres.</p>
        </Card>
      ) : view === 'grid' ? (
        <div className="ds-students-grid">
          {students.map((s) => (
            <Card key={s.id} accent hover className="ds-student-card" onClick={() => onView(s)}>
              <span className="ds-avatar" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>{initials(s.firstName, s.lastName)}</span>
              <span className="ds-student-info">
                <strong className="truncate">{s.lastName} {s.firstName}</strong>
                <span className="ds-student-tags">
                  {s.class?.name && <span className="ds-badge ds-badge-role">{s.class.name}</span>}
                  <CardActions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} />
                </span>
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <Card padded={false}>
          <ul className="ds-students-list">
            {students.map((s) => (
              <li key={s.id} className="ds-student-row" onClick={() => onView(s)}>
                <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>{initials(s.firstName, s.lastName)}</span>
                <span className="ds-student-info flex-1">
                  <strong className="truncate">{s.lastName} {s.firstName}</strong>
                </span>
                {s.class?.name && <span className="ds-badge ds-badge-role">{s.class.name}</span>}
                <CardActions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Pagination */}
      <div className="ds-pager">
        <label className="flex items-center gap-2 text-sm text-ds-text-secondary">
          <span>Par page</span>
          <Select
            value={pageSize}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={[10, 50, 100].map((n) => ({ value: n, label: String(n) }))}
            style={{ width: 80 }}
          />
        </label>
        {total > pageSize && (
          <>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Précédent</Button>
            <span className="text-sm text-ds-text-secondary">Page <span className="font-mono">{page}</span> / <span className="font-mono">{totalPages}</span></span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Suivant</Button>
          </>
        )}
      </div>
    </div>
  );
}
