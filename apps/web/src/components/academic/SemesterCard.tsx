import { Button, Col, Popconfirm } from 'antd';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Pencil, Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';

export interface SemesterCardProps {
  name: string;
  academicYearName?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  icon?: LucideIcon;
  onEdit: () => void;
  onDelete: () => void;
}

export function SemesterCard({
  name,
  academicYearName,
  startDate,
  endDate,
  durationDays,
  icon: Icon = Calendar,
  onEdit,
  onDelete,
}: SemesterCardProps) {
  return (
    <Col xs={24} sm={12} lg={8} xl={8}>
      <GlassCard variant="glass" hover className="h-full" styles={{ body: { padding: '20px' } }}>
        <div className="mb-4 border-b border-border pb-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Icon className="h-5 w-5 text-role-primary" aria-hidden="true" />
            {name}
          </div>
        </div>
        <div className="mb-4 space-y-2 text-sm text-muted-foreground">
          {academicYearName && (
            <p>
              <span className="font-medium text-foreground">Année :</span> {academicYearName}
            </p>
          )}
          <p>
            <span className="font-medium text-foreground">Début :</span> {startDate}
          </p>
          <p>
            <span className="font-medium text-foreground">Fin :</span> {endDate}
          </p>
          <p className="rounded-md bg-muted px-3 py-2 text-xs">
            Durée : {durationDays} jours
          </p>
        </div>
        <div className="flex justify-end gap-1 border-t border-border pt-4">
          <Button
            type="text"
            aria-label={`Modifier ${name}`}
            icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            onClick={onEdit}
            className="flex h-10 w-10 items-center justify-center"
          />
          <Popconfirm
            title="Supprimer ce trimestre ?"
            description="Cette action est irréversible."
            onConfirm={onDelete}
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              aria-label={`Supprimer ${name}`}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              className="flex h-10 w-10 items-center justify-center"
            />
          </Popconfirm>
        </div>
      </GlassCard>
    </Col>
  );
}
