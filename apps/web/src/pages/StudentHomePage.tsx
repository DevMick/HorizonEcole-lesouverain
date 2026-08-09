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
  Hash,
  MapPin,
  PenSquare,
  Trophy,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button, Card, Skeleton, StatusBadge } from '../components/ds';
import { DAY_KEYS } from '../components/school/TimetableBoard';
import { ATTENDANCE_BADGE, type AttendanceStatus } from '../components/school/attendance-status';
import { evalLabel, on20 } from '../components/school/GradesBoard';
import { useAcademicYears } from '../lib/hooks/useAcademicYears';
import { useStudentMe } from '../lib/hooks/useStudentSpace';

dayjs.locale('fr');

/**
 * Ma Scolarité (accueil élève) — le pendant de l'Espace Famille, mais à la
 * première personne.
 *
 * Un élève ne « supervise » pas sa scolarité, il la vit : l'écran s'ouvre donc
 * sur sa carte de classe (son identité scolaire, ce qu'on lui demande le plus
 * souvent de prouver), puis sur sa journée — les cours qui restent, les appels
 * déjà faits — et enfin ses dernières notes. Les chiffres qui l'engagent
 * (moyenne, assiduité) sont présents mais sans dramatisation : ni médaille ni
 * alarme, juste l'état des lieux.
 */

const SHORTCUTS = [
  { label: 'Mon emploi du temps', path: '/student/timetable', icon: CalendarDays },
  { label: 'Mes notes', path: '/student/grades', icon: PenSquare },
  { label: 'Mes présences', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'Mes bulletins', path: '/student/bulletins', icon: FileText },
];

export default function StudentHomePage() {
  const navigate = useNavigate();
  const { data: me, isLoading, isError } = useStudentMe();
  const { currentYear } = useAcademicYears();
  const yearId = currentYear?.id;

  const { data: timetable } = useQuery({
    queryKey: ['student-timetable', yearId],
    queryFn: async () => (await api.get(`/student/timetable?academicYearId=${yearId}`)).data.data,
    enabled: !!yearId,
  });

  const { data: attendance } = useQuery({
    queryKey: ['student-attendance', yearId, 'all', 'all'],
    queryFn: async () => (await api.get(`/student/attendance?academicYearId=${yearId}`)).data.data,
    enabled: !!yearId,
  });

  const { data: grades } = useQuery({
    queryKey: ['student-grades', yearId, 'all', 'all'],
    queryFn: async () => (await api.get(`/student/grades?academicYearId=${yearId}`)).data.data,
    enabled: !!yearId,
  });

  const todayKey = DAY_KEYS[dayjs().day()];
  const todayCourses = useMemo(
    () =>
      (timetable?.entries || [])
        .filter((e: any) => e.day_of_week === todayKey)
        .sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time))),
    [timetable, todayKey],
  );

  const recentSessions = (attendance?.sessions || []).slice(0, 5);

  const recentGrades = useMemo(() => {
    const flat = (grades?.bySubject || []).flatMap((s: any) =>
      (s.grades || []).map((g: any) => ({ ...g, subjectName: s.name })),
    );
    return flat
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [grades]);

  if (isError) {
    return (
      <div className="animate-fade-in mx-auto max-w-2xl">
        <Card className="text-center" accent="info">
          <GraduationCap className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucune fiche élève</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ds-text-secondary">
            Votre compte n'est rattaché à aucune fiche élève. Contactez le secrétariat de
            l'établissement.
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
          {me ? (
            <>
              , <span style={{ color: 'var(--role-accent)' }}>{me.firstName}</span>
            </>
          ) : null}
        </h1>
        <p className="mt-1 text-sm capitalize text-ds-text-secondary">
          {dayjs().format('dddd D MMMM YYYY')}
          {currentYear ? ` · Année ${currentYear.name}` : ''}
        </p>
      </div>

      {/* Ma classe — la carte d'identité scolaire, en tête parce que c'est
          l'information qu'on demande le plus souvent à un élève. */}
      {isLoading ? (
        <Skeleton height={96} className="mb-4 rounded-lg" />
      ) : (
        me && (
          <Card accent className="mb-4 flex flex-wrap items-center gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[.95rem] font-bold text-white"
              style={{ background: 'var(--role-accent)' }}
              aria-hidden
            >
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                `${me.firstName?.charAt(0) ?? ''}${me.lastName?.charAt(0) ?? ''}`.toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <span className="block text-[.72rem] font-bold uppercase tracking-wide text-ds-text-tertiary">
                Ma classe
              </span>
              <strong className="block font-display text-[1.25rem] text-ds-text">
                {me.class?.name ?? 'Aucune classe'}
              </strong>
            </div>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="ds-chip">
                <Hash width={13} height={13} aria-hidden />
                <span className="font-mono">{me.studentNumber}</span>
              </span>
              {me.status === 'ACTIVE' && <StatusBadge status="success">Inscrit</StatusBadge>}
            </span>
          </Card>
        )
      )}

      <Card className="mb-4">
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

      {/* Où j'en suis — deux chiffres, sans dramatisation */}
      <div className="ds-stat-grid mb-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {!attendance || !grades ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={92} className="rounded-lg" />
          ))
        ) : (
          <>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Ma moyenne de l'année</span>
                <span className="ds-stat-value">
                  {grades.stats?.generalAverage !== null
                    ? grades.stats.generalAverage.toFixed(2)
                    : '—'}
                </span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <Trophy width={20} height={20} />
              </span>
            </Card>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Mon taux de présence</span>
                <span className="ds-stat-value">
                  {attendance.stats?.presenceRate === null
                    ? '—'
                    : `${attendance.stats.presenceRate}%`}
                </span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <ClipboardCheck width={20} height={20} />
              </span>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mes cours du jour */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <Clock width={16} height={16} aria-hidden style={{ color: 'var(--role-accent)' }} />
              <strong className="font-display text-ds-text">Mes cours aujourd'hui</strong>
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

        {/* Mes derniers appels */}
        <Card>
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <ClipboardCheck
                width={16}
                height={16}
                aria-hidden
                style={{ color: 'var(--role-accent)' }}
              />
              <strong className="font-display text-ds-text">Mes derniers appels</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/student/attendance')}>
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

        {/* Mes dernières notes */}
        <Card className="lg:col-span-2">
          <div className="ds-activity-head">
            <span className="flex items-center gap-2">
              <PenSquare
                width={16}
                height={16}
                aria-hidden
                style={{ color: 'var(--role-accent)' }}
              />
              <strong className="font-display text-ds-text">Mes dernières notes</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/student/grades')}>
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
                const pass = on20(g.note, g.maxNote) >= 10;
                return (
                  <li key={g.id} className="ds-course-item">
                    <span className="ds-course-time">
                      {dayjs(g.date).format('DD/MM')}
                      <span>{g.semester?.name || ''}</span>
                    </span>
                    <span className="ds-course-main">
                      <strong>{g.subjectName}</strong>
                      <span>
                        {evalLabel(g.evaluationType)}
                        {g.evaluationType?.coefficient
                          ? ` · Coef. ${g.evaluationType.coefficient}`
                          : ''}
                      </span>
                    </span>
                    <span className={cn('ds-grade-avg shrink-0', pass ? 'ds-avg-pass' : 'ds-avg-fail')}>
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
    </div>
  );
}
