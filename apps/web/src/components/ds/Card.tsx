import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

type AccentColor = 'role' | 'success' | 'warning' | 'danger' | 'info';

const ACCENT_VAR: Record<Exclude<AccentColor, 'role'>, string> = {
  success: 'var(--success-500)',
  warning: 'var(--amber-500)',
  danger: 'var(--danger-500)',
  info: 'var(--info-500)',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Languette signature 4px (§5.4). `true` = accent de rôle ; sinon couleur sémantique. */
  accent?: boolean | AccentColor;
  /** Élévation + translation au survol pour les cartes cliquables (§5.4). */
  hover?: boolean;
  /** Padding interne 20px (16px mobile). Défaut true. */
  padded?: boolean;
  as?: React.ElementType;
}

/**
 * Carte du design system « Encre & Craie » (§5.4).
 * Standard, à languette (`accent`) et interactive (`hover`).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { accent, hover, padded = true, as, className, style, children, ...rest },
  ref,
) {
  const Comp = (as ?? 'div') as React.ElementType;
  const accentColor =
    accent && accent !== true && accent !== 'role' ? ACCENT_VAR[accent] : undefined;

  return (
    <Comp
      ref={ref}
      className={cn(
        'ds-card',
        padded && 'ds-card-pad',
        accent && 'ds-card-accent',
        hover && 'ds-card-hover',
        className,
      )}
      style={accentColor ? ({ ['--ds-accent' as string]: accentColor, ...style }) : style}
      {...rest}
    >
      {children}
    </Comp>
  );
});

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ds-card-header', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('ds-card-title', className)} {...rest} />;
}
