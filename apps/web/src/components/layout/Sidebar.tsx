import { Avatar, Dropdown, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { GraduationCap } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  menuItems: MenuProps['items'];
  selectedKey: string;
  openKeys: string[];
  onOpenChange: (keys: string[]) => void;
  userMenuItems: MenuProps['items'];
  showUserProfile?: boolean;
  className?: string;
}

export function Sidebar({
  collapsed,
  menuItems,
  selectedKey,
  openKeys,
  onOpenChange,
  userMenuItems,
  showUserProfile = true,
  className,
}: SidebarProps) {
  const { user } = useAuthStore();
  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`;

  return (
    <div className={cn('flex h-full flex-col overflow-hidden bg-card', className)}>
      {/* Logo */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-border px-4 py-4',
          collapsed ? 'justify-center' : 'justify-start',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
          <GraduationCap className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <span className="truncate text-base font-bold tracking-tight text-foreground">
            HorizonEcole
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={onOpenChange}
          items={menuItems}
          inlineCollapsed={collapsed}
          className="app-sidebar-menu border-none bg-transparent"
        />
      </div>

      {/* User profile */}
      {showUserProfile && user && (
        <div className="shrink-0 border-t border-border p-3">
          <Dropdown menu={{ items: userMenuItems }} placement={collapsed ? 'topRight' : 'topRight'}>
            <button
              type="button"
              className={cn(
                'flex w-full min-h-10 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed && 'justify-center',
              )}
              aria-label="Menu utilisateur"
            >
              <Avatar
                size={collapsed ? 36 : 40}
                className="shrink-0 border-2 border-background"
                style={{ background: 'var(--role-gradient)' }}
              >
                {initials}
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.role}</p>
                </div>
              )}
            </button>
          </Dropdown>
        </div>
      )}
    </div>
  );
}
