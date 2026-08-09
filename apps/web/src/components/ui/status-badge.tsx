import { AlertCircle, CheckCircle2, Circle, Clock, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export type Status = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const ICONS = {
  success: CheckCircle2,
  warning: Clock,
  error: AlertCircle,
  info: Info,
  neutral: Circle,
} as const;

const STYLES: Record<Status, string> = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  error: 'bg-red-500/15 text-red-700 dark:text-red-400',
  info: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  neutral: 'bg-muted text-muted-foreground',
};

export interface StatusBadgeProps {
  status: Status;
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const Icon = ICONS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
