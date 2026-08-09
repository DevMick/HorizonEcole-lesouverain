import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Bouton du design system « Encre & Craie » (§5.1).
 * Variantes primary/secondary/ghost/outline/danger, tailles sm/md/lg,
 * états default→hover→active→focus-visible→disabled, support icône + loading.
 * L'accent (primary/outline) suit le rôle via --role-accent.
 */
const button = cva('ds-btn', {
  variants: {
    variant: {
      primary: 'ds-btn-primary',
      secondary: 'ds-btn-secondary',
      ghost: 'ds-btn-ghost',
      outline: 'ds-btn-outline',
      danger: 'ds-btn-danger',
    },
    size: {
      sm: 'ds-btn-sm',
      md: '',
      lg: 'ds-btn-lg',
    },
    block: { true: 'ds-btn-block' },
    iconOnly: { true: 'ds-btn-icon' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean;
  /** Icône affichée avant le libellé (ou seule si iconOnly). */
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, iconOnly, loading, icon, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(button({ variant, size, block, iconOnly }), className)}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {!iconOnly && children}
    </button>
  );
});
