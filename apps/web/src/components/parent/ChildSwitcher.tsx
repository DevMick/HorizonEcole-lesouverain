import { GraduationCap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fullName, initialsOf, type ParentChild } from '../../lib/hooks/useParentSpace';

export interface ChildSwitcherProps {
  /** Enfants rattachés au parent connecté. */
  items: ParentChild[];
  value: string | null;
  onChange: (id: string) => void;
  /** Rendu compact (une seule ligne, sans libellé de section). */
  compact?: boolean;
}

/**
 * Bascule d'enfant — présente en tête de chaque écran de l'espace Parent.
 *
 * Le parent ne « filtre » pas : il regarde un enfant à la fois. Un seul enfant →
 * une simple carte de contexte (aucun choix à faire, aucun clic parasite) ;
 * plusieurs enfants → des pastilles toujours visibles, la plus fréquente des
 * actions de cet espace devant coûter un seul appui (§7, cibles ≥ 44px).
 */
export function ChildSwitcher({ items, value, onChange, compact }: ChildSwitcherProps) {
  if (items.length === 0) return null;

  const single = items.length === 1;

  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-ds-border bg-ds-elevated p-2',
        compact && 'mb-3',
      )}
      role={single ? undefined : 'tablist'}
      aria-label={single ? undefined : 'Choisir un enfant'}
    >
      {!single && (
        <span className="px-2 text-[.72rem] font-bold uppercase tracking-wide text-ds-text-tertiary">
          Enfant
        </span>
      )}
      {items.map((c) => {
        const active = single || c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role={single ? undefined : 'tab'}
            aria-selected={single ? undefined : active}
            disabled={single}
            onClick={() => onChange(c.id)}
            className={cn(
              'flex min-h-[44px] items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-1.5 text-left transition-[background,border-color,box-shadow] duration-[var(--dur-fast)]',
              'border',
              active
                ? 'border-transparent bg-[var(--role-accent-soft)]'
                : 'border-ds-border bg-transparent hover:bg-ds-subtle',
              single && 'cursor-default',
            )}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[.72rem] font-bold text-white"
              style={{ background: 'var(--role-accent)' }}
              aria-hidden
            >
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                initialsOf(c)
              )}
            </span>
            <span className="flex flex-col leading-tight">
              <strong
                className="text-[.86rem] font-bold"
                style={{ color: active ? 'var(--role-accent-700)' : 'var(--text-primary)' }}
              >
                {fullName(c)}
              </strong>
              <span className="flex items-center gap-1 text-[.74rem] text-ds-text-tertiary">
                <GraduationCap width={11} height={11} aria-hidden />
                {c.class?.name ?? 'Sans classe'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
