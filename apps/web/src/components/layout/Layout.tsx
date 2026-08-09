import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { Bell, ChevronDown, Lock, LogOut } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { useAppNavigation } from '../../lib/navigation/use-app-navigation';
import { AppShell, adaptMenu, getTabbarItems } from '../ds/nav';
import { ThemeToggle } from '../theme/ThemeToggle';
import { ChangePasswordModal } from './ChangePasswordModal';

interface LayoutProps {
  children: React.ReactNode;
}

/** Libellés de rôle FR (interne = enum EN canonique — cf. §13). */
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur',
  TEACHER: 'Enseignant',
  ACCOUNTANT: 'Comptable',
  STUDENT: 'Élève',
  PARENT: 'Parent',
};

export default function Layout({ children }: LayoutProps) {
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { menuItems, selectedKey } = useAppNavigation();
  const sections = useMemo(() => adaptMenu(menuItems), [menuItems]);
  const tabbarItems = useMemo(() => getTabbarItems(user?.role), [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'change-password',
      icon: <Lock className="h-4 w-4" aria-hidden="true" />,
      label: 'Changer le mot de passe',
      onClick: () => setIsChangePasswordModalOpen(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut className="h-4 w-4" aria-hidden="true" />,
      label: 'Déconnexion',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase();
  const roleLabel = ROLE_LABEL[String(user?.role)] ?? user?.role ?? '';

  const sidebarFooter = user && (
    <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
      <button type="button" className="ds-user-chip" aria-label="Menu utilisateur">
        <span className="ds-avatar" style={{ background: 'var(--role-accent)' }}>{initials}</span>
        <span className="ds-user-chip-info">
          <strong>{user.firstName} {user.lastName}</strong>
          <span>{roleLabel}</span>
        </span>
      </button>
    </Dropdown>
  );

  const topbarActions = (
    <>
      <ThemeToggle />
      <button type="button" className="ds-icon-btn" aria-label="Notifications">
        <Bell aria-hidden />
        <span className="ds-dot" />
      </button>
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] py-1 pl-1 pr-2"
          aria-label="Menu utilisateur"
        >
          <span className="ds-avatar ds-avatar-sm" style={{ background: 'var(--role-accent)' }}>{initials}</span>
          <ChevronDown width={14} height={14} className="text-ds-text-tertiary" aria-hidden />
        </button>
      </Dropdown>
    </>
  );

  return (
    <>
      <AppShell
        sections={sections}
        selectedKey={selectedKey}
        tabbarItems={tabbarItems}
        onNavigatePath={(p) => navigate(p)}
        sidebarFooter={sidebarFooter}
        topbarActions={topbarActions}
      >
        {children}
      </AppShell>

      <ChangePasswordModal
        open={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={() => {
          message.success('Mot de passe modifié avec succès ! Veuillez vous reconnecter.');
          setIsChangePasswordModalOpen(false);
          setTimeout(() => {
            logout();
            navigate('/login');
          }, 2000);
        }}
      />
    </>
  );
}
