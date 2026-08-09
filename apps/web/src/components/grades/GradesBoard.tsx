import { useEffect, useState } from 'react';
import { BookOpen, Calendar, ListChecks, Users } from 'lucide-react';
import { Select } from 'antd';
import { Card, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export interface GradeCell {
  id: string;
  note: number | string;
  max_note: number;
  evaluation_type_id?: string;
  evaluationType?: { id: string; name: string; coefficient?: number | null } | null;
}
export interface GradeStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  studentNumber?: string;
}
/** Une colonne = un type d'évaluation de l'enseignant (barème + coefficient portés par le type). */
export interface GradeColumn {
  id: string;
  name: string;
  number?: number | null;
  maxNote: number;
  coefficient?: number | null;
}
export interface Opt {
  id: string;
  name: string;
}

/** Charge utile d'une saisie de note (création si pas de `gradeId`, sinon édition). */
export interface NoteDraft {
  studentId: string;
  colIndex: number;
  gradeId?: string;
  evaluationTypeId: string;
  note: number;
  maxNote: number;
}

export interface GradesBoardProps {
  // Filtres
  semesters: Opt[];
  semesterId: string;
  onSemesterChange: (id: string) => void;
  activeSemesterId?: string;
  activeSemesterName?: string;
  activeSemesterRange?: string;
  classes: Opt[];
  classId: string;
  onClassChange: (id: string) => void;
  /** Matières de la classe choisie (la classe pilote la matière). */
  subjects: Opt[];
  subjectId: string;
  onSubjectChange: (id: string) => void;
  // Données
  students: GradeStudent[];
  /** Colonnes = types d'évaluation de l'enseignant (pré-configurées). */
  columns: GradeColumn[];
  /** Par élève, notes indexées par colonne (null = cellule vide). */
  matrix: Record<string, (GradeCell | null)[]>;
  /** Moyenne matière live par élève (formule bulletin), null si aucune note. */
  averages: Record<string, number | null>;
  // États
  loading?: boolean;
  filtersReady: boolean;
  semesterLocked?: boolean;
  saving?: boolean;
  // Actions
  onSubmitNote: (draft: NoteDraft) => void;
  onDeleteNote: (gradeId: string) => void;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
function sexeShort(g?: string) {
  if (!g) return '—';
  if (['M', 'MALE', 'Masculin'].includes(g)) return 'M';
  if (['F', 'FEMALE', 'Féminin'].includes(g)) return 'F';
  return g;
}
const colLabel = (c: GradeColumn) => (c.number != null ? `${c.name} N°${c.number}` : c.name);

interface NoteCellProps {
  rowIndex: number;
  colIndex: number;
  col: GradeColumn;
  grade: GradeCell | null;
  studentId: string;
  disabled?: boolean;
  onSave: (draft: NoteDraft) => void;
  onDelete: (gradeId: string) => void;
}

/**
 * Cellule de saisie inline : on tape la note directement dans la colonne.
 * Sauvegarde au blur ou sur Entrée (Entrée déplace le focus sur l'élève suivant).
 * Vider une cellule remplie supprime la note. Barème et coefficient viennent du type.
 */
function NoteCell({ rowIndex, colIndex, col, grade, studentId, disabled, onSave, onDelete }: NoteCellProps) {
  const persisted = grade ? String(grade.note) : '';
  const [val, setVal] = useState(persisted);
  const [err, setErr] = useState(false);

  // Resynchronise quand la note persistée change (refetch, suppression…).
  useEffect(() => {
    setVal(grade ? String(grade.note) : '');
    setErr(false);
  }, [grade?.id, grade?.note]);

  const commit = () => {
    const raw = val.trim().replace(',', '.');
    if (raw === '') {
      if (grade) onDelete(grade.id); // cellule vidée → suppression
      setErr(false);
      return;
    }
    const note = parseFloat(raw);
    if (Number.isNaN(note) || note < 0 || note > col.maxNote) { setErr(true); return; }
    setErr(false);
    if (grade && Number(grade.note) === note) return; // inchangé
    onSave({ studentId, colIndex, gradeId: grade?.id, evaluationTypeId: col.id, note, maxNote: col.maxNote });
  };

  const goNext = () => {
    const next = document.getElementById(`note-${rowIndex + 1}-${colIndex}`) as HTMLInputElement | null;
    if (next) next.focus(); // le blur de la cellule courante déclenche la sauvegarde
    else (document.getElementById(`note-${rowIndex}-${colIndex}`) as HTMLInputElement | null)?.blur();
  };

  return (
    <input
      id={`note-${rowIndex}-${colIndex}`}
      className={cn('ds-note-input', grade && !err && 'ds-note-input-filled', err && 'ds-note-input-error')}
      inputMode="decimal"
      disabled={disabled}
      value={val}
      placeholder={`/${col.maxNote}`}
      aria-label={`Note ${colLabel(col)}`}
      title={err ? `La note doit être comprise entre 0 et ${col.maxNote}.` : undefined}
      onChange={(e) => { setVal(e.target.value); if (err) setErr(false); }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); goNext(); }
        else if (e.key === 'Escape') { setVal(persisted); setErr(false); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

/**
 * Saisie des notes (§9.5 / §5.13) — présentation pure, restylée « Encre & Craie ».
 * Chaque colonne correspond à un type d'évaluation de l'enseignant, déjà paramétré
 * (barème « Note sur » + coefficient). La saisie se fait DIRECTEMENT dans la cellule :
 * type, barème et coefficient viennent de la configuration du type. Moyenne matière
 * live (note ramenée sur /20, pondérée par le coefficient — formule identique au bulletin).
 */
export function GradesBoard(props: GradesBoardProps) {
  const {
    semesters, semesterId, onSemesterChange, activeSemesterId, activeSemesterName, activeSemesterRange,
    classes, classId, onClassChange, subjects, subjectId, onSubjectChange,
    students, columns, matrix, averages,
    loading, filtersReady, semesterLocked,
    onSubmitNote, onDeleteNote,
  } = props;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Saisie des notes</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Une colonne par type d'évaluation configuré — saisissez la note directement dans la cellule
          (<kbd className="ds-kbd">Entrée</kbd> pour passer à l'élève suivant). Moyenne recalculée en direct.
        </p>
      </div>

      {activeSemesterName && (
        <Card className="mb-4" accent="info">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Calendar width={16} height={16} aria-hidden className="text-ds-text-secondary" />
            <strong className="text-ds-text">Trimestre actif : {activeSemesterName}</strong>
            {activeSemesterRange && <span className="text-ds-text-secondary">({activeSemesterRange})</span>}
          </div>
        </Card>
      )}

      {/* Filtres */}
      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="ds-field">
            <span>Trimestre</span>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={semesterId || undefined}
              onChange={onSemesterChange}
              placeholder="Sélectionnez un trimestre"
              options={semesters.map((s) => ({
                value: s.id,
                label: `${s.name}${s.id === activeSemesterId ? ' (Actif)' : ''}`,
              }))}
            />
          </label>
          <label className="ds-field">
            <span>Classe</span>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={classId || undefined}
              onChange={onClassChange}
              disabled={!classes.length}
              placeholder="Sélectionnez une classe"
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
            />
          </label>
          <label className="ds-field">
            <span>Matière</span>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={subjectId || undefined}
              onChange={onSubjectChange}
              disabled={!classId}
              placeholder="Sélectionnez une matière"
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </label>
        </div>
        {semesterLocked && (
          <p className="mt-3 inline-flex items-center gap-2">
            <span className="ds-badge ds-badge-warning">Trimestre terminé · lecture seule</span>
          </p>
        )}
      </Card>

      {/* Grille */}
      {!filtersReady ? (
        <Card className="text-center" accent="info">
          <BookOpen className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Sélectionnez les filtres</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Choisissez le trimestre, la classe et la matière pour commencer.</p>
        </Card>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={48} className="rounded-lg" />)}
        </div>
      ) : students.length === 0 ? (
        <Card className="text-center" accent="warning">
          <Users className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun élève dans cette classe</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Vérifiez que des élèves y sont inscrits.</p>
        </Card>
      ) : columns.length === 0 ? (
        <Card className="text-center" accent="info">
          <ListChecks className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun type d'évaluation configuré</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Créez d'abord vos types d'évaluation (Évaluations → Types) : chacun deviendra une colonne de notes ici.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="ds-grades-toolbar">
            <span className="text-sm font-semibold text-ds-text">
              Colonnes de notes : <span className="font-mono">{columns.length}</span>
              <span className="ml-2 font-normal text-ds-text-tertiary">(issues de vos types d'évaluation)</span>
            </span>
          </div>
          <div className="ds-grades-wrap">
            <table className="ds-grades-table">
              <thead>
                <tr>
                  <th className="ds-gt-num">N°</th>
                  <th className="ds-gt-name">Élève</th>
                  <th className="ds-gt-sexe">Sexe</th>
                  {columns.map((c) => (
                    <th key={c.id} className="ds-gt-note">
                      <span className="ds-gt-note-k">{colLabel(c)}</span>
                      <span className="ds-gt-note-type">
                        /{c.maxNote}{(c.coefficient ?? 1) > 1 ? ` · ×${c.coefficient}` : ''}
                      </span>
                    </th>
                  ))}
                  <th className="ds-gt-avg">Moy.<span className="ds-gt-note-type">/20</span></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  const avg = averages[s.id];
                  return (
                    <tr key={s.id}>
                      <td className="ds-gt-num font-mono">{idx + 1}</td>
                      <td className="ds-gt-name">
                        <span className="flex items-center gap-2.5">
                          <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>
                            {initials(s.firstName, s.lastName)}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-[.86rem] text-ds-text">{s.lastName} {s.firstName}</strong>
                          </span>
                        </span>
                      </td>
                      <td className="ds-gt-sexe font-mono">{sexeShort(s.gender)}</td>
                      {columns.map((c, i) => (
                        <td key={c.id} className="ds-gt-note">
                          <NoteCell
                            rowIndex={idx}
                            colIndex={i}
                            col={c}
                            grade={matrix[s.id]?.[i] ?? null}
                            studentId={s.id}
                            disabled={semesterLocked}
                            onSave={onSubmitNote}
                            onDelete={onDeleteNote}
                          />
                        </td>
                      ))}
                      <td className="ds-gt-avg">
                        <span className={cn('ds-grade-avg', avg != null && (avg >= 10 ? 'ds-avg-pass' : 'ds-avg-fail'))}>
                          {avg != null ? avg.toFixed(2) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
