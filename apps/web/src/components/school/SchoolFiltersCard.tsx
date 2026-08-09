import { Select } from 'antd';
import { Card } from '../ds';

export interface SchoolFiltersCardProps {
  years: any[];
  yearId: string;
  onYearChange: (id: string) => void;
  semesters?: any[];
  semesterId?: string;
  onSemesterChange?: (id: string | undefined) => void;
  subjects?: { id: string; name: string }[];
  subjectId?: string;
  onSubjectChange?: (id: string | undefined) => void;
}

/**
 * Filtres communs aux espaces Parent et Élève : année scolaire, trimestre,
 * matière. Le trimestre et la matière sont facultatifs (« Toute l'année »,
 * « Toutes les matières ») — on n'oblige jamais à filtrer pour voir quelque
 * chose, contrairement aux écrans d'administration où la sélection est requise.
 */
export function SchoolFiltersCard({
  years,
  yearId,
  onYearChange,
  semesters,
  semesterId,
  onSemesterChange,
  subjects,
  subjectId,
  onSubjectChange,
}: SchoolFiltersCardProps) {
  const columns = 1 + (onSemesterChange ? 1 : 0) + (onSubjectChange ? 1 : 0);

  return (
    <Card className="mb-4">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        <label className="ds-field">
          <span>Année scolaire</span>
          <Select
            placeholder="Sélectionner…"
            value={yearId || undefined}
            onChange={onYearChange}
            options={(years || []).map((y: any) => ({
              value: y.id,
              label: `${y.name}${y.isCurrent ? ' (En cours)' : ''}`,
            }))}
            style={{ width: '100%' }}
          />
        </label>

        {onSemesterChange && (
          <label className="ds-field">
            <span>Trimestre</span>
            <Select
              allowClear
              placeholder="Toute l'année"
              value={semesterId}
              onChange={(v) => onSemesterChange(v)}
              options={(semesters || []).map((s: any) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
        )}

        {onSubjectChange && (
          <label className="ds-field">
            <span>Matière</span>
            <Select
              allowClear
              placeholder="Toutes les matières"
              value={subjectId}
              onChange={(v) => onSubjectChange(v)}
              options={(subjects || []).map((s) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
        )}
      </div>
    </Card>
  );
}
