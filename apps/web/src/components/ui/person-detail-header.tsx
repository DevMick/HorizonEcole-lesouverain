import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface PersonDetailHeaderProps {
  initials: string;
  name: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PersonDetailHeader({
  initials,
  name,
  subtitle,
  action,
  className,
}: PersonDetailHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-role-gradient text-xl font-bold text-white"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
