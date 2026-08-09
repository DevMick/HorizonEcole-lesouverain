import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { DatePicker, Select, TimePicker } from 'antd';
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Loader2,
  MoveRight,
  RotateCcw,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Button, Card, Modal, Skeleton, StatusBadge, Tabs, toast } from '../components/ds';

dayjs.locale('fr');

/**
 * Rattrapage & déplacement de cours (§9.6).
 *
 * Deux gestes sur une occurrence de l'emploi du temps, un même écran :
 *  - **rattrapage** — une séance passée n'a pas eu lieu (le serveur la déduit :
 *    occurrence passée sans appel), on la reprogramme ou on l'écarte (férié,
 *    vacances — le système n'a pas de calendrier de fermeture) ;
 *  - **déplacement** — un cours *à venir*, lu depuis l'emploi du temps, est
 *    reporté à une autre heure ou un autre jour.
 *
 * Dans les deux cas la disponibilité est vérifiée en direct pendant la saisie
 * (enseignant *et* classe), et rejouée par le serveur à l'écriture : cet écran
 * n'est qu'un miroir de la règle, jamais son autorité.
 */

interface MoveRequestInfo {
  id: string;
  status: 'PENDING' | 'REJECTED';
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  adminNote: string | null;
}

interface Occurrence {
  timetableId: string;
  originalDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isToday?: boolean;
  /** Demande de déplacement en attente ou refusée pour cette occurrence (§9.6bis). */
  moveRequest?: MoveRequestInfo | null;
  class: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string } | null;
  classroom: { id: string; name: string } | null;
}

interface Decision {
  id: string;
  timetableId: string;
  originalDate: string;
  makeupDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: 'SCHEDULED' | 'MOVED' | 'DISMISSED';
  reason: string | null;
  class: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string } | null;
  originalStartTime?: string;
  originalEndTime?: string;
}

type PlanMode = 'MAKEUP' | 'MOVE';

const longDate = (d: string) => dayjs(d).format('dddd D MMMM YYYY');
const shortDate = (d: string) => dayjs(d).format('ddd D MMM');

