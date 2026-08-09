import { Avatar, Badge, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Bell, Menu, Search } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { ThemeToggle } from '../theme/ThemeToggle';
import { cn } from '../../lib/utils';

interface AppHeaderProps {
  isMobile: boolean;
  onOpenMobileMenu: () => void;
  userMenuItems: MenuProps['items'];
  className?: string;
}

export function AppHeader({
  isMobile,
  onOpenMobileMenu,
  userMenuItems,
  className,
}: AppHeaderProps) {
  const { user } = useAuthStore();
  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`;

  return (
    <header
      className={cn(
        'sticky top-0 z-[1000] flex h-12 min-h-12 items-center justify-between border-b border-border px-4 md:px-6',
        'glass backdrop-blur-md',
        className,
      )}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button
            type="text"
            aria-label="Ouvrir le menu de navigation"
            onClick={onOpenMobileMenu}
            icon={<Menu className="h-5 w-5" aria-hidden="true" />}
            className="flex h-10 w-10 items-center justify-center"
          />
        )}

        {!isMobile && (
          <div className="relative hidden sm:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Rechercher..."
              aria-label="Rechercher dans l'application"
              className={cn(
                'h-9 w-56 rounded-lg border border-border bg-muted/50 pl-9 pr-3 text-sm',
                'text-foreground placeholder:text-muted-foreground',
                'focus:border-ring focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/30',
              )}
            />
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Badge count={3} size="small" offset={[-4, 4]}>
          <Button
            type="text"
            aria-label="Notifications (3 non lues)"
            icon={<Bell className="h-[18px] w-[18px]" aria-hidden="true" />}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        </Badge>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <button
            type="button"
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-2 py-1',
              'transition-colors hover:border-border hover:bg-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Menu utilisateur"
          >
            <Avatar size={32} className="shrink-0" style={{ background: 'var(--role-gradient)' }}>
              {initials}
            </Avatar>
            {!isMobile && user && (
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-foreground">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">{user.role}</p>
              </div>
            )}
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
