import { useEffect, useState } from 'react';
import { TimetableGrid, type TTCell, type TTSlot } from '../components/timetable/TimetableGrid';
import { withTransitionsSuppressed } from '../lib/utils';

/** Prévisualisation §9.4 (dev only, données fictives) — grille emploi du temps. */

const DAYS = [
  { value: 'MONDAY', label: 'Lundi' }, { value: 'TUESDAY', label: 'Mardi' }, { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' }, { value: 'FRIDAY', label: 'Vendredi' },
];
const SLOTS: TTSlot[] = [
  { start: '07:45', end: '08:35', label: '07:45 - 08:35' },
  { start: '08:35', end: '09:25', label: '08:35 - 09:25' },
  { start: '09:25', end: '10:15', label: '09:25 - 10:15' },
  { start: '10:30', end: '11:20', label: '10:30 - 11:20' },
  { start: '12:10', end: '13:15', label: '12:10 - 13:15', isSeparator: true },
  { start: '13:15', end: '14:05', label: '13:15 - 14:05' },
  { start: '14:05', end: '14:55', label: '14:05 - 14:55' },
];
type Entry = TTCell & { day: string; start: string };
const MOCK: Entry[] = [
  { id: '1', day: 'MONDAY', start: '07:45', subject: { name: 'Mathématiques' }, teacher: { first_name: 'A.', last_name: 'Traoré' }, classroom: { name: 'Salle 12' } },
  { id: '2', day: 'MONDAY', start: '08:35', subject: { name: 'Français' }, teacher: { first_name: 'A.', last_name: 'Sangaré' }, classroom: { name: 'Salle 12' } },
  { id: '3', day: 'TUESDAY', start: '07:45', subject: { name: 'Physique-Chimie' }, teacher: { first_name: 'B.', last_name: 'Diabaté' }, classroom: { name: 'Labo 2' } },
  { id: '4', day: 'WEDNESDAY', start: '09:25', subject: { name: 'EPS', code: 'EPS' }, teacher: { first_name: 'I.', last_name: 'Cissé' }, classroom: null },
  { id: '5', day: 'THURSDAY', start: '13:15', subject: { name: 'Anglais' }, teacher: { first_name: 'A.', last_name: 'Traoré' }, classroom: { name: 'Salle 08' } },
  { id: '6', day: 'FRIDAY', start: '14:05', subject: { name: 'SVT' }, teacher: { first_name: 'M.', last_name: 'Coulibaly' }, classroom: { name: 'Salle 05' } },
];

export default function DesignSystemTimetablePreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  const cellFor = (day: string, start: string) => MOCK.find((m) => m.day === day && m.start === start) || null;

  return (
    <div className="min-h-screen bg-surface-page px-6 py-8 font-body text-ds-text">
      <div className="mx-auto mb-4 flex max-w-6xl justify-end gap-1 rounded-md bg-surface-subtle p-1" style={{ width: 'fit-content' }}>
        <button className={`ds-btn ds-btn-sm ${theme === 'light' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('light')}>Clair</button>
        <button className={`ds-btn ds-btn-sm ${theme === 'dark' ? 'ds-btn-primary' : 'ds-btn-ghost'}`} onClick={() => setTheme('dark')}>Sombre</button>
      </div>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Emploi du temps</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">Grille des cours — classe 6ème 1.</p>
        </div>
        <TimetableGrid slots={SLOTS} days={DAYS} cellFor={(d, s) => cellFor(d, s)} onDelete={() => {}} />
      </div>
    </div>
  );
}
