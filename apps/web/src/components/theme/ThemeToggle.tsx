import { Moon, Sun } from 'lucide-react';
import { Button, Tooltip } from 'antd';
import { useThemeStore, type ThemeMode } from '../../lib/stores/theme-store';
import { cn } from '../../lib/utils';

const MODE_ORDER: ThemeMode[] = ['light', 'dark'];

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Mode clair',
  dark: 'Mode sombre',
};

const MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const cycleMode = () => {
    const currentIndex = MODE_ORDER.indexOf(mode);
    const nextMode = MODE_ORDER[(currentIndex + 1) % MODE_ORDER.length];
    setMode(nextMode);
  };

  const Icon = MODE_ICONS[mode];

  return (
    <Tooltip title={MODE_LABELS[mode]}>
      <Button
        type="text"
        className={cn('header-action-button', className)}
        onClick={cycleMode}
        aria-label={`Thème actuel : ${MODE_LABELS[mode]}. Cliquer pour changer.`}
        icon={<Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
        style={{
          border: 'none',
          boxShadow: 'none',
          width: 42,
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
        }}
      />
    </Tooltip>
  );
}
