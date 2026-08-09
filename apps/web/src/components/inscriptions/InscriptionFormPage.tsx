import { Select } from 'antd';
import { Button, Card } from '../ds';

export interface StudentOption { id: string; label: string }
export interface ClassOption { id: string; label: string }

export interface InscriptionFormPageProps {
  yearName?: string;
  hasCurrentYear: boolean;
  studentIds: string[];
  onStudentIdsChange: (ids: string[]) => void;
  classId: string;
  onClassChange: (id: string) => void;
  studentOptions: StudentOption[];
  classOptions: ClassOption[];
  studentsLoading?: boolean;
  onReset: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

/**
 * Inscriptions — la page ne montre QUE l'interface d'inscription (pas de
 * liste, pas de tableau de bord ; ces vues vivent ailleurs). Sélection de
 * plusieurs élèves à la fois pour une même classe. L'année scolaire n'est
 * pas un champ du formulaire — c'est toujours l'année en cours, résolue en
 * arrière-plan par le conteneur.
 */
export function InscriptionFormPage(props: InscriptionFormPageProps) {
  const {
    yearName, hasCurrentYear, studentIds, onStudentIdsChange, classId, onClassChange,
    studentOptions, classOptions, studentsLoading, onReset, onSubmit, submitting,
  } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Inscriptions</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          {hasCurrentYear ? `Inscrivez un ou plusieurs élèves dans une classe pour l'année ${yearName} (en cours).` : "Aucune année scolaire en cours — impossible d'inscrire des élèves."}
        </p>
      </div>

      <Card>
        <label className="ds-field mb-4">
          <span>Élève *</span>
          <Select
            mode="multiple"
            placeholder="Rechercher un ou plusieurs élèves…"
            showSearch
            optionFilterProp="label"
            loading={studentsLoading}
            disabled={!hasCurrentYear}
            value={studentIds}
            onChange={(ids) => onStudentIdsChange(ids)}
            options={studentOptions.map((s) => ({ value: s.id, label: s.label }))}
            style={{ width: '100%' }}
          />
        </label>
        <label className="ds-field">
          <span>Classe *</span>
          <Select
            placeholder="Sélectionner une classe"
            showSearch
            optionFilterProp="label"
            disabled={!hasCurrentYear}
            value={classId || undefined}
            onChange={(v) => onClassChange(v)}
            options={classOptions.map((c) => ({ value: c.id, label: c.label }))}
            style={{ width: '100%' }}
          />
        </label>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">
          {studentIds.length > 0 ? `${studentIds.length} élève${studentIds.length > 1 ? 's' : ''} sélectionné${studentIds.length > 1 ? 's' : ''}` : 'Nouvelle inscription'}
        </span>
        <Button variant="secondary" onClick={onReset} disabled={studentIds.length === 0 && !classId}>Réinitialiser</Button>
        <Button loading={submitting} disabled={!hasCurrentYear || studentIds.length === 0 || !classId} onClick={onSubmit}>
          {studentIds.length > 1 ? 'Inscrire les élèves' : 'Inscrire'}
        </Button>
      </div>
    </div>
  );
}
