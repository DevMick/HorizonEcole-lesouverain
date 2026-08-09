import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  PenSquare,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { Button, Card, Skeleton, StatusBadge } from '../components/ds';
import { ChildSwitcher } from '../components/parent/ChildSwitcher';
import { useAcademicYears, useActiveChild, fullName } from '../lib/hooks/useParentSpace';
import { ATTENDANCE_BADGE, type AttendanceStatus } from '../components/school/attendance-status';

dayjs.locale('fr');

/**
 * Espace Famille (accueil parent) — le pendant du tableau de bord Enseignant (§9.2),
 * recentré sur la seule question que se pose un parent en ouvrant l'application :
 * « comment s'est passée la journée de mon enfant ? »
 *
 * D'où l'ordre : la journée du jour d'abord (cours + appels déjà faits), les
 * raccourcis ensuite. Aucune donnée inventée — tout vient de `/parent/*`.
 */

const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const SHORTCUTS = [
  { label: 'Emploi du temps', path: '/parent/timetable', icon: CalendarDays },
  { label: 'Notes', path: '/parent/grades', icon: PenSquare },
  { label: 'Présences', path: '/parent/attendance', icon: ClipboardCheck },
  { label: 'Bulletins', path: '/parent/bulletins', icon: FileText },
  { label: 'Mes enfants', path: '/parent/children', icon: Users },
];

