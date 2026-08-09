import { Select } from 'antd';
import { Eye, Grid3x3, Heart, List as ListIcon, Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Button, Card, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export interface ParentRow {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface ParentsBoardProps {
  parents: ParentRow[];
  total: number;
  loading?: boolean;
  statsLoading?: boolean;
  totalParentsStat: number;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (n: number) => void;
  onNew: () => void;
  onView: (p: ParentRow) => void;
  onEdit: (p: ParentRow) => void;
  onDelete: (p: ParentRow) => void;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

function CardActions({ p, onView, onEdit, onDelete }: { p: ParentRow; onView: (p: ParentRow) => void; onEdit: (p: ParentRow) => void; onDelete: (p: ParentRow) => void }) {
  return (
    <span className="ds-student-actions" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" iconOnly icon={<Eye aria-hidden />} aria-label="Voir la fiche" onClick={() => onView(p)} />
      <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" onClick={() => onEdit(p)} />
      <Button variant="ghost" size="sm" iconOnly icon={<Trash2 aria-hidden />} aria-label="Supprimer" onClick={() => onDelete(p)} />
    </span>
  );
}

/**
 * Liste des parents — présentation pure « Encre & Craie ».
 */
export function ParentsBoard(props: ParentsBoardProps) {
  const {
    parents, total, loading, statsLoading, totalParentsStat,
    search, onSearchChange,
    page, pageSize, onPageChange, onPageSizeChange, onNew, onView, onEdit, onDelete,
  } = props;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Parents</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">{total} parent{total > 1 ? 's' : ''} enregistré{total > 1 ? 's' : ''}.</p>
        </div>
        <Button icon={<UserPlus aria-hidden />} onClick={onNew}>Nouveau parent</Button>
      </div>

      {/* Stat-cards */}
      <div className="ds-stat-grid mb-4" style={{ gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' }}>
        {statsLoading ? (
          <Skeleton height={92} className="rounded-lg" />
        ) : (
          <Card accent className="ds-stat">
            <div className="ds-stat-body">
              <span className="ds-stat-label">Total parents</span>
              <span className="ds-stat-value font-mono">{totalParentsStat}</span>
            </div>
            <span className="ds-stat-medallion" aria-hidden><Users width={20} height={20} /></span>
          </Card>
        )}
      </div>

      {/* Filtres */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="ds-field min-w-[220px] flex-1">
            <span>Rechercher</span>
            <span className="ds-input-wrap">
              <Search aria-hidden />
              <input className="ds-input ds-input-search" placeholder="Nom, contact…" value={search} onChange={(e) => onSearchChange(e.target.value)} />
            </span>
          </label>
        </div>
      </Card>

      {/* Résultats */}
      {loading ? (
        <div className="ds-students-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={96} className="rounded-lg" />)}
        </div>
      ) : parents.length === 0 ? (
        <Card className="text-center" accent="info">
          <Users className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun parent</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Aucun parent ne correspond à ces filtres.</p>
        </Card>
      ) : (
        <div className="ds-students-grid">
          {parents.map((p) => (
            <Card key={p.id} accent hover className="ds-student-card" onClick={() => onView(p)}>
              <span className="ds-avatar" style={{ background: colorFor(p.lastName || p.id) }} aria-hidden>{initials(p.firstName, p.lastName)}</span>
              <span className="ds-student-info">
                <strong className="truncate">{p.lastName} {p.firstName}</strong>
                <span className="ds-student-tags">
                  <CardActions p={p} onView={onView} onEdit={onEdit} onDelete={onDelete} />
                </span>
              </span>
            </Card>
          ))}
        </div>
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
