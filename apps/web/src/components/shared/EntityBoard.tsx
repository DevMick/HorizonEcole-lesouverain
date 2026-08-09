import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { Button, Card, Modal, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export type BadgeKind = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'role';
const BADGE_CLS: Record<BadgeKind, string> = {
  success: 'ds-badge-success', warning: 'ds-badge-warning', danger: 'ds-badge-danger',
  info: 'ds-badge-info', neutral: 'ds-badge-neutral', role: 'ds-badge-role',
};

export interface EntityCardConfig {
  key: string;
  title: string;
  subtitle?: string;
  badges?: { label: string; kind?: BadgeKind }[];
  meta?: React.ReactNode;
  onClick?: () => void;
  /** Grise le bouton Supprimer pour cette carte (ex. compte protégé) et désactive son clic. */
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
}

export interface EntityBoardProps {
  title: string;
  subtitle?: string;
  icon?: ComponentType<any>;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  items: any[];
  loading?: boolean;
  cardOf: (item: any) => EntityCardConfig;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  /** Actions personnalisées rendues dans la zone d'actions de la carte (avant éditer/supprimer). */
  cardActions?: (item: any) => React.ReactNode;
  deleteLabel?: (item: any) => string;
  emptyTitle?: string;
  emptyText?: string;
  pageSize?: number;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * Liste d'entités générique « Encre & Craie » (§10) : en-tête + action primaire,
 * recherche + filtres optionnels, grille de cartes, pagination, confirmation de
 * suppression, état vide. Réutilisé par tous les modules simples de l'étape 5.
 */
export function EntityBoard(props: EntityBoardProps) {
  const {
    title, subtitle, icon: Icon, primaryLabel, onPrimary, secondaryLabel, onSecondary, search, onSearchChange, searchPlaceholder,
    filters, items, loading, cardOf, onEdit, onDelete, cardActions, deleteLabel, emptyTitle, emptyText, pageSize = 12,
  } = props;

  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  useEffect(() => { setPage(1); }, [items.length, search]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paged = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ds-text-secondary">{subtitle}</p>}
        </div>
        <span className="flex gap-2">
          {secondaryLabel && onSecondary && <Button variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button>}
          {primaryLabel && onPrimary && <Button icon={<span className="text-lg leading-none">+</span>} onClick={onPrimary}>{primaryLabel}</Button>}
        </span>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="ds-field min-w-[220px] flex-1">
            <span>Rechercher</span>
            <span className="ds-input-wrap">
              <Search aria-hidden />
              <input className="ds-input ds-input-search" placeholder={searchPlaceholder || 'Rechercher…'} value={search} onChange={(e) => onSearchChange(e.target.value)} />
            </span>
          </label>
          {filters}
        </div>
      </Card>

      {loading ? (
        <div className="ds-entity-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={84} className="rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <Card className="text-center" accent="info">
          {Icon && <Icon className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />}
          <p className="font-display font-bold text-ds-text">{emptyTitle || 'Aucun élément'}</p>
          <p className="mt-1 text-sm text-ds-text-secondary">{emptyText || 'Aucun résultat pour ces critères.'}</p>
        </Card>
      ) : (
        <>
          <div className="ds-entity-grid">
            {paged.map((item) => {
              const c = cardOf(item);
              return (
                <Card key={c.key} accent hover={!!c.onClick} className={cn('ds-entity-card', c.onClick && 'cursor-pointer')} onClick={c.onClick}>
                  {Icon && <span className="ds-entity-ic" aria-hidden style={{ background: colorFor(c.title) }}><Icon width={18} height={18} /></span>}
                  <span className="ds-entity-main">
                    <strong className="truncate">{c.title}</strong>
                    {c.subtitle && <span className="truncate text-ds-text-tertiary">{c.subtitle}</span>}
                    {c.badges?.length ? (
                      <span className="mt-0.5 flex flex-wrap gap-1.5">
                        {c.badges.map((b, i) => <span key={i} className={cn('ds-badge', BADGE_CLS[b.kind || 'neutral'])}>{b.label}</span>)}
                      </span>
                    ) : null}
                    {c.meta}
                  </span>
                  {(onEdit || onDelete || cardActions) && (
                    <span className="ds-entity-actions" onClick={(e) => e.stopPropagation()}>
                      {cardActions?.(item)}
                      {onEdit && <Button variant="ghost" size="sm" iconOnly icon={<Pencil aria-hidden />} aria-label="Modifier" onClick={() => onEdit(item)} />}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<Trash2 aria-hidden />}
                          aria-label="Supprimer"
                          disabled={c.deleteDisabled}
                          title={c.deleteDisabled ? c.deleteDisabledReason : undefined}
                          onClick={() => setDeleteTarget(item)}
                        />
                      )}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
          {items.length > pageSize && (
            <div className="ds-pager">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <span className="text-sm text-ds-text-secondary">Page <span className="font-mono">{page}</span> / <span className="font-mono">{totalPages}</span></span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmer la suppression"
        width={420}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => { onDelete?.(deleteTarget); setDeleteTarget(null); }}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-ds-text-secondary">
          {deleteTarget ? (deleteLabel ? deleteLabel(deleteTarget) : `« ${cardOf(deleteTarget).title} » sera supprimé.`) : ''} Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}
