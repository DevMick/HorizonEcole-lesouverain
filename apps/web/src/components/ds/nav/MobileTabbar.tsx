import { Menu } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { TabbarItem } from './navModel';

export interface MobileTabbarProps {
  items: TabbarItem[];
  selectedPath: string;
  onNavigate: (path: string) => void;
  onOpenMenu: () => void;
}

/**
 * Barre d'onglets mobile (§7) : 4 raccourcis de rôle + bouton « Menu » ouvrant
 * le tiroir de navigation. Visible uniquement ≤640px (CSS).
 */
export function MobileTabbar({ items, selectedPath, onNavigate, onOpenMenu }: MobileTabbarProps) {
  return (
    <nav className="ds-tabbar" aria-label="Navigation rapide">
      {items.map((it) => {
        const active = selectedPath === it.path || selectedPath.startsWith(it.path + '/');
        return (
          <button
            key={it.path}
            type="button"
            className={cn(active && 'ds-nav-active')}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(it.path)}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        );
      })}
      <button type="button" onClick={onOpenMenu} aria-label="Ouvrir le menu complet">
        <Menu width={20} height={20} aria-hidden />
        <span>Menu</span>
      </button>
    </nav>
  );
}
