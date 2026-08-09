import { CheckCircle2, Clock, XCircle, Info, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type BadgeStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'role';

const STATUS_CLASS: Record<BadgeStatus, string> = {
  success: 'ds-badge-success',
  warning: 'ds-badge-warning',
  danger: 'ds-badge-danger',
  info: 'ds-badge-info',
  neutral: 'ds-badge-neutral',
  role: 'ds-badge-role',
};

const DEFAULT_ICON: Partial<Record<BadgeStatus, React.ReactNode>> = {
  success: <CheckCircle2 aria-hidden />,
  warning: <Clock aria-hidden />,
  danger: <XCircle aria-hidden />,
  info: <Info aria-hidden />,
  neutral: <Circle aria-hidden />,
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
  /** `true` : icône par défaut du statut. `false` : pastille dot. Sinon icône fournie. */
  icon?: React.ReactNode | boolean;
  children: React.ReactNode;
}

/**
 * Badge de statut sémantique (§5.3). Toujours icône/pastille + libellé
 * (jamais la couleur seule — accessibilité §8).
 */
export function StatusBadge({ status, icon, children, className, ...rest }: StatusBadgeProps) {
  const glyph =
    icon === false ? (
      <span className="ds-badge-dot" aria-hidden />
    ) : icon === true || icon === undefined ? (
      DEFAULT_ICON[status]
    ) : (
      icon
    );

  return (
    <span className={cn('ds-badge', STATUS_CLASS[status], className)} {...rest}>
      {glyph}
      {children}
    </span>
  );
}
