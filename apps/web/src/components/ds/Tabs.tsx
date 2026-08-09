import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Onglets à soulignement animé (§5.7). Contrôlé, accessible au clavier
 * (rôle tablist, flèches gérées par le navigateur via tabindex/roving simple).
 */
export function Tabs({ items, value, onChange, className, ...rest }: TabsProps) {
  const idx = items.findIndex((t) => t.key === value);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + items.length) % items.length;
    onChange(items[next].key);
  }

  return (
    <div role="tablist" className={cn('ds-tabs', className)} onKeyDown={onKeyDown} {...rest}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={cn('ds-tab', active && 'ds-tab-active')}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
