import { cn } from '../../../lib/utils';
import type { NavSection } from './navModel';

export interface AppSidebarProps {
  sections: NavSection[];
  selectedKey: string;
  brand?: React.ReactNode;
  footer?: React.ReactNode;
  /** Ajoute la classe d'ouverture (tiroir mobile). */
  open?: boolean;
  id?: string;
  onNavigate?: (leaf: { key: string; onClick?: () => void }) => void;
}

/**
 * Barre latérale du design system (§7). Sections toujours dépliées (labels +
 * items), fidèle au prototype. Le passage complet → rail → tiroir est piloté en
 * CSS (index.css) ; ce composant ne rend que le contenu.
 */
export function AppSidebar({ sections, selectedKey, brand, footer, open, id, onNavigate }: AppSidebarProps) {
  return (
    <aside className={cn('ds-sidebar', open && 'ds-open')} id={id}>
      {brand}
      <nav className="ds-nav" aria-label="Navigation principale">
        {sections.map((section, i) => (
          <div key={section.label ?? `s${i}`}>
            {section.label && <div className="ds-nav-group-label">{section.label}</div>}
            {section.items.map((leaf) => {
              const active = leaf.key === selectedKey;
              return (
                <button
                  key={leaf.key}
                  type="button"
                  className={cn('ds-nav-item', active && 'ds-nav-active')}
                  aria-current={active ? 'page' : undefined}
                  title={leaf.label}
                  onClick={() => (onNavigate ? onNavigate(leaf) : leaf.onClick?.())}
                >
                  {leaf.icon}
                  <span className="ds-nav-text">{leaf.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {footer && <div className="ds-sidebar-footer">{footer}</div>}
    </aside>
  );
}
