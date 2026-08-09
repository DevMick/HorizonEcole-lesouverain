import { useEffect, useState } from 'react';
import { DashboardBoard } from '../components/dashboard/DashboardBoard';
import { TeacherDashboardBoard } from '../components/dashboard/TeacherDashboardBoard';
import { withTransitionsSuppressed } from '../lib/utils';

const TODAY_COURSES = [
  { id: 'c1', startTime: '08:00', endTime: '09:30', subjectName: 'Mathématiques', className: '6ème 1', roomName: 'Salle 12' },
  { id: 'c2', startTime: '10:00', endTime: '11:30', subjectName: 'Mathématiques', className: '5ème 2', roomName: 'Salle 08' },
  { id: 'c3', startTime: '14:00', endTime: '15:30', subjectName: 'Physique-Chimie', className: '4ème 1', roomName: 'Labo 2' },
];
const TEACHER_CLASSES = [
  { classId: 'k1', className: '6ème 1', subjects: [{ id: 's1', name: 'Mathématiques' }] },
  { classId: 'k2', className: '5ème 2', subjects: [{ id: 's1', name: 'Mathématiques' }, { id: 's2', name: 'Physique-Chimie' }] },
  { classId: 'k3', className: '4ème 1', subjects: [{ id: 's2', name: 'Physique-Chimie' }] },
];

/** Prévisualisation §9.1 (dev only, données fictives) — valide l'UI du tableau de bord. */

const STATS = { activeStudents: 342, totalStudents: 368, totalTeachers: 24, totalClasses: 15 };
const RECENT_STUDENTS = [
  { id: 's1', firstName: 'Awa', lastName: 'Diop', studentNumber: 'STU-1042', createdAt: '2026-07-09' },
  { id: 's2', firstName: 'Mamadou', lastName: 'Ndiaye', studentNumber: 'STU-1041', createdAt: '2026-07-08' },
  { id: 's3', firstName: 'Fatou', lastName: 'Sow', studentNumber: 'STU-1040', createdAt: '2026-07-07' },
  { id: 's4', firstName: 'Ibrahima', lastName: 'Fall', studentNumber: 'STU-1039', createdAt: '2026-07-06' },
];
const RECENT_GRADES = [
  { id: 'g1', note: 16, max_note: 20, student: { firstName: 'Aïcha', lastName: 'Ba' }, subject: { name: 'Mathématiques' } },
  { id: 'g2', note: 7, max_note: 20, student: { firstName: 'Ousmane', lastName: 'Diallo' }, subject: { name: 'Français' } },
  { id: 'g3', note: 8, max_note: 10, student: { firstName: 'Mariama', lastName: 'Cissé' }, subject: { name: 'SVT' } },
  { id: 'g4', note: 4, max_note: 10, student: { firstName: 'Cheikh', lastName: 'Gueye' }, subject: { name: 'Anglais' } },
];

export default function DesignSystemDashboardPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [role, setRole] = useState<'admin' | 'teacher'>('admin');

  useEffect(() => {
    document.documentElement.setAttribute('data-role', role);
    return () => document.documentElement.removeAttribute('data-role');
  }, [role]);
  useEffect(() => {
    withTransitionsSuppressed(() => {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    });
  }, [theme]);

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-6xl flex-wrap justify-end gap-2">
        <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
          <button className={`ds-btn ds-btn-sm ${role === 'admin' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setRole('admin')}>Admin</button>
          <button className={`ds-btn ds-btn-sm ${role === 'teacher' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setRole('teacher')}>Enseignant</button>
        </div>
        <div className="flex gap-1 rounded-md bg-surface-subtle p-1">
          <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
          <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
        </div>
      </div>
      {role === 'admin' ? (
        <DashboardBoard
          stats={STATS}
          recentStudents={RECENT_STUDENTS}
          recentGrades={RECENT_GRADES}
          isAdmin
          onNavigate={() => {}}
        />
      ) : (
        <TeacherDashboardBoard
          teacherName="M. Traoré"
          todayLabel="vendredi 11 juillet 2026"
          courses={TODAY_COURSES}
          classes={TEACHER_CLASSES}
          onNavigate={() => {}}
        />
      )}
    </div>
  );
}
