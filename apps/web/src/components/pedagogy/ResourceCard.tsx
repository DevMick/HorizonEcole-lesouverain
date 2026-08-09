import { Button, Col, Popconfirm } from 'antd';
import type { LucideIcon } from 'lucide-react';
import { Pencil, Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';

export interface ResourceCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onEdit: () => void;
  onDelete: () => void;
  colProps?: any;
  label?: string;
}

export function ResourceCard({ title, subtitle, icon: Icon, onEdit, onDelete, colProps, label }: ResourceCardProps) {
  const defaultColProps = { xs: 24, sm: 12, lg: 8, xl: 8 };
  const mergedColProps = colProps || defaultColProps;

  return (
    <Col {...mergedColProps}>
      <GlassCard
        variant="gradient"
        hover
        className="h-full overflow-hidden relative"
        styles={{ body: { padding: 20 } }}
      >
        <div className="relative z-10 flex h-full flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2">
              <Icon className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              {label && (
                <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  {label}
                </div>
              )}
              <div className="mt-0.5 text-lg font-semibold leading-tight text-white">
                {title}
              </div>
              {subtitle && (
                <div className="mt-0.5 text-sm text-white/70">{subtitle}</div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto flex justify-end gap-2 pt-2">
            <Button
              type="default"
              aria-label={`Modifier ${title}`}
              icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
              onClick={onEdit}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:border-white/40"
              title="Modifier"
            />
            <Popconfirm
              title="Confirmer la suppression ?"
              description="Cette action est irréversible."
              onConfirm={onDelete}
              okText="Supprimer"
              cancelText="Annuler"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="default"
                danger
                aria-label={`Supprimer ${title}`}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300/40 bg-red-500/15 text-red-50 hover:bg-red-500/35 hover:border-red-300/70"
              />
            </Popconfirm>
          </div>
        </div>

        {/* Motif décoratif */}
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-white/10" />
      </GlassCard>
    </Col>
  );
}

