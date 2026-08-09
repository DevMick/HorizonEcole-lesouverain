import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'antd';
import dayjs from 'dayjs';
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  Hash,
  Layers,
  Percent,
  UserX,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Button, Card, Modal, Skeleton, Tabs } from '../components/ds';
import { AttendanceSessionDetailModal } from '../components/attendance/AttendanceSessionDetailModal';

/**
 * Présences — vue d'ensemble administration (§9.6).
 * L'administrateur ne fait pas l'appel : il consulte le cumul des présences
 * saisies par les enseignants — par matière, par élève et séance par séance —
 * sur l'année scolaire sélectionnée (l'année en cours par défaut).
 */

type TabKey = 'subjects' | 'students' | 'sessions';

const pct = (v: number) => `${Number(v ?? 0).toFixed(1)} %`;

function rateClass(rate: number) {
  if (rate >= 90) return 'ds-c-present';
  if (rate >= 75) return 'ds-c-late';
  return 'ds-c-absent';
}

function Stat({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="ds-stat">
        <div className="ds-stat-body">
          <span className="ds-stat-label">{label}</span>
          <span className="ds-stat-value">{value}</span>
          {hint && <span className="text-xs text-ds-text-tertiary">{hint}</span>}
        </div>
        <span className="ds-stat-medallion">{icon}</span>
      </div>
    </Card>
  );
}

