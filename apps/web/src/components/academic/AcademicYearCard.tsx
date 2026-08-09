import { Button, Popconfirm, Tag } from 'antd';
import { Calendar, CheckCircle, Eye, Plus, Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/glass-card';

export interface AcademicYearCardProps {
  name: string;
  isCurrent?: boolean;
  semestersCount?: number;
  onSetCurrent: () => void;
  onViewDetails: () => void;
  onCreateSemester: () => void;
  onDelete: () => void;
  setCurrentLoading?: boolean;
}

export function AcademicYearCard({
  name,
  isCurrent,
  semestersCount,
  onSetCurrent,
  onViewDetails,
  onCreateSemester,
  onDelete,
  setCurrentLoading,
}: AcademicYearCardProps) {
  return (
    <GlassCard
      variant="gradient"
      hover
      className="h-full overflow-hidden relative"
      styles={{ body: { padding: 20 } }}
    >
      <div className="relative z-10 flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2">
                <Calendar className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Année scolaire
                </div>
                <div className="mt-0.5 text-lg font-semibold leading-tight flex items-center gap-2">
                  {name}
                  {semestersCount !== undefined && (
                    <Tag
                      style={{
                        margin: 0,
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: 'rgba(255, 255, 255, 0.85)',
                        fontWeight: 500,
                        borderRadius: '9999px',
                        fontSize: '0.65rem',
                        lineHeight: '1.2rem'
                      }}
                    >
                      {semestersCount} trimestre{semestersCount !== 1 ? 's' : ''}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
            {isCurrent && (
              <Tag
                color="success"
                style={{
                  background: 'rgba(16, 185, 129, 0.18)',
                  borderColor: 'rgba(16, 185, 129, 0.5)',
                  color: '#bbf7d0',
                  fontWeight: 500,
                }}
              >
                En cours
              </Tag>
            )}
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2">
            <Button
              type="default"
              aria-label={`Voir les trimestres de ${name}`}
              icon={<Eye className="h-4 w-4" aria-hidden="true" />}
              onClick={onViewDetails}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:border-white/40"
              title="Voir les détails"
            />
            <Button
              type="default"
              aria-label={`Créer un trimestre pour ${name}`}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={onCreateSemester}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:border-white/40"
              title="Créer un trimestre"
            />
            {!isCurrent && (
              <Button
                type="default"
                aria-label={`Définir ${name} comme année en cours`}
                icon={<CheckCircle className="h-4 w-4" aria-hidden="true" />}
                onClick={onSetCurrent}
                loading={setCurrentLoading}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 hover:border-white/40"
                title="Définir comme année en cours"
              />
            )}
            <Popconfirm
              title="Supprimer cette année ?"
              description="Cette action est irréversible."
              onConfirm={onDelete}
              okText="Supprimer"
              cancelText="Annuler"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="default"
                danger
                aria-label={`Supprimer ${name}`}
                icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300/40 bg-red-500/15 text-red-50 hover:bg-red-500/35 hover:border-red-300/70"
              />
            </Popconfirm>
          </div>
        </div>

        {/* Motifs décoratifs */}
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-white/10" />
    </GlassCard>
  );
}


