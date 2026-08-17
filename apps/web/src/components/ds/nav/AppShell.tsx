import { useEffect, useState } from 'react';
import { cn } from '../../../lib/utils';
import { BrandName } from '../BrandName';
import logoHorizonEcole from '../../../assets/images/logo-horizonecole.png';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import { MobileTabbar } from './MobileTabbar';
import type { NavSection, TabbarItem } from './navModel';

export interface AppShellProps {
  sections: NavSection[];
  selectedKey: string;
  tabbarItems: TabbarItem[];
  onNavigatePath: (path: string) => void;
  /** Pied de sidebar (chip utilisateur / menu profil). */
  sidebarFooter?: React.ReactNode;
  /** Actions de la topbar (thème, notifications, profil). */
  topbarActions?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  brandTitle?: string;
  brandSubtitle?: string;
  children: React.ReactNode;
}

/**
 * Coquille applicative « Encre & Craie » (§7) : sidebar complète > rail
 * tablette > tiroir + tabbar mobile. Le responsive structurel est en CSS ;
 * l'état d'ouverture du tiroir mobile est géré ici.
 */
export function AppShell({
  sections,
  selectedKey,
  tabbarItems,
  onNavigatePath,
  sidebarFooter,
  topbarActions,
  title,
  subtitle,
  brandTitle = 'HorizonEcole',
  brandSubtitle = 'École Le Souverain',
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  // Échap ferme le tiroir mobile.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const brand = (
    <div className="ds-brand">
      <img className="ds-brand-logo" src={logoHorizonEcole} alt="" aria-hidden width={34} height={34} />
      <div className="ds-brand-text">
        {/* brandTitle reste surchargeable ; sans surcharge on rend la marque
            deux tons plutôt qu'un texte monochrome. */}
        <strong>
          {brandTitle === 'HorizonEcole' ? <BrandName /> : brandTitle}
        </strong>
        <span>{brandSubtitle}</span>
      </div>
    </div>
  );

  return (
    <div className="ds-shell">
      <AppSidebar
        id="ds-app-sidebar"
        sections={sections}
        selectedKey={selectedKey}
        brand={brand}
        footer={sidebarFooter}
        open={mobileOpen}
        onNavigate={(leaf) => {
          leaf.onClick?.();
          close();
        }}
      />
      <div
        className={cn('ds-sidebar-scrim', mobileOpen && 'ds-open')}
        onClick={close}
        aria-hidden
      />

      <div className="ds-main">
        <AppTopbar
          title={title}
          subtitle={subtitle}
          actions={topbarActions}
          onOpenMenu={() => setMobileOpen(true)}
        />
        <main className="ds-content">{children}</main>
      </div>

      <MobileTabbar
        items={tabbarItems}
        selectedPath={selectedKey}
        onNavigate={(p) => {
          onNavigatePath(p);
          close();
        }}
        onOpenMenu={() => setMobileOpen(true)}
      />
    </div>
  );
}
