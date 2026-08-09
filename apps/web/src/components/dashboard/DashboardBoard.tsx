import type { ComponentType } from 'react';
import {
  CalendarDays, ClipboardList, GraduationCap, School, Trophy, UserCheck, UserPlus, Users,
} from 'lucide-react';
import { Card, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export interface DashboardStats {
  totalStudents?: number;
  activeStudents?: number;
  totalTeachers?: number;
  totalClasses?: number;
}
export interface RecentStudent {
  id: string; firstName?: string; lastName?: string; studentNumber?: string; createdAt?: string;
}
export interface RecentGrade {
  id: string; note?: number | string; max_note?: number;
  student?: { firstName?: string; lastName?: string; studentNumber?: string };
  subject?: { name?: string };
  created_at?: string;
}

export interface DashboardBoardProps {
  stats: DashboardStats | null;
  recentStudents: RecentStudent[];
  recentGrades: RecentGrade[];
  loading?: boolean;
  isAdmin?: boolean;
  onNavigate?: (path: string) => void;
}

interface StatDef { key: keyof DashboardStats; label: string; icon: ComponentType<any>; }
const STATS: StatDef[] = [
  { key: 'activeStudents', label: 'Élèves actifs', icon: UserCheck },
  { key: 'totalStudents', label: 'Total élèves', icon: Users },
  { key: 'totalTeachers', label: 'Enseignants', icon: GraduationCap },
  { key: 'totalClasses', label: 'Classes', icon: School },
];
const QUICK_ACTIONS = [
  { label: 'Élèves', path: '/people/students', icon: Users },
  { label: 'Inscriptions', path: '/academic/inscriptions', icon: ClipboardList },
  { label: 'Emploi du temps', path: '/academic/timetable', icon: CalendarDays },
  { label: 'Enseignants', path: '/people/teachers', icon: UserPlus },
];

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();
const frDate = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');
const numGrade = (n?: number | string) => (n == null ? '' : String(typeof n === 'number' ? n : parseFloat(n)));

/**
 * Tableau de bord (§9.1) — présentation pure « Encre & Craie ».
 * Périmètre pédagogique uniquement (module paiement retiré de l'application) :
 * 4 stat-cards, activité récente (nouveaux élèves, notes récentes) et,
 * pour l'admin, des raccourcis de navigation.
 */
export function DashboardBoard({ stats, recentStudents, recentGrades, loading, isAdmin, onNavigate }: DashboardBoardProps) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">Vue d'ensemble de l'établissement.</p>
      </div>

      {/* Stat-cards */}
      <div className="ds-stat-grid mb-4">
        {loading
          ? STATS.map((_, i) => <Skeleton key={i} height={92} className="rounded-lg" />)
          : STATS.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.key} accent className="ds-stat">
                  <div className="ds-stat-body">
                    <span className="ds-stat-label">{s.label}</span>
                    <span className="ds-stat-value">{stats?.[s.key] ?? 0}</span>
                  </div>
                  <span className="ds-stat-medallion" aria-hidden><Icon width={20} height={20} /></span>
                </Card>
              );
            })}
      </div>

      {/* Raccourcis (admin) */}
      {isAdmin && (
        <Card className="mb-4">
          <p className="mb-3 text-[.78rem] font-bold uppercase tracking-wide text-ds-text-tertiary">Raccourcis</p>
          <div className="ds-dash-actions">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.path} type="button" className="ds-dash-action" onClick={() => onNavigate?.(a.path)}>
                  <span className="ds-dash-action-ic" aria-hidden><Icon width={18} height={18} /></span>
                  {a.label}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Activité récente */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2"><UserPlus width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong className="font-display text-ds-text">Nouveaux élèves</strong></span>
            <span className="ds-badge ds-badge-neutral">{recentStudents.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={44} className="rounded-lg" />)}</div>
          ) : recentStudents.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">Les inscriptions récentes apparaîtront ici.</p>
          ) : (
            <ul className="ds-activity">
              {recentStudents.map((s) => (
                <li key={s.id} className="ds-activity-item">
                  <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>{initials(s.firstName, s.lastName)}</span>
                  <span className="ds-activity-main">
                    <strong>{s.firstName} {s.lastName}</strong>
                    <span className="font-mono">{s.studentNumber || '—'}</span>
                  </span>
                  <span className="ds-activity-meta">{frDate(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2"><Trophy width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} /><strong className="font-display text-ds-text">Notes récentes</strong></span>
            <span className="ds-badge ds-badge-neutral">{recentGrades.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={44} className="rounded-lg" />)}</div>
          ) : recentGrades.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">Les dernières notes saisies apparaîtront ici.</p>
          ) : (
            <ul className="ds-activity">
              {recentGrades.map((g) => (
                <li key={g.id} className="ds-activity-item">
                  <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(g.student?.lastName || g.id) }} aria-hidden>{initials(g.student?.firstName, g.student?.lastName)}</span>
                  <span className="ds-activity-main">
                    <strong>{g.student?.firstName} {g.student?.lastName}</strong>
                    <span>{g.subject?.name || '—'}</span>
                  </span>
                  <span className={cn('ds-activity-note', Number(g.note) / (g.max_note || 20) >= 0.5 ? 'ds-avg-pass' : 'ds-avg-fail')}>
                    {numGrade(g.note)}<span className="ds-note-max">/{g.max_note ?? 20}</span>
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
