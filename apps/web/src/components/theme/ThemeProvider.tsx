import { useEffect, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import { useAuthStore } from '../../lib/store';
import { useThemeStore } from '../../lib/stores/theme-store';
import { getAntdTheme } from '../../theme/tokens';
import { withTransitionsSuppressed } from '../../lib/utils';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // Repaint sans transition : évite le figement des couleurs dérivées de
    // var(--role-accent) quand le rôle change (cf. withTransitionsSuppressed).
    withTransitionsSuppressed(() => {
      if (user?.role) {
        document.documentElement.setAttribute('data-role', String(user.role).toLowerCase());
      } else {
        document.documentElement.removeAttribute('data-role');
      }
    });
  }, [user?.role]);

  const antdTheme = useMemo(
    () => getAntdTheme(resolvedMode, user?.role),
    [resolvedMode, user?.role],
  );

  return (
    <ConfigProvider theme={antdTheme} locale={frFR}>
      {children}
    </ConfigProvider>
  );
}
