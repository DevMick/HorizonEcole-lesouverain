import { ArrowLeft, GraduationCap } from 'lucide-react';
import { Button, Card } from '../ds';

export interface LevelDef { key: string; label: string }

export const COLLEGE_LEVELS: LevelDef[] = [
  { key: '6ème', label: '6ème — Sixième' },
  { key: '5ème', label: '5ème — Cinquième' },
  { key: '4ème', label: '4ème — Quatrième' },
  { key: '3ème', label: '3ème — Troisième (BEPC)' },
];

export const LYCEE_LEVELS: LevelDef[] = [
  { key: '2nde A', label: '2nde A — Littéraire' },
  { key: '2nde C', label: '2nde C — Scientifique' },
  { key: '1ère A', label: '1ère A — Littéraire' },
  { key: '1ère C', label: '1ère C — Sciences exactes' },
  { key: '1ère D', label: '1ère D — Sciences de la nature' },
  { key: 'Tle A', label: 'Tle A — Baccalauréat' },
  { key: 'Tle C', label: 'Tle C — Baccalauréat' },
  { key: 'Tle D', label: 'Tle D — Baccalauréat' },
];

export interface ClassGeneratorPageProps {
  counts: Record<string, number>;
  onCountChange: (levelKey: string, count: number) => void;
  existingCountFor: (levelKey: string) => number;
  onCancel: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  toCreateCount: number;
}

function LevelRow({ level, count, existing, onChange }: { level: LevelDef; count: number; existing: number; onChange: (n: number) => void }) {
  return (
    <div className="ds-coeff-row">
      <span className="ds-coeff-name">
        <GraduationCap width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} />
        <strong>{level.label}</strong>
        {existing > 0 && <span className="ds-badge ds-badge-neutral ml-2">{existing} existante{existing > 1 ? 's' : ''}</span>}
      </span>
      <input
        type="number" min={0} max={20} className="ds-input font-mono ds-coeff-input"
        value={count || 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
        aria-label={`Nombre de divisions — ${level.label}`}
      />
    </div>
  );
}

/**
 * Générateur de classes — crée en masse les divisions numérotées d'un ou
 * plusieurs niveaux (ex. « Sixième » × 3 → Sixième 1, Sixième 2, Sixième 3),
 * sur la base du système ivoirien (collège 6e→3e, lycée 2nde→Tle A/C/D).
 * Les divisions déjà existantes (même nom) sont automatiquement ignorées.
 */
export function ClassGeneratorPage(props: ClassGeneratorPageProps) {
  const { counts, onCountChange, existingCountFor, onCancel, onSubmit, submitting, toCreateCount } = props;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button variant="ghost" size="sm" iconOnly icon={<ArrowLeft aria-hidden />} aria-label="Retour à la liste" onClick={onCancel} />
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Générer les classes</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Indique le nombre de divisions par niveau pour ton établissement — les classes numérotées (ex. Sixième 1, Sixième 2…) sont créées automatiquement.
          </p>
        </div>
      </div>

      <Card padded={false} className="mb-4">
        <div className="ds-coeff-head"><span>Premier cycle — Collège</span><span>Divisions</span></div>
        <div className="ds-coeff-list">
          {COLLEGE_LEVELS.map((l) => (
            <LevelRow key={l.key} level={l} count={counts[l.key] || 0} existing={existingCountFor(l.key)} onChange={(n) => onCountChange(l.key, n)} />
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <div className="ds-coeff-head"><span>Second cycle — Lycée</span><span>Divisions</span></div>
        <div className="ds-coeff-list">
          {LYCEE_LEVELS.map((l) => (
            <LevelRow key={l.key} level={l} count={counts[l.key] || 0} existing={existingCountFor(l.key)} onChange={(n) => onCountChange(l.key, n)} />
          ))}
        </div>
      </Card>

      <div className="ds-sticky-save">
        <span className="ds-save-count flex-1">
          {toCreateCount > 0 ? `${toCreateCount} classe${toCreateCount > 1 ? 's' : ''} à créer` : 'Aucune nouvelle classe à créer'}
        </span>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button loading={submitting} disabled={toCreateCount === 0} onClick={onSubmit}>Générer</Button>
      </div>
    </div>
  );
}