export default function AdminAttendancePage() {
  const { user } = useAuthStore();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';

  const [tab, setTab] = useState<TabKey>('subjects');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [openSubject, setOpenSubject] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  useEffect(() => {
    if (years?.length && !yearId) setYearId((years.find((y: any) => y.isCurrent) || years[0]).id);
  }, [years, yearId]);

  const { data: classes } = useQuery({
    queryKey: ['school-classes-all'],
    queryFn: async () => (await api.get('/school-classes')).data.data || [],
  });

  // Matières proposées : celles de la classe si une classe est choisie, sinon toutes.
  const { data: classSubjects } = useQuery({
    queryKey: ['coeff-class', classId],
    queryFn: async () => (await api.get(`/coefficients/class/${classId}`)).data.data || [],
    enabled: !!classId,
  });
  const { data: allSubjects } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => (await api.get('/subjects')).data.data || [],
    enabled: !classId,
  });
  const subjectOptions = useMemo(() => {
    const list = classId
      ? (classSubjects || []).map((cs: any) => cs.subject).filter(Boolean)
      : allSubjects || [];
    return [...list]
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
      .map((s: any) => ({ value: s.id, label: s.name }));
  }, [classId, classSubjects, allSubjects]);

  const { data: overview, isLoading } = useQuery({
    queryKey: ['attendance-overview', yearId, classId, subjectId],
    queryFn: async () =>
      (
        await api.get('/attendance-sessions/overview', {
          params: { academicYearId: yearId, classId: classId || undefined, subjectId: subjectId || undefined },
        })
      ).data.data,
    enabled: !!yearId && isAdmin,
  });

  // Onglet « Séances » : toutes les séances du périmètre, tous enseignants confondus.
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['attendance-sessions-admin', yearId, classId, subjectId],
    queryFn: async () =>
      (
        await api.get('/attendance-sessions', {
          params: { academicYearId: yearId, classId: classId || undefined, subjectId: subjectId || undefined, limit: 500 },
        })
      ).data.data || [],
    enabled: !!yearId && isAdmin && tab === 'sessions',
  });

  const totals = overview?.totals;
  const bySubject = overview?.bySubject || [];
  const byClass = overview?.byClass || [];
  const currentClass = classes?.find((c: any) => c.id === classId);

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md text-center" accent="info">
        <ClipboardCheck className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
        <p className="font-display text-base font-bold text-ds-text">Vue d'ensemble des présences</p>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Cette vue est réservée à l'administration. Les enseignants font l'appel depuis leur espace « Liste de Présence ».
        </p>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-7xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Liste de présence</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Cumul des présences saisies par les enseignants, matière par matière, sur l'année scolaire sélectionnée.
        </p>
      </div>

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="ds-field">
            <span>Année scolaire</span>
            <Select
              placeholder="Sélectionner…"
              value={yearId || undefined}
              onChange={(v) => setYearId(v)}
              options={(years || []).map((y: any) => ({
                value: y.id,
                label: `${y.name}${y.isCurrent ? ' (En cours)' : ''}`,
              }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Classe</span>
            <Select
              placeholder="Toutes les classes"
              allowClear
              value={classId || undefined}
              onChange={(v) => {
                setClassId(v || '');
                setSubjectId('');
                setExpanded(null);
              }}
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Matière</span>
            <Select
              placeholder="Toutes les matières"
              allowClear
              showSearch
              optionFilterProp="label"
              value={subjectId || undefined}
              onChange={(v) => setSubjectId(v || '')}
              options={subjectOptions}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </Card>

      {isLoading || !totals ? (
        <div className="ds-stat-grid mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} className="rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="ds-stat-grid mb-4">
          <Stat
            label="Séances effectuées"
            value={totals.sessions}
            hint={`${totals.subjects} matière${totals.subjects > 1 ? 's' : ''} · ${totals.classes} classe${totals.classes > 1 ? 's' : ''}`}
            icon={<CalendarCheck width={20} height={20} aria-hidden />}
          />
          <Stat
            label="Pointages cumulés"
            value={totals.marks}
            hint={`sur ${totals.expected} attendus (séances × effectif)`}
            icon={<Layers width={20} height={20} aria-hidden />}
          />
          <Stat
            label="Taux de présence"
            value={pct(totals.rate)}
            hint={`${totals.present} présents · ${totals.late} retards`}
            icon={<Percent width={20} height={20} aria-hidden />}
          />
          <Stat
            label="Absences"
            value={totals.absent + totals.excused}
            hint={`dont ${totals.excused} excusée${totals.excused > 1 ? 's' : ''}`}
            icon={<UserX width={20} height={20} aria-hidden />}
          />
        </div>
      )}

      <Tabs
        className="mb-4"
        aria-label="Vues présence"
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={[
          { key: 'subjects', label: 'Par matière' },
          { key: 'students', label: 'Par élève' },
          { key: 'sessions', label: 'Séances' },
        ]}
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={52} className="rounded-lg" />
          ))}
        </div>
      ) : tab === 'students' ? (
        <StudentsTab
          overview={overview}
          className={currentClass?.name}
          hasClass={!!classId}
          expanded={expanded}
          onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
        />
      ) : tab === 'sessions' ? (
        <SessionsTab sessions={sessions} isLoading={sessionsLoading} onOpen={setDetailId} />
      ) : bySubject.length === 0 ? (
        <Empty
          title="Aucune séance enregistrée"
          hint="Aucun appel n'a encore été fait pour ces filtres. Les enseignants saisissent les présences depuis leur espace."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="ds-table-wrap">
            <table className="ds-hist-table">
              <thead>
                <tr>
                  <th>Matière</th>
                  <th>Enseignant(s)</th>
                  <th>Séances</th>
                  <th>Pointages</th>
                  <th>Présents</th>
                  <th>Retards</th>
                  <th>Absents</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {bySubject.map((s: any) => (
                  <tr key={s.subjectId}>
                    <td>
                      <strong className="text-ds-text">{s.name}</strong>
                      {s.code && <span className="ml-2 font-mono text-xs text-ds-text-tertiary">{s.code}</span>}
                    </td>
                    <td className="text-ds-text-secondary">{s.teachers?.join(', ') || '—'}</td>
                    <td className="ds-hist-count">{s.sessions}</td>
                    <td className="ds-hist-count text-ds-text-secondary">
                      {s.marks}
                      <span className="text-ds-text-tertiary"> / {s.expected}</span>
                    </td>
                    <td className="ds-hist-count ds-c-present">{s.present}</td>
                    <td className="ds-hist-count ds-c-late">{s.late}</td>
                    <td className="ds-hist-count ds-c-absent">{s.absent + s.excused}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" icon={<Eye aria-hidden />} onClick={() => setOpenSubject(s)}>
                        Voir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {byClass.length > 1 && (
            <div>
              <h2 className="mb-2 font-display text-base font-bold text-ds-text">Cumul par classe</h2>
              <div className="ds-table-wrap">
                <table className="ds-hist-table">
                  <thead>
                    <tr>
                      <th>Classe</th>
                      <th>Effectif</th>
                      <th>Matières</th>
                      <th>Séances</th>
                      <th>Pointages</th>
                      <th>Présents</th>
                      <th>Retards</th>
                      <th>Absents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byClass.map((c: any) => (
                      <tr key={c.classId}>
                        <td>
                          <strong className="text-ds-text">{c.name}</strong>
                        </td>
                        <td className="ds-hist-count text-ds-text-secondary">{c.students}</td>
                        <td className="ds-hist-count text-ds-text-secondary">{c.subjects}</td>
                        <td className="ds-hist-count">{c.sessions}</td>
                        <td className="ds-hist-count text-ds-text-secondary">
                          {c.marks}
                          <span className="text-ds-text-tertiary"> / {c.expected}</span>
                        </td>
                        <td className="ds-hist-count ds-c-present">{c.present}</td>
                        <td className="ds-hist-count ds-c-late">{c.late}</td>
                        <td className="ds-hist-count ds-c-absent">{c.absent + c.excused}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <SubjectDetailModal
        subject={openSubject}
        onClose={() => setOpenSubject(null)}
        yearId={yearId}
        classId={classId}
        byStudent={overview?.byStudent || []}
        onOpenSession={setDetailId}
      />

      <AttendanceSessionDetailModal sessionId={detailId} onClose={() => setDetailId(null)} showTeacher />
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="text-center" accent="info">
      <ClipboardCheck className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
      <p className="font-display font-bold text-ds-text">{title}</p>
      <p className="mt-1 text-sm text-ds-text-secondary">{hint}</p>
    </Card>
  );
}

/** Cumul par élève : une ligne par élève, dépliable sur le détail par matière. */
function StudentsTab({
  overview,
  className,
  hasClass,
  expanded,
  onToggle,
}: {
  overview: any;
  className?: string;
  hasClass: boolean;
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  if (!hasClass) {
    return (
      <Empty
        title="Sélectionnez une classe"
        hint="Le cumul par élève se calcule classe par classe. Choisissez une classe dans les filtres ci-dessus."
      />
    );
  }

  const byStudent = overview?.byStudent || [];
  const sessions = overview?.totals?.sessions ?? 0;

  if (!byStudent.length) {
    return <Empty title="Aucun élève" hint="Cette classe ne compte aucun élève actif." />;
  }

  return (
    <div className="ds-table-wrap">
      <table className="ds-hist-table">
        <thead>
          <tr>
            <th>Élève</th>
            <th>Matricule</th>
            <th>Séances</th>
            <th>Pointé</th>
            <th>Présents</th>
            <th>Retards</th>
            <th>Absents</th>
            <th>Excusés</th>
            <th>Taux</th>
            <th aria-label="Détail" />
          </tr>
        </thead>
        <tbody>
          {byStudent.map((st: any) => (
            <Fragment key={st.studentId}>
              <tr>
                <td>
                  <strong className="text-ds-text">
                    {st.lastName} {st.firstName}
                  </strong>
                </td>
                <td className="font-mono text-xs text-ds-text-tertiary">{st.studentNumber || '—'}</td>
                <td className="ds-hist-count text-ds-text-secondary">{sessions}</td>
                <td className="ds-hist-count text-ds-text-secondary">
                  {st.marks}
                  {st.missing > 0 && <span className="text-ds-text-tertiary"> (−{st.missing})</span>}
                </td>
                <td className="ds-hist-count ds-c-present">{st.present}</td>
                <td className="ds-hist-count ds-c-late">{st.late}</td>
                <td className="ds-hist-count ds-c-absent">{st.absent}</td>
                <td className="ds-hist-count text-ds-text-secondary">{st.excused}</td>
                <td className={`ds-hist-count ${rateClass(st.rate)}`}>{pct(st.rate)}</td>
                <td className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<BookOpen aria-hidden />}
                    onClick={() => onToggle(st.studentId)}
                  >
                    {expanded === st.studentId ? 'Masquer' : 'Matières'}
                  </Button>
                </td>
              </tr>
              {expanded === st.studentId && (
                <tr>
                  <td colSpan={10} className="bg-ds-subtle">
                    {st.bySubject.length === 0 ? (
                      <p className="py-2 text-sm text-ds-text-tertiary">Aucun pointage pour cet élève.</p>
                    ) : (
                      <ul className="ds-hist-detail">
                        {st.bySubject.map((sub: any) => (
                          <li key={sub.subjectId}>
                            <span>
                              <strong>{sub.name}</strong>
                              <span className="text-ds-text-tertiary">
                                {' '}
                                · {sub.marks}/{sub.sessions} séances pointées
                              </span>
                            </span>
                            <span className="flex items-center gap-3 font-mono text-xs">
                              <span className="ds-c-present">{sub.present} P</span>
                              <span className="ds-c-late">{sub.late} R</span>
                              <span className="ds-c-absent">{sub.absent + sub.excused} A</span>
                              <span className={rateClass(sub.rate)}>{pct(sub.rate)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {className && (
        <p className="border-t border-ds-border px-4 py-2 text-xs text-ds-text-tertiary">
          {byStudent.length} élève{byStudent.length > 1 ? 's' : ''} · {className} · {sessions} séance
          {sessions > 1 ? 's' : ''} dans le périmètre sélectionné.
        </p>
      )}
    </div>
  );
}

/** Liste des séances (tous enseignants), avec ouverture du détail de l'appel. */
function SessionsTab({
  sessions,
  isLoading,
  onOpen,
}: {
  sessions: any[] | undefined;
  isLoading: boolean;
  onOpen: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={52} className="rounded-lg" />
        ))}
      </div>
    );
  }

  if (!sessions?.length) {
    return <Empty title="Aucune séance" hint="Aucun appel enregistré pour ces filtres." />;
  }

  return (
    <div className="ds-table-wrap">
      <table className="ds-hist-table">
        <thead>
          <tr>
            <th>Séance</th>
            <th>Date</th>
            <th>Créneau</th>
            <th>Classe</th>
            <th>Matière</th>
            <th>Présents</th>
            <th>Retards</th>
            <th>Absents</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s: any) => (
            <tr key={s.id}>
              <td>
                <span className="ds-seance-badge">
                  <Hash width={13} height={13} aria-hidden />
                  {s.session_number}
                </span>
              </td>
              <td className="whitespace-nowrap">{dayjs(s.date).format('ddd D MMM YYYY')}</td>
              <td className="whitespace-nowrap text-ds-text-secondary">
                {s.start_time ? `${s.start_time}–${s.end_time || ''}` : '—'}
              </td>
              <td>{s.class?.name}</td>
              <td>{s.subject?.name}</td>
              <td className="ds-hist-count ds-c-present">{s.counts?.present ?? 0}</td>
              <td className="ds-hist-count ds-c-late">{s.counts?.late ?? 0}</td>
              <td className="ds-hist-count ds-c-absent">{(s.counts?.absent ?? 0) + (s.counts?.excused ?? 0)}</td>
              <td className="text-right">
                <Button variant="ghost" size="sm" icon={<Eye aria-hidden />} onClick={() => onOpen(s.id)}>
                  Voir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Détail d'une matière (bouton « Voir » de l'onglet « Par matière ») : cumul par
 * élève si une classe est sélectionnée, puis liste des séances de la matière.
 */
function SubjectDetailModal({
  subject,
  onClose,
  yearId,
  classId,
  byStudent,
  onOpenSession,
}: {
  subject: any | null;
  onClose: () => void;
  yearId: string;
  classId: string;
  byStudent: any[];
  onOpenSession: (id: string) => void;
}) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['attendance-sessions-admin', yearId, classId, subject?.subjectId],
    queryFn: async () =>
      (
        await api.get('/attendance-sessions', {
          params: {
            academicYearId: yearId,
            classId: classId || undefined,
            subjectId: subject.subjectId,
            limit: 500,
          },
        })
      ).data.data || [],
    enabled: !!subject && !!yearId,
  });

  // Cumul par élève restreint à la matière ouverte (disponible seulement quand
  // une classe est sélectionnée — le cumul élève se calcule classe par classe).
  const students = useMemo(() => {
    if (!subject) return [];
    return byStudent
      .map((st: any) => ({ ...st, sub: st.bySubject.find((x: any) => x.subjectId === subject.subjectId) }))
      .filter((st: any) => st.sub);
  }, [byStudent, subject]);

  return (
    <Modal
      open={!!subject}
      onClose={onClose}
      width={860}
      title={
        subject ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{subject.name}</span>
            <span className="text-sm font-normal text-ds-text-secondary">
              {subject.sessions} séance{subject.sessions > 1 ? 's' : ''} · {subject.marks} pointages ·{' '}
              <span className={rateClass(subject.rate)}>{pct(subject.rate)} de présence</span>
            </span>
          </span>
        ) : (
          'Détail de la matière'
        )
      }
    >
      {!subject ? null : (
        <div className="flex flex-col gap-5">
          {classId ? (
            <section>
              <h3 className="mb-2 font-display text-sm font-bold text-ds-text">Cumul par élève</h3>
              {students.length === 0 ? (
                <p className="text-sm text-ds-text-tertiary">Aucun élève pointé pour cette matière.</p>
              ) : (
                <div className="ds-table-wrap">
                  <table className="ds-hist-table">
                    <thead>
                      <tr>
                        <th>Élève</th>
                        <th>Matricule</th>
                        <th>Pointé</th>
                        <th>Présents</th>
                        <th>Retards</th>
                        <th>Absents</th>
                        <th>Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st: any) => (
                        <tr key={st.studentId}>
                          <td>
                            <strong className="text-ds-text">
                              {st.lastName} {st.firstName}
                            </strong>
                          </td>
                          <td className="font-mono text-xs text-ds-text-tertiary">{st.studentNumber || '—'}</td>
                          <td className="ds-hist-count text-ds-text-secondary">
                            {st.sub.marks} / {st.sub.sessions}
                          </td>
                          <td className="ds-hist-count ds-c-present">{st.sub.present}</td>
                          <td className="ds-hist-count ds-c-late">{st.sub.late}</td>
                          <td className="ds-hist-count ds-c-absent">{st.sub.absent + st.sub.excused}</td>
                          <td className={`ds-hist-count ${rateClass(st.sub.rate)}`}>{pct(st.sub.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <p className="text-sm text-ds-text-secondary">
              Sélectionnez une classe dans les filtres pour obtenir le cumul par élève de cette matière.
            </p>
          )}

          <section>
            <h3 className="mb-2 font-display text-sm font-bold text-ds-text">Séances</h3>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={44} className="rounded-lg" />
                ))}
              </div>
            ) : !sessions?.length ? (
              <p className="text-sm text-ds-text-tertiary">Aucune séance enregistrée.</p>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-hist-table">
                  <thead>
                    <tr>
                      <th>Séance</th>
                      <th>Date</th>
                      <th>Créneau</th>
                      <th>Classe</th>
                      <th>Présents</th>
                      <th>Retards</th>
                      <th>Absents</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s: any) => (
                      <tr key={s.id}>
                        <td>
                          <span className="ds-seance-badge">
                            <Hash width={13} height={13} aria-hidden />
                            {s.session_number}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">{dayjs(s.date).format('ddd D MMM YYYY')}</td>
                        <td className="whitespace-nowrap text-ds-text-secondary">
                          {s.start_time ? `${s.start_time}–${s.end_time || ''}` : '—'}
                        </td>
                        <td>{s.class?.name}</td>
                        <td className="ds-hist-count ds-c-present">{s.counts?.present ?? 0}</td>
                        <td className="ds-hist-count ds-c-late">{s.counts?.late ?? 0}</td>
                        <td className="ds-hist-count ds-c-absent">
                          {(s.counts?.absent ?? 0) + (s.counts?.excused ?? 0)}
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" icon={<Eye aria-hidden />} onClick={() => onOpenSession(s.id)}>
                            Voir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
