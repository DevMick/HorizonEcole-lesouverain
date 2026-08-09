import { useEffect, useMemo, useState } from 'react';
import { InscriptionsBoard, type PendingStudent } from '../components/inscriptions/InscriptionsBoard';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation §9.7 (dev only, données fictives) — élèves à inscrire pour l'année en cours. */

const MOCK: PendingStudent[] = [
  { id: 's1', firstName: 'Awa', lastName: 'Diop', studentNumber: 'STU-1001', class: { id: 'c1', name: '6ème 1' } },
  { id: 's2', firstName: 'Mamadou', lastName: 'Ndiaye', studentNumber: 'STU-1002', class: null },
  { id: 's3', firstName: 'Fatou', lastName: 'Sow', studentNumber: 'STU-1003', class: { id: 'c2', name: '5ème 2' } },
  { id: 's4', firstName: 'Ibrahima', lastName: 'Fall', studentNumber: 'STU-1004', class: null },
];

export default function DesignSystemInscriptionsPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-role', 'admin');
    return () => document.documentElement.removeAttribute('data-role');
  }, []);
  useEffect(() => {
    withTransitionsSuppressed(() => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    });
  }, [theme]);

  const students = useMemo(() => MOCK.filter((s) =>
    !search || `${s.lastName} ${s.firstName} ${s.studentNumber}`.toLowerCase().includes(search.toLowerCase()),
  ), [search]);

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>
      <InscriptionsBoard
        currentYearName="2025-2026"
        hasCurrentYear
        search={search}
        onSearchChange={setSearch}
        students={students}
        total={students.length}
        enrolledCount={12}
        onNew={() => {}}
        onInscribe={() => {}}
      />
    </div>
  );
}
