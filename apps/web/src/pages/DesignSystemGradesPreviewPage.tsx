import { useEffect, useMemo, useState } from 'react';
import { GradesBoard, type GradeCell, type GradeColumn, type NoteDraft } from '../components/grades/GradesBoard';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation §9.5 (dev only, données fictives) — valide l'UI/interactions Notes. */

const SEMESTERS = [
  { id: 't1', name: '1er Trimestre' },
  { id: 't2', name: '2ème Trimestre' },
  { id: 't3', name: '3ème Trimestre' },
];
const SUBJECTS = [
  { id: 'sub-math', name: 'Mathématiques' },
  { id: 'sub-fr', name: 'Français' },
];
const CLASSES = [
  { id: 'c1', name: '6ème 1' },
  { id: 'c2', name: '5ème 2' },
];
// Colonnes = types d'évaluation pré-configurés (barème + coefficient portés par le type).
const COLUMNS: GradeColumn[] = [
  { id: 'e-dev', name: 'DEVOIR', number: 1, maxNote: 20, coefficient: 1 },
  { id: 'e-interro', name: 'INTERROGATION', number: 1, maxNote: 10, coefficient: 1 },
  { id: 'e-compo', name: 'EXAMEN BLANC', number: 1, maxNote: 20, coefficient: 2 },
];
const NAMES = [
  ['Awa', 'Diop', 'F'], ['Mamadou', 'Ndiaye', 'M'], ['Fatou', 'Sow', 'F'], ['Ibrahima', 'Fall', 'M'],
  ['Aïcha', 'Ba', 'F'], ['Ousmane', 'Diallo', 'M'], ['Mariama', 'Cissé', 'F'], ['Cheikh', 'Gueye', 'M'],
];
const STUDENTS = NAMES.map(([firstName, lastName, gender], i) => ({
  id: `s${i}`, firstName, lastName, gender, studentNumber: `STU-${1001 + i}`,
}));

interface MockGrade extends GradeCell {
  student_id: string;
}
// Notes de départ : Devoir /20 pour tous, Interrogation /10 pour les 6 premiers.
const INITIAL: MockGrade[] = [
  ...STUDENTS.map((s, i) => ({
    id: `g0-${i}`, student_id: s.id, evaluation_type_id: 'e-dev',
    note: 8 + ((i * 3) % 12), max_note: 20,
  })),
  ...STUDENTS.slice(0, 6).map((s, i) => ({
    id: `g1-${i}`, student_id: s.id, evaluation_type_id: 'e-interro',
    note: 4 + ((i * 2) % 6), max_note: 10,
  })),
];

export default function DesignSystemGradesPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [semesterId, setSemesterId] = useState('t1');
  const [subjectId, setSubjectId] = useState('sub-math');
  const [classId, setClassId] = useState('c1');
  const [grades, setGrades] = useState<MockGrade[]>(INITIAL);

  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'teacher');
    return () => document.documentElement.removeAttribute('data-role');
  }, []);
  useEffect(() => {
    withTransitionsSuppressed(() => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    });
  }, [theme]);

  const { matrix, averages } = useMemo(() => {
    const matrix: Record<string, (GradeCell | null)[]> = {};
    const averages: Record<string, number | null> = {};
    STUDENTS.forEach((s) => {
      const g = grades.filter((x) => x.student_id === s.id);
      const row = COLUMNS.map((c) => g.find((x) => x.evaluation_type_id === c.id) ?? null);
      matrix[s.id] = row;
      let tw = 0, tc = 0;
      row.forEach((cell, i) => {
        if (!cell) return;
        const note = typeof cell.note === 'number' ? cell.note : parseFloat(String(cell.note));
        if (Number.isNaN(note)) return;
        const mn = cell.max_note || COLUMNS[i].maxNote || 20;
        tw += ((note / mn) * 20) * (COLUMNS[i].coefficient || 1);
        tc += (COLUMNS[i].coefficient || 1);
      });
      averages[s.id] = tc > 0 ? Math.round((tw / tc) * 100) / 100 : null;
    });
    return { matrix, averages };
  }, [grades]);

  const submitNote = (d: NoteDraft) => {
    setGrades((prev) => {
      if (d.gradeId) {
        return prev.map((g) => (g.id === d.gradeId ? { ...g, note: d.note, max_note: d.maxNote } : g));
      }
      return [...prev, {
        id: `g-${d.studentId}-${d.evaluationTypeId}`, student_id: d.studentId, note: d.note,
        max_note: d.maxNote, evaluation_type_id: d.evaluationTypeId,
      }];
    });
  };

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-6xl justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>
      <GradesBoard
        semesters={SEMESTERS}
        semesterId={semesterId}
        onSemesterChange={setSemesterId}
        activeSemesterId="t1"
        activeSemesterName="1er Trimestre"
        activeSemesterRange="01/10/2025 – 20/12/2025"
        subjects={SUBJECTS}
        subjectId={subjectId}
        onSubjectChange={setSubjectId}
        classes={CLASSES}
        classId={classId}
        onClassChange={setClassId}
        students={STUDENTS}
        columns={COLUMNS}
        matrix={matrix}
        averages={averages}
        filtersReady={!!(semesterId && subjectId && classId)}
        semesterLocked={false}
        onSubmitNote={submitNote}
        onDeleteNote={(id) => setGrades((prev) => prev.filter((g) => g.id !== id))}
      />
    </div>
  );
}
