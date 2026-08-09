import type { LucideIcon } from 'lucide-react';
import { GlassCard } from './glass-card';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  className,
}: StatCardProps) {
  return (
    <GlassCard
      variant="glass"
      hover
      className={cn('relative overflow-hidden', className)}
      styles={{ body: { padding: '24px' } }}
    >
      <div className="flex flex-row items-center justify-between pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-lg p-2 bg-[rgb(var(--role-primary)/0.1)]">
          <Icon className={cn('h-4 w-4 text-role-primary', iconClassName)} aria-hidden="true" />
        </div>
      </div>
      <div className="text-2xl font-bold text-role-primary">{value}</div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgb(var(--role-primary)/0.05)] to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100"
        aria-hidden="true"
      />
    </GlassCard>
  );
}
