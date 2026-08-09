import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div>
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-ds-text-secondary">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