export default function TeacherMakeupPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'todo' | 'upcoming' | 'planned'>('todo');
  const [semesterId, setSemesterId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [weeks, setWeeks] = useState<number>(4);
  const [planning, setPlanning] = useState<{ occurrence: Occurrence; mode: PlanMode } | null>(null);

  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = useMemo(() => years?.find((y: any) => y.isCurrent) ?? years?.[0], [years]);
  const academicYearId = currentYear?.id;

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: async () => (await api.get('/semesters')).data.data || [],
  });
  const yearSemesters = useMemo(
    () => (semesters || []).filter((s: any) => s.academic_year_id === academicYearId),
    [semesters, academicYearId],
  );

  // L'emploi du temps alimente les filtres classe/matière : on ne propose que
  // ce que l'enseignant enseigne réellement.
  const { data: timetable } = useQuery({
    queryKey: ['teacher-timetable', academicYearId],
    queryFn: async () => (await api.get(`/teachers/me/timetable?academicYearId=${academicYearId}`)).data.data || [],
    enabled: !!academicYearId,
  });
  const classes = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (timetable || []).forEach((t: any) => t.class && m.set(t.class.id, t.class));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable]);
  const subjects = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (timetable || [])
      .filter((t: any) => !classId || t.class?.id === classId)
      .forEach((t: any) => t.subject && m.set(t.subject.id, t.subject));
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [timetable, classId]);

  // La matière doit rester valide quand on change de classe.
  useEffect(() => {
    if (subjectId && !subjects.find((s) => s.id === subjectId)) setSubjectId('');
  }, [subjects, subjectId]);

  const filters = {
    academicYearId,
    ...(semesterId ? { semesterId } : {}),
    ...(classId ? { classId } : {}),
    ...(subjectId ? { subjectId } : {}),
  };

  const { data: candidatesData, isLoading: loadingTodo } = useQuery({
    queryKey: ['makeup-candidates', academicYearId, semesterId, classId, subjectId],
    queryFn: async () => (await api.get('/attendance-makeup/candidates', { params: filters })).data.data,
    enabled: !!academicYearId,
  });
  const candidates: Occurrence[] = candidatesData?.candidates ?? [];
  const period = candidatesData?.period ?? null;

  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: ['makeup-upcoming', academicYearId, semesterId, classId, subjectId, weeks],
    queryFn: async () =>
      (await api.get('/attendance-makeup/upcoming', { params: { ...filters, weeks } })).data.data,
    enabled: !!academicYearId,
  });
  const upcoming: Occurrence[] = upcomingData?.occurrences ?? [];

  const { data: decisions, isLoading: loadingPlanned } = useQuery({
    queryKey: ['makeup-decisions', academicYearId, semesterId, classId, subjectId],
    queryFn: async () => (await api.get('/attendance-makeup', { params: filters })).data.data || [],
    enabled: !!academicYearId,
  });
  const planned: Decision[] = decisions ?? [];

  // Rattrapages / déplacements déjà décidés mais pas encore tenus : ce sont
  // des séances que l'enseignant « doit » encore donner à leur nouvelle date.
  // L'onglet « À rattraper » les affiche à côté des occurrences pas encore
  // traitées — sinon, une fois validées, elles ne se voyaient plus que dans
  // « Décisions », ce qui n'est pas ce que l'enseignant vient y chercher.
  const today = dayjs().format('YYYY-MM-DD');
  const dueSoon: Decision[] = planned.filter((d) => d.status !== 'DISMISSED' && d.makeupDate && d.makeupDate >= today);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['makeup-candidates'] });
    qc.invalidateQueries({ queryKey: ['makeup-upcoming'] });
    qc.invalidateQueries({ queryKey: ['makeup-decisions'] });
    qc.invalidateQueries({ queryKey: ['att-agenda'] });
  };

  const dismissMutation = useMutation({
    mutationFn: async (c: Occurrence) =>
      (await api.post('/attendance-makeup/dismiss', { timetableId: c.timetableId, originalDate: c.originalDate })).data,
    onSuccess: (r) => {
      toast.success(r?.message || 'Séance écartée.');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'action."),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/attendance-makeup/${id}`)).data,
    onSuccess: (r) => {
      toast.success(r?.message || 'Décision annulée.');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'annulation."),
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/attendance-makeup/move-requests/${id}`)).data,
    onSuccess: (r) => {
      toast.success(r?.message || 'Demande annulée.');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'annulation."),
  });

  if (user?.role !== 'TEACHER') {
    return (
      <Card className="mx-auto max-w-md text-center" accent="info">
        <Users className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
        <p className="font-display text-base font-bold text-ds-text">Espace enseignant</p>
        <p className="mt-1 text-sm text-ds-text-secondary">Cet écran est réservé aux comptes enseignant.</p>
      </Card>
    );
  }

  // Tant que l'année n'est pas résolue, les requêtes sont `enabled: false` —
  // React Query les dit donc « non chargeantes », et l'écran afficherait à tort
  // « aucune séance à rattraper ». On considère cet état comme un chargement.
  const loading =
    !academicYearId ||
    (tab === 'todo' ? loadingTodo || loadingPlanned : tab === 'upcoming' ? loadingUpcoming : loadingPlanned);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Rattrapage & déplacement
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Reprogrammez les séances qui n'ont pas eu lieu, ou déplacez un cours à venir de votre emploi du temps.
        </p>
      </div>

      <Card className="mb-4" padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="ds-field">
            <span>Année scolaire</span>
            <Select value={academicYearId} options={(years || []).map((y: any) => ({ value: y.id, label: y.name }))} disabled style={{ width: '100%' }} />
          </label>
          <label className="ds-field">
            <span>Trimestre</span>
            <Select
              placeholder="Toute l'année"
              allowClear
              value={semesterId || undefined}
              onChange={(v) => setSemesterId(v || '')}
              options={yearSemesters.map((s: any) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Classe</span>
            <Select
              placeholder="Toutes"
              allowClear
              value={classId || undefined}
              onChange={(v) => setClassId(v || '')}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Matière</span>
            <Select
              placeholder="Toutes"
              allowClear
              value={subjectId || undefined}
              onChange={(v) => setSubjectId(v || '')}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        aria-label="Vues rattrapage et déplacement"
        value={tab}
        onChange={(k) => setTab(k as 'todo' | 'upcoming' | 'planned')}
        items={[
          {
            key: 'todo',
            label: `À rattraper${candidates.length + dueSoon.length ? ` (${candidates.length + dueSoon.length})` : ''}`,
          },
          { key: 'upcoming', label: `Cours à venir${upcoming.length ? ` (${upcoming.length})` : ''}` },
          { key: 'planned', label: `Décisions${planned.length ? ` (${planned.length})` : ''}` },
        ]}
      />

      {tab === 'upcoming' && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <span className="text-xs text-ds-text-tertiary">Horizon</span>
          <Select
            value={weeks}
            onChange={setWeeks}
            options={[
              { value: 2, label: '2 semaines' },
              { value: 4, label: '4 semaines' },
              { value: 8, label: '8 semaines' },
              { value: 12, label: '12 semaines' },
            ]}
            style={{ width: 140 }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={72} className="rounded-lg" />
          ))}
        </div>
      ) : tab === 'todo' ? (
        candidates.length === 0 && dueSoon.length === 0 ? (
          <Card className="text-center" accent="info">
            <CalendarClock className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
            <p className="font-display font-bold text-ds-text">Aucune séance à rattraper</p>
            <p className="mt-1 text-sm text-ds-text-secondary">
              {period?.notStarted
                ? "La période sélectionnée n'a pas encore commencé : aucun cours n'est encore passé."
                : 'Tous vos cours passés ont un appel enregistré, ou ont déjà été traités.'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <div key={`${c.timetableId}|${c.originalDate}`} className="ds-slot-row">
                    <span className="ds-slot-time">
                      <CalendarX2 width={14} height={14} aria-hidden />
                      {c.startTime}–{c.endTime}
                    </span>
                    <span className="ds-slot-main">
                      <strong>{c.subject?.name ?? '—'}</strong>
                      <span>
                        {c.class?.name ?? '—'} · {longDate(c.originalDate)}
                      </span>
                    </span>
                    <span className="flex flex-none gap-2">
                      <Button
                        size="sm"
                        icon={<CalendarPlus aria-hidden />}
                        onClick={() => setPlanning({ occurrence: c, mode: 'MAKEUP' })}
                      >
                        Programmer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={dismissMutation.isPending}
                        onClick={() => dismissMutation.mutate(c)}
                      >
                        Écarter
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {dueSoon.length > 0 && (
              <div>
                <h2 className="mb-2 font-display text-sm font-bold text-ds-text">
                  Séances programmées, pas encore tenues
                </h2>
                <div className="flex flex-col gap-2">
                  {dueSoon.map((d) => (
                    <div key={d.id} className="ds-slot-row">
                      <span className="ds-slot-time">
                        {d.status === 'MOVED' ? (
                          <MoveRight width={14} height={14} aria-hidden />
                        ) : (
                          <CalendarClock width={14} height={14} aria-hidden />
                        )}
                        {d.startTime}–{d.endTime}
                      </span>
                      <span className="ds-slot-main">
                        <strong>
                          {d.subject?.name ?? '—'} · {d.class?.name ?? '—'}
                        </strong>
                        <span>{decisionLabel(d)}</span>
                      </span>
                      <StatusBadge status={d.status === 'MOVED' ? 'info' : 'success'}>
                        {d.status === 'MOVED' ? 'Déplacé' : 'Rattrapage'}
                      </StatusBadge>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<RotateCcw aria-hidden />}
                        loading={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(d.id)}
                      >
                        Annuler
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : tab === 'upcoming' ? (
        upcoming.length === 0 ? (
          <Card className="text-center" accent="info">
            <CalendarClock className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
            <p className="font-display font-bold text-ds-text">Aucun cours à venir</p>
            <p className="mt-1 text-sm text-ds-text-secondary">
              Sur cet horizon, votre emploi du temps ne comporte aucun cours encore déplaçable.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((o) => (
              <div key={`${o.timetableId}|${o.originalDate}`} className="ds-slot-row">
                <span className="ds-slot-time">
                  <CalendarClock width={14} height={14} aria-hidden />
                  {o.startTime}–{o.endTime}
                </span>
                <span className="ds-slot-main">
                  <strong>{o.subject?.name ?? '—'}</strong>
                  <span>
                    {o.class?.name ?? '—'} · {longDate(o.originalDate)}
                    {o.classroom ? ` · ${o.classroom.name}` : ''}
                  </span>
                  {o.moveRequest?.status === 'REJECTED' && (
                    <span className="ds-c-absent">
                      Demande de déplacement refusée{o.moveRequest.adminNote ? ` — ${o.moveRequest.adminNote}` : ''}
                    </span>
                  )}
                </span>
                {o.isToday && <StatusBadge status="warning">Aujourd'hui</StatusBadge>}
                {o.moveRequest?.status === 'PENDING' ? (
                  <>
                    <StatusBadge status="info">
                      En attente — proposé au {shortDate(o.moveRequest.requestedDate)}
                    </StatusBadge>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancelRequestMutation.isPending}
                      onClick={() => cancelRequestMutation.mutate(o.moveRequest!.id)}
                    >
                      Annuler la demande
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    icon={<MoveRight aria-hidden />}
                    onClick={() => setPlanning({ occurrence: o, mode: 'MOVE' })}
                  >
                    Demander un déplacement
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
      ) : planned.length === 0 ? (
        <Card className="text-center" accent="info">
          <p className="font-display font-bold text-ds-text">Aucune décision</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Les rattrapages, les cours déplacés et les séances écartées apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {planned.map((d) => (
            <div key={d.id} className="ds-slot-row">
              <span className="ds-slot-time">
                {d.status === 'DISMISSED' ? (
                  <CalendarX2 width={14} height={14} aria-hidden />
                ) : (
                  <>
                    {d.status === 'MOVED' ? (
                      <MoveRight width={14} height={14} aria-hidden />
                    ) : (
                      <CalendarClock width={14} height={14} aria-hidden />
                    )}
                    {d.startTime}–{d.endTime}
                  </>
                )}
              </span>
              <span className="ds-slot-main">
                <strong>
                  {d.subject?.name ?? '—'} · {d.class?.name ?? '—'}
                </strong>
                <span>{decisionLabel(d)}</span>
              </span>
              <StatusBadge
                status={d.status === 'SCHEDULED' ? 'success' : d.status === 'MOVED' ? 'info' : 'neutral'}
              >
                {d.status === 'SCHEDULED' ? 'Rattrapage' : d.status === 'MOVED' ? 'Déplacé' : 'Écarté'}
              </StatusBadge>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw aria-hidden />}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(d.id)}
              >
                Annuler
              </Button>
            </div>
          ))}
        </div>
      )}

      {planning && (
        <PlanModal
          occurrence={planning.occurrence}
          mode={planning.mode}
          onClose={() => setPlanning(null)}
          onDone={() => {
            setPlanning(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

/** Phrase d'une décision, selon son geste. */
function decisionLabel(d: Decision): string {
  const from = `Séance du ${longDate(d.originalDate)}`;
  if (d.status === 'DISMISSED') return `${from} — écartée (pas de cours ce jour)`;
  const verb = d.status === 'MOVED' ? 'déplacée au' : 'rattrapée le';
  const origin = d.originalStartTime ? ` (initialement ${d.originalStartTime}–${d.originalEndTime})` : '';
  return `${from}${origin} → ${verb} ${longDate(d.makeupDate!)}`;
}

/**
 * Choix de la date et de l'horaire — rattrapage d'une séance manquée ou
 * déplacement d'un cours à venir. La disponibilité est interrogée pendant la
 * saisie : l'enseignant est averti *avant* de valider, pas après un refus.
 */
function PlanModal({
  occurrence,
  mode,
  onClose,
  onDone,
}: {
  occurrence: Occurrence;
  mode: PlanMode;
  onClose: () => void;
  onDone: () => void;
}) {
  const isMove = mode === 'MOVE';
  const [date, setDate] = useState<dayjs.Dayjs | null>(
    isMove ? dayjs(occurrence.originalDate) : dayjs().add(1, 'day'),
  );
  const [start, setStart] = useState<dayjs.Dayjs | null>(dayjs(occurrence.startTime, 'HH:mm'));
  const [end, setEnd] = useState<dayjs.Dayjs | null>(dayjs(occurrence.endTime, 'HH:mm'));
  const [reason, setReason] = useState('');

  const dateStr = date?.format('YYYY-MM-DD') ?? '';
  const startStr = start?.format('HH:mm') ?? '';
  const endStr = end?.format('HH:mm') ?? '';
  const complete = !!(dateStr && startStr && endStr);

  // Contrôle de disponibilité en direct (enseignant *et* classe). Le serveur
  // rejoue la même vérification à l'écriture : ceci ne fait qu'anticiper.
  const { data: check, isFetching: checking } = useQuery({
    queryKey: ['makeup-conflicts', occurrence.timetableId, occurrence.originalDate, dateStr, startStr, endStr],
    queryFn: async () =>
      (
        await api.get('/attendance-makeup/conflicts', {
          params: {
            timetableId: occurrence.timetableId,
            originalDate: occurrence.originalDate,
            date: dateStr,
            startTime: startStr,
            endTime: endStr,
          },
        })
      ).data.data as { conflicts: { kind: string; label: string }[]; blocked: boolean; message: string | null },
    enabled: complete,
    staleTime: 0,
  });

  const unchanged =
    isMove &&
    dateStr === occurrence.originalDate &&
    startStr === occurrence.startTime &&
    endStr === occurrence.endTime;

  const mutation = useMutation({
    mutationFn: async () =>
      isMove
        ? (
            await api.post('/attendance-makeup/move', {
              timetableId: occurrence.timetableId,
              originalDate: occurrence.originalDate,
              newDate: dateStr,
              startTime: startStr,
              endTime: endStr,
              reason: reason || null,
            })
          ).data
        : (
            await api.post('/attendance-makeup', {
              timetableId: occurrence.timetableId,
              originalDate: occurrence.originalDate,
              makeupDate: dateStr,
              startTime: startStr,
              endTime: endStr,
              reason: reason || null,
            })
          ).data,
    onSuccess: (r) => {
      toast.success(r?.message || (isMove ? 'Demande envoyée.' : 'Rattrapage programmé.'));
      onDone();
    },
    // Le serveur renvoie 409 avec le cours en conflit : on l'affiche tel quel.
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'enregistrement."),
  });

  const canSubmit = complete && !unchanged && !check?.blocked && !checking;

  return (
    <Modal open onClose={onClose} title={isMove ? 'Demander un déplacement' : 'Programmer un rattrapage'}>
      <p className="mb-4 text-sm text-ds-text-secondary">
        {occurrence.subject?.name} · {occurrence.class?.name} — séance du{' '}
        <strong className="text-ds-text">{longDate(occurrence.originalDate)}</strong> ({occurrence.startTime}–
        {occurrence.endTime}).
        {isMove && " La date choisie est une proposition : l'administration doit la valider avant que le cours ne soit effectivement déplacé."}
      </p>

      <div className="flex flex-col gap-3">
        <label className="ds-field">
          <span>{isMove ? 'Nouvelle date' : 'Date du rattrapage'}</span>
          <DatePicker
            value={date}
            onChange={setDate}
            format="DD/MM/YYYY"
            allowClear={false}
            // L'appel n'est possible que le jour du cours : une date passée
            // serait inappelable. Un rattrapage doit en plus suivre la séance
            // manquée. Le serveur applique les mêmes règles.
            disabledDate={(d) =>
              d.isBefore(dayjs(), 'day') ||
              d.day() === 0 ||
              (!isMove && !d.isAfter(dayjs(occurrence.originalDate), 'day'))
            }
            style={{ width: '100%' }}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="ds-field">
            <span>Début</span>
            <TimePicker value={start} onChange={setStart} format="HH:mm" minuteStep={5} allowClear={false} style={{ width: '100%' }} />
          </label>
          <label className="ds-field">
            <span>Fin</span>
            <TimePicker value={end} onChange={setEnd} format="HH:mm" minuteStep={5} allowClear={false} style={{ width: '100%' }} />
          </label>
        </div>
        <label className="ds-field">
          <span>Motif (facultatif)</span>
          <input
            className="ds-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isMove ? 'Réunion, indisponibilité…' : 'Absence, jour férié déplacé…'}
          />
        </label>

        {/* Disponibilité du créneau visé — l'alerte précède la validation. */}
        {complete && (
          <ConflictNotice
            checking={checking}
            blocked={!!check?.blocked}
            message={check?.message ?? null}
            conflicts={check?.conflicts ?? []}
            unchanged={unchanged}
            targetLabel={`${shortDate(dateStr)} ${startStr}–${endStr}`}
          />
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {isMove ? 'Envoyer la demande' : 'Programmer'}
        </Button>
      </div>
    </Modal>
  );
}

/** Bandeau de disponibilité du créneau visé (§9.6). */
function ConflictNotice({
  checking,
  blocked,
  message,
  conflicts,
  unchanged,
  targetLabel,
}: {
  checking: boolean;
  blocked: boolean;
  message: string | null;
  conflicts: { kind: string; label: string }[];
  unchanged: boolean;
  targetLabel: string;
}) {
  if (unchanged) {
    return (
      <div className="ds-notice ds-notice-neutral" role="status">
        <AlertTriangle width={16} height={16} aria-hidden />
        <span>Ce sont la date et l'horaire actuels du cours : modifiez-en un pour le déplacer.</span>
      </div>
    );
  }
  if (checking) {
    return (
      <div className="ds-notice ds-notice-neutral" role="status">
        <Loader2 width={16} height={16} className="animate-spin" aria-hidden />
        <span>Vérification de la disponibilité…</span>
      </div>
    );
  }
  if (blocked) {
    return (
      <div className="ds-notice ds-notice-danger" role="alert">
        <AlertTriangle width={16} height={16} aria-hidden />
        <span>
          {message}
          {conflicts.length > 1 && ` (+${conflicts.length - 1} autre${conflicts.length > 2 ? 's' : ''})`}
        </span>
      </div>
    );
  }
  return (
    <div className="ds-notice ds-notice-success" role="status">
      <CheckCircle2 width={16} height={16} aria-hidden />
      <span>Créneau libre le {targetLabel} — pour vous comme pour la classe.</span>
    </div>
  );
}
