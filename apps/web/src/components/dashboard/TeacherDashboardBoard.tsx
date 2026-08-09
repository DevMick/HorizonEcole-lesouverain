import {
  BookOpen, CalendarDays, ClipboardCheck, Clock, GraduationCap, MapPin, PenSquare, Users,
} from 'lucide-react';
import { Button, Card, Skeleton } from '../ds';

export interface TodayCourse {
  id: string;
  startTime?: string;
  endTime?: string;
  subjectName?: string;
  className?: string;
  roomName?: string;
}
export interface TeacherClassGroup {
  classId: string;
  className?: string;
  subjects: { id: string; name?: string }[];
}
export interface TeacherDashboardBoardProps {
  teacherName?: string;
  todayLabel: string;
  courses: TodayCourse[];
  classes: TeacherClassGroup[];
  loading?: boolean;
  onNavigate: (path: string) => void;
}

const SHORTCUTS = [
  { label: "Faire l'appel", path: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'Saisir des notes', path: '/evaluations/grades', icon: PenSquare },
  { label: 'Mon emploi du temps', path: '/teacher/my-timetable', icon: CalendarDays },
  { label: 'Mes classes', path: '/teacher/my-classes', icon: Users },
];

/**
 * Tableau de bord Enseignant (§9.2) — présentation pure « Encre & Craie ».
 * Recentré « action rapide » : mes cours du jour (avec accès direct Présence/Notes),
 * raccourcis, et mes classes. Le bloc « à traiter » du §9.2 (notes manquantes /
 * absences non justifiées) n'a pas de source de données fiable → remplacé par
 * « Mes classes » (données réelles des affectations), à enrichir si un endpoint arrive.
 */
export function TeacherDashboardBoard({ teacherName, todayLabel, courses, classes, loading, onNavigate }: TeacherDashboardBoardProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Bonjour{teacherName ? <>, <span style={{ color: 'var(--role-accent)' }}>{teacherName}</span></> : null}
        </h1>
        <p className="mt-1 text-sm capitalize text-ds-text-secondary">{todayLabel}</p>
      </div>

      {/* Raccourcis */}
      <Card className="mb-4">
        <p className="mb-3 text-[.78rem] font-bold uppercase tracking-wide text-ds-text-tertiary">Raccourcis</p>
        <div className="ds-dash-actions">
          {SHORTCUTS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.path} type="button" className="ds-dash-action" onClick={() => onNavigate(a.path)}>
                <span className="ds-dash-action-ic" aria-hidden><Icon width={18} height={18} /></span>
                {a.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mes cours du jour */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2"><Clock width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong className="font-display text-ds-text">Mes cours du jour</strong></span>
            <span className="ds-badge ds-badge-neutral">{courses.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={56} className="rounded-lg" />)}</div>
          ) : courses.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">Aucun cours programmé aujourd'hui.</p>
          ) : (
            <ul className="ds-course-list">
              {courses.map((c) => (
                <li key={c.id} className="ds-course-item">
                  <span className="ds-course-time">
                    {c.startTime || '—'}<span>{c.endTime || ''}</span>
                  </span>
                  <span className="ds-course-main">
                    <strong>{c.subjectName || 'Cours'}</strong>
                    <span>
                      {c.className || ''}
                      {c.roomName ? <> · <MapPin width={11} height={11} aria-hidden style={{ display: 'inline', verticalAlign: '-1px' }} /> {c.roomName}</> : null}
                    </span>
                  </span>
                  <span className="ds-course-actions">
                    <Button size="sm" variant="outline" icon={<ClipboardCheck aria-hidden />} onClick={() => onNavigate('/teacher/attendance')}>Appel</Button>
                    <Button size="sm" variant="ghost" icon={<PenSquare aria-hidden />} onClick={() => onNavigate('/evaluations/grades')}>Notes</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Mes classes */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2"><GraduationCap width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong className="font-display text-ds-text">Mes classes</strong></span>
            <span className="ds-badge ds-badge-neutral">{classes.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={52} className="rounded-lg" />)}</div>
          ) : classes.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">Aucune classe affectée.</p>
          ) : (
            <ul className="ds-course-list">
              {classes.map((cl) => (
                <li key={cl.classId} className="ds-class-item">
                  <span className="ds-class-main">
                    <strong>{cl.className || 'Classe'}</strong>
                    <span className="flex flex-wrap gap-1.5">
                      {cl.subjects.map((s) => <span key={s.id} className="ds-chip ds-chip-mini"><BookOpen width={12} height={12} aria-hidden />{s.name}</span>)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
