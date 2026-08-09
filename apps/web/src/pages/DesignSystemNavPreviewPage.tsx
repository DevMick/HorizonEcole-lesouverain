import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useAppNavigation } from '../lib/navigation/use-app-navigation';
import { AppShell, adaptMenu, getTabbarItems, type NavSection } from '../components/ds/nav';
import { Button, Card, CardHeader, CardTitle, StatusBadge } from '../components/ds';
import { withTransitionsSuppressed } from '../lib/utils';

type Role = 'ADMIN' | 'TEACHER';

/**
 * Prévisualisation de la coquille de navigation (§7) — dev only, sans auth.
 * Injecte un utilisateur fictif pour exercer le VRAI menu par rôle (via
 * useAppNavigation) et neutralise la navigation réelle (sélection locale).
 */
export default function DesignSystemNavPreviewPage() {
  const [role, setRole] = useState<Role>('ADMIN');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedKey, setSelectedKey] = useState('/dashboard');

  // Utilisateur fictif → alimente useAppNavigation + ThemeProvider (data-role).
  useEffect(() => {
    const prev = useAuthStore.getState().user;
    useAuthStore.setState({ user: { firstName: 'Awa', lastName: 'Diop', role } });
    return () => useAuthStore.setState({ user: prev });
  }, [role]);

  useEffect(() => {
    withTransitionsSuppressed(() => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    });
  }, [theme]);

  const { menuItems } = useAppNavigation();

  // Remap : la sélection est locale (pas de navigation réelle en preview).
  const sections: NavSection[] = useMemo(
    () =>
      adaptMenu(menuItems).map((s) => ({
        ...s,
        items: s.items.map((leaf) => ({ ...leaf, onClick: () => setSelectedKey(leaf.key) })),
      })),
    [menuItems],
  );
  const tabbarItems = useMemo(() => getTabbarItems(role), [role]);

  const initials = 'AD';
  const topbarActions = (
    <>
      <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
        <Button size="sm" variant={role === 'ADMIN' ? 'primary' : 'ghost'} onClick={() => setRole('ADMIN')}>Admin</Button>
        <Button size="sm" variant={role === 'TEACHER' ? 'primary' : 'ghost'} onClick={() => setRole('TEACHER')}>Enseignant</Button>
      </div>
      <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
        <Button size="sm" variant={theme === 'light' ? 'primary' : 'ghost'} onClick={() => setTheme('light')}>Clair</Button>
        <Button size="sm" variant={theme === 'dark' ? 'primary' : 'ghost'} onClick={() => setTheme('dark')}>Sombre</Button>
      </div>
      <button type="button" className="ds-icon-btn" aria-label="Notifications"><Bell aria-hidden /><span className="ds-dot" /></button>
      <button type="button" className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] py-1 pl-1 pr-2" aria-label="Menu utilisateur">
        <span className="ds-avatar ds-avatar-sm" style={{ background: 'var(--role-accent)' }}>{initials}</span>
        <ChevronDown width={14} height={14} className="text-ds-text-tertiary" aria-hidden />
      </button>
    </>
  );

  const sidebarFooter = (
    <button type="button" className="ds-user-chip" aria-label="Menu utilisateur">
      <span className="ds-avatar" style={{ background: 'var(--role-accent)' }}>{initials}</span>
      <span className="ds-user-chip-info">
        <strong>Awa Diop</strong>
        <span>{role === 'ADMIN' ? 'Administrateur' : 'Enseignant'}</span>
      </span>
    </button>
  );

  return (
    <AppShell
      sections={sections}
      selectedKey={selectedKey}
      tabbarItems={tabbarItems}
      onNavigatePath={setSelectedKey}
      sidebarFooter={sidebarFooter}
      topbarActions={topbarActions}
      title="Navigation"
      subtitle="Aperçu §7 — sidebar / rail / tiroir + tabbar"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Coquille de navigation</h1>
          <StatusBadge status="role" icon={false}>{selectedKey}</StatusBadge>
        </div>
        <p className="text-sm text-ds-text-secondary">
          Redimensionnez la fenêtre : &gt;1024px sidebar complète · 641–1024px rail d'icônes · ≤640px tiroir + tabbar basse.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card accent hover><CardHeader><CardTitle>Contenu</CardTitle></CardHeader><p className="text-sm text-ds-text-secondary">Zone de page rendue dans la coquille.</p></Card>
          <Card><CardHeader><CardTitle>Rôle actif</CardTitle></CardHeader><p className="text-sm text-ds-text-secondary">{role} — menu et accent adaptés.</p></Card>
          <Card accent="info"><CardHeader><CardTitle>Sélection</CardTitle></CardHeader><p className="text-sm text-ds-text-secondary">{selectedKey}</p></Card>
        </div>
      </div>
    </AppShell>
  );
}
