import { Card, type CardProps } from 'antd';
import { cn } from '../../lib/utils';

export type GlassCardVariant = 'default' | 'glass' | 'gradient';

export interface GlassCardProps extends Omit<CardProps, 'variant'> {
  variant?: GlassCardVariant;
  hover?: boolean;
}

export function GlassCard({
  variant = 'glass',
  hover = false,
  className,
  bordered,
  classNames,
  styles,
  ...props
}: GlassCardProps) {
  return (
    <Card
      bordered={variant === 'default' ? bordered ?? true : false}
      className={cn(
        'text-card-foreground',
        // Encre & Craie : surfaces DS (le fond suit le thème via l'algorithme Ant Design).
        variant === 'glass' && 'rounded-[20px] border border-ds-border shadow-sm',
        variant === 'default' && 'rounded-[20px] border border-ds-border shadow-sm',
        variant === 'gradient' && 'bg-role-gradient rounded-[20px] border-0 text-white',
        hover && 'transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      classNames={{
        ...classNames,
        header: cn(
          variant === 'gradient' && '[&_.ant-card-head-title]:text-white border-white/20',
          classNames?.header,
        ),
      }}
      styles={{
        ...styles,
        header: variant === 'gradient'
          ? { borderBottom: '1px solid rgba(255,255,255,0.2)', ...styles?.header }
          : styles?.header,
      }}
      {...props}
    />
  );
}
