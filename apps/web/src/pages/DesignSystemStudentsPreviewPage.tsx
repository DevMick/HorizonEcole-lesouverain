import { useEffect, useMemo, useState } from 'react';
import { StudentsBoard, type StudentRow } from '../components/students/StudentsBoard';
import { StudentDetailDrawer } from '../components/students/StudentDetailDrawer';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation §9.3 (dev only, données fictives) — liste + tiroir de détail. */

const CLASSES = [{ id: 'c1', name: '6ème 1' }, { id: 'c2', name: '5ème 2' }, { id: 'c3', name: '4ème 1' }];
const NAMES = [
  ['Awa', 'Diop', 'F', 'ACTIVE', 'c1'], ['Mamadou', 'Ndiaye', 'M', 'ACTIVE', 'c1'], ['Fatou', 'Sow', 'F', 'ACTIVE', 'c2'],
  ['Ibrahima', 'Fall', 'M', 'INACTIVE', 'c2'], ['Aïcha', 'Ba', 'F', 'ACTIVE', 'c3'], ['Ousmane', 'Diallo', 'M', 'TRANSFERRED', 'c1'],
  ['Mariama', 'Cissé', 'F', 'ACTIVE', 'c3'], ['Cheikh', 'Gueye', 'M', 'GRADUATED', 'c2'],
];
const MOCK: StudentRow[] = NAMES.map(([firstName, lastName, gender, status, cid], i) => ({
  id: `s${i}`, firstName, lastName, gender, status, studentNumber: `STU-${1001 + i}`, isStateAssigned: i % 3 === 0,
  class: CLASSES.find((c) => c.id === cid) || null,
}));
const MOCK_GRADES = [
  { id: 'g1', note: 16, max_note: 20, subject: { name: 'Mathématiques' }, evaluationType: { name: 'Devoir' }, semester: { name: '1er Trimestre' } },
  { id: 'g2', note: 7, max_note: 20, subject: { name: 'Français' }, evaluationType: { name: 'Composition' }, semester: { name: '1er Trimestre' } },
  { id: 'g3', note: 8, max_note: 10, subject: { name: 'SVT' }, evaluationType: { name: 'Interrogation' }, semester: { name: '1er Trimestre' } },
];
const MOCK_ATT = [
  { id: 'a1', month: 10, year: 2025, present_days: 18, late_days: 1, absent_days: 1, attendance_rate: 90 },
  { id: 'a2', month: 11, year: 2025, present_days: 20, late_days: 0, absent_days: 0, attendance_rate: 100 },
];
const MOCK_AVAILABLE_PARENTS = [
  { id: 'p1', name: 'Sékou Diop' }, { id: 'p2', name: 'Awa Traoré' }, { id: 'p3', name: 'Moussa Koné' },
];
const MOCK_YEARS = [{ id: 'y1', name: '2025-2026', isCurrent: true }, { id: 'y2', name: '2024-2025', isCurrent: false }];

export default function DesignSystemStudentsPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

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

  const filtered = useMemo(() => MOCK.filter((s) =>
    (!search || `${s.lastName} ${s.firstName} ${s.studentNumber}`.toLowerCase().includes(search.toLowerCase())) &&
    (!classId || s.class?.id === classId),
  ), [search, classId]);

  const openDetail = (s: StudentRow) => {
    setDetail({
      ...s, dateOfBirth: '2012-05-14', placeOfBirth: 'Abidjan', phone: '+225 07 00 00 00', email: 'eleve@example.com',
      address: 'Cocody, Abidjan', attachments: ['/uploads/documents/bulletin.pdf'],
      studentParents: [{ id: 'sp1', relation: 'PERE', parent: { id: 'p9', first_name: 'Sékou', last_name: s.lastName, phone: '+225 01 02 03 04' } }],
    });
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-6xl justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>
      <StudentsBoard
        students={filtered}
        total={filtered.length}
        totalStudentsStat={filtered.length}
        activeClassesStat={CLASSES.length}
        search={search}
        onSearchChange={setSearch}
        classId={classId}
        onClassChange={setClassId}
        academicYearId={academicYearId}
        onAcademicYearChange={setAcademicYearId}
        academicYears={MOCK_YEARS}
        classes={CLASSES}
        view={view}
        onViewChange={setView}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onNew={() => {}}
        onView={openDetail}
        onEdit={() => {}}
        onDelete={() => {}}
      />
      <StudentDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        student={detail}
        grades={MOCK_GRADES}
        attendance={MOCK_ATT}
        attachments={[{ name: 'bulletin.pdf', url: '#' }]}
        availableParents={MOCK_AVAILABLE_PARENTS}
        onAddParent={(pid, rel) => setDetail((d: any) => ({ ...d, studentParents: [...d.studentParents, { id: `sp-${pid}`, relation: rel, parent: { id: pid, first_name: MOCK_AVAILABLE_PARENTS.find((p) => p.id === pid)?.name, last_name: '' } }] }))}
        onRemoveParent={(sp) => setDetail((d: any) => ({ ...d, studentParents: d.studentParents.filter((x: any) => x.id !== sp.id) }))}
      />
    </div>
  );
}
