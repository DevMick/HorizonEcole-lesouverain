import { Menu, Search } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface AppTopbarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onOpenMenu?: () => void;
  /** Zone d'actions à droite (thème, notifications, profil…). */
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

/**
 * Barre supérieure (§7) : hamburger (mobile), titre de page, recherche globale,
 * actions. La recherche est masquée en CSS sur mobile.
 */
export function AppTopbar({
  title,
  subtitle,
  onOpenMenu,
  actions,
  searchPlaceholder = 'Rechercher un élève, une classe…',
  onSearch,
  className,
}: AppTopbarProps) {
  return (
    <header className={cn('ds-topbar', className)}>
      <button type="button" className="ds-hamburger" aria-label="Ouvrir le menu" onClick={onOpenMenu}>
        <Menu width={22} height={22} aria-hidden />
      </button>

      {(title || subtitle) && (
        <div className="ds-page-title-wrap">
          {title && <span className="ds-page-title">{title}</span>}
          {subtitle && <span className="ds-page-sub">{subtitle}</span>}
        </div>
      )}

      <div className="ds-topbar-search" role="search">
        <Search aria-hidden />
        <input
          type="search"
          aria-label="Rechercher dans l'application"
          placeholder={searchPlaceholder}
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>

      <div className="ds-topbar-actions">{actions}</div>
    </header>
  );
}
