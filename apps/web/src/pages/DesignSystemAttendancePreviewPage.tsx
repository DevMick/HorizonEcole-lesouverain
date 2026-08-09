import { useEffect, useState } from 'react';
import { AttendanceBoard, type AttendanceStatus } from '../components/attendance/AttendanceBoard';
import { withTransitionsSuppressed } from '../lib/utils';

const MOCK_CLASSES = [
  { id: 'c1', name: '6ème A' },
  { id: 'c2', name: '5ème B' },
  { id: 'c3', name: '4ème A' },
];
const NAMES = [
  ['Awa', 'Diop'], ['Mamadou', 'Ndiaye'], ['Fatou', 'Sow'], ['Ibrahima', 'Fall'],
  ['Aïcha', 'Ba'], ['Ousmane', 'Diallo'], ['Mariama', 'Cissé'], ['Cheikh', 'Gueye'],
  ['Bineta', 'Sarr'], ['Modou', 'Faye'], ['Khady', 'Mbaye'], ['Seydou', 'Kane'],
];
const MOCK_STUDENTS = NAMES.map(([firstName, lastName], i) => ({
  id: `s${i}`,
  firstName,
  lastName,
  studentNumber: `STU-${String(1001 + i)}`,
}));

/** Prévisualisation §9.6 (dev only, données fictives) — valide l'UI/interactions. */
export default function DesignSystemAttendancePreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [classId, setClassId] = useState('c1');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(MOCK_STUDENTS.map((s) => [s.id, 'PRESENT' as AttendanceStatus])),
  );

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

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-5xl justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>
      <AttendanceBoard
        classes={MOCK_CLASSES}
        classId={classId}
        onClassChange={setClassId}
        date={date}
        onDateChange={setDate}
        period={period}
        onPeriodChange={setPeriod}
        students={MOCK_STUDENTS}
        statuses={statuses}
        onSetStatus={(id, s) => setStatuses((prev) => ({ ...prev, [id]: s }))}
        onSave={() => {}}
      />
    </div>
  );
}
