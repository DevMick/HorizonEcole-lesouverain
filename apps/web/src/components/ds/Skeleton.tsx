import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Forme prédéfinie : ligne de texte ou bloc carte. Sinon dimensionner via className/style. */
  variant?: 'line' | 'card' | 'custom';
  width?: number | string;
  height?: number | string;
}

/**
 * Squelette de chargement avec shimmer (§5.6). Toujours calqué sur la forme
 * du contenu final pour éviter le saut de mise en page.
 */
export function Skeleton({ variant = 'custom', width, height, className, style, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'ds-skeleton',
        variant === 'line' && 'ds-skel-line',
        variant === 'card' && 'ds-skel-card',
        className,
      )}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}