export default function ParentHomePage() {
  const navigate = useNavigate();
  const { parent, children, child, childId, setChildId, isLoading } = useActiveChild();
  const { currentYear } = useAcademicYears();

  const { data: timetable } = useQuery({
    queryKey: ['parent-timetable', childId, currentYear?.id],
    queryFn: async () =>
      (await api.get(`/parent/children/${childId}/timetable?academicYearId=${currentYear.id}`)).data
        .data,
    enabled: !!childId && !!currentYear?.id,
  });

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', childId, currentYear?.id, 'all', 'all'],
    queryFn: async () =>
      (await api.get(`/parent/children/${childId}/attendance?academicYearId=${currentYear.id}`)).data
        .data,
    enabled: !!childId && !!currentYear?.id,
  });

  const todayKey = DAY_KEYS[dayjs().day()];
  const todayCourses = useMemo(
    () =>
      (timetable?.entries || [])
        .filter((e: any) => e.day_of_week === todayKey)
        .sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time))),
    [timetable, todayKey],
  );

  const { data: grades } = useQuery({
    queryKey: ['parent-grades', childId, currentYear?.id, 'all', 'all'],
    queryFn: async () =>
      (await api.get(`/parent/children/${childId}/grades?academicYearId=${currentYear.id}`)).data
        .data,
    enabled: !!childId && !!currentYear?.id,
  });

  const recentSessions = (attendance?.sessions || []).slice(0, 5);
  const stats = attendance?.stats;

  // Les 5 dernières notes, toutes matières confondues — l'API regroupe par
  // matière (unité de lecture de la page Notes), on ré-aplatit pour l'accueil
  // où c'est la fraîcheur qui compte.
  const recentGrades = useMemo(() => {
    const flat = (grades?.bySubject || []).flatMap((s: any) =>
      (s.grades || []).map((g: any) => ({ ...g, subjectName: s.name })),
    );
    return flat
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [grades]);

  if (!isLoading && children.length === 0) {
    return (
      <div className="animate-fade-in mx-auto max-w-2xl">
        <Card className="text-center" accent="info">
          <Users className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun enfant rattaché</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ds-text-secondary">
            Votre compte n'est encore rattaché à aucun élève. Contactez le secrétariat de
            l'établissement pour effectuer le rattachement.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Bonjour
          {parent ? (
            <>
              , <span style={{ color: 'var(--role-accent)' }}>{parent.firstName}</span>
            </>
          ) : null}
        </h1>
        <p className="mt-1 text-sm capitalize text-ds-text-secondary">
          {dayjs().format('dddd D MMMM YYYY')}
          {currentYear ? ` · Année ${currentYear.name}` : ''}
        </p>
      </div>

      <ChildSwitcher items={children} value={childId} onChange={setChildId} />

      {/* Assiduité de l'année — les chiffres qui rassurent (ou alertent) en un coup d'œil */}
      <div className="ds-stat-grid mb-4">
        {!stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} className="rounded-lg" />
          ))
        ) : (
          <>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Taux de présence</span>
                <span className="ds-stat-value">
                  {stats.presenceRate === null ? '—' : `${stats.presenceRate}%`}
                </span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <ClipboardCheck width={20} height={20} />
              </span>
            </Card>
            <Card accent="success" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Séances suivies</span>
                <span className="ds-stat-value">{stats.present}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <GraduationCap width={20} height={20} />
              </span>
            </Card>
            <Card accent="warning" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Retards</span>
                <span className="ds-stat-value">{stats.late}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <Clock width={20} height={20} />
              </span>
            </Card>
            <Card accent="danger" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Absences</span>
                <span className="ds-stat-value">{stats.absent + stats.excused}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <ClipboardCheck width={20} height={20} />
              </span>
            </Card>
          </>
        )}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Les cours du jour */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <Clock width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} />
              <strong className="font-display text-ds-text">
                Les cours de {child ? child.firstName : 'l\'enfant'} aujourd'hui
              </strong>
            </span>
            <span className="ds-badge ds-badge-neutral">{todayCourses.length}</span>
          </div>
          {!timetable ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={56} className="rounded-lg" />
              ))}
            </div>
          ) : todayCourses.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">
              Aucun cours programmé aujourd'hui.
            </p>
          ) : (
            <ul className="ds-course-list">
              {todayCourses.map((c: any) => (
                <li key={c.id} className="ds-course-item">
                  <span className="ds-course-time">
                    {c.start_time}
                    <span>{c.end_time}</span>
                  </span>
                  <span className="ds-course-main">
                    <strong>{c.subject?.name || 'Cours'}</strong>
                    <span>
                      {c.teacher ? `${c.teacher.first_name} ${c.teacher.last_name}` : ''}
                      {c.classroom?.name ? (
                        <>
                          {' '}
                          ·{' '}
                          <MapPin
                            width={11}
                            height={11}
                            aria-hidden
                            style={{ display: 'inline', verticalAlign: '-1px' }}
                          />{' '}
                          {c.classroom.name}
                        </>
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Derniers appels */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <ClipboardCheck
                width={16}
                height={16}
                aria-hidden
                style={{ color: 'var(--role-accent)' }}
              />
              <strong className="font-display text-ds-text">Derniers appels</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/parent/attendance')}>
              Tout voir
            </Button>
          </div>
          {!attendance ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={52} className="rounded-lg" />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">
              Aucun appel enregistré pour cette année.
            </p>
          ) : (
            <ul className="ds-course-list">
              {recentSessions.map((s: any) => {
                const badge = ATTENDANCE_BADGE[s.status as AttendanceStatus];
                return (
                  <li key={s.id} className="ds-course-item">
                    <span className="ds-course-time">
                      {dayjs(s.date).format('DD/MM')}
                      <span>Séance {s.sessionNumber}</span>
                    </span>
                    <span className="ds-course-main">
                      <strong>{s.subject?.name || 'Matière'}</strong>
                      <span>
                        {s.teacher ? `${s.teacher.first_name} ${s.teacher.last_name}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={badge.kind}>{badge.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Dernières notes — ce que le parent vient chercher en premier */}
        <Card className="lg:col-span-2">
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <PenSquare
                width={16}
                height={16}
                aria-hidden
                style={{ color: 'var(--role-accent)' }}
              />
              <strong className="font-display text-ds-text">Dernières notes</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/parent/grades')}>
              Tout voir
            </Button>
          </div>
          {!grades ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={52} className="rounded-lg" />
              ))}
            </div>
          ) : recentGrades.length === 0 ? (
            <p className="py-6 text-center text-sm text-ds-text-tertiary">
              Aucune note saisie pour cette année.
            </p>
          ) : (
            <ul className="ds-course-list">
              {recentGrades.map((g: any) => {
                const pass = (g.maxNote === 20 ? g.note : (g.note / g.maxNote) * 20) >= 10;
                return (
                  <li key={g.id} className="ds-course-item">
                    <span className="ds-course-time">
                      {dayjs(g.date).format('DD/MM')}
                      <span>{g.semester?.name || ''}</span>
                    </span>
                    <span className="ds-course-main">
                      <strong>{g.subjectName}</strong>
                      <span>
                        {g.evaluationType
                          ? g.evaluationType.number
                            ? `${g.evaluationType.name} n°${g.evaluationType.number}`
                            : g.evaluationType.name
                          : 'Évaluation'}
                        {g.evaluationType?.coefficient
                          ? ` · Coef. ${g.evaluationType.coefficient}`
                          : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'ds-grade-avg shrink-0',
                        pass ? 'ds-avg-pass' : 'ds-avg-fail',
                      )}
                    >
                      {g.note.toFixed(2)}
                      <span className="ml-0.5 text-[.72rem] font-medium text-ds-text-tertiary">
                        /{g.maxNote}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <p className="mb-3 text-[.78rem] font-bold uppercase tracking-wide text-ds-text-tertiary">
          Raccourcis
        </p>
        <div className="ds-dash-actions">
          {SHORTCUTS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.path}
                type="button"
                className="ds-dash-action"
                onClick={() => navigate(a.path)}
              >
                <span className="ds-dash-action-ic" aria-hidden>
                  <Icon width={18} height={18} />
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
      </Card>

      {child && (
        <p className="mt-4 text-center text-xs text-ds-text-tertiary">
          Données affichées pour {fullName(child)}
          {child.class?.name ? ` — ${child.class.name}` : ''}.
        </p>
      )}
    </div>
  );
}
