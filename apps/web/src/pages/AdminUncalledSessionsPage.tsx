import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { DatePicker, Select, TimePicker } from 'antd';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  MoveRight,
  ShieldAlert,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Button, Card, Modal, Skeleton, StatusBadge, Tabs, toast } from '../components/ds';
import { cn } from '../lib/utils';

dayjs.locale('fr');

/**
 * Page admin « Séances non tenues » (§9.6ter).
 *
 * Deux situations distinctes, un seul menu :
 *  - un enseignant n'a pas fait l'appel dans le délai de grâce (10 min après
 *    le début du cours) ou a laissé passer une séance sans décision → l'admin
 *    peut faire l'appel à sa place ;
 *  - un enseignant a demandé à déplacer un cours à venir → l'admin valide (à
 *    la date demandée ou à une autre) ou refuse.
 */

const longDate = (d: string) => dayjs(d).format('dddd D MMMM YYYY');

interface UncalledSession {
  timetableId: string;
  originalDate: string;
  makeupOf: string | null;
  occurrenceKind: 'MAKEUP' | 'MOVE' | null;
  startTime: string;
  endTime: string;
  graceEndsAt: string;
  isToday: boolean;
  academicYearId: string;
  class: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string } | null;
  classroom: { id: string; name: string } | null;
  teacher: { id: string; first_name: string; last_name: string } | null;
}

interface MoveRequest {
  id: string;
  timetableId: string;
  originalDate: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  class: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string } | null;
  teacher: { id: string; first_name: string; last_name: string } | null;
  originalStartTime?: string;
  originalEndTime?: string;
}

const teacherName = (t: { first_name?: string; last_name?: string } | null) =>
  t ? `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || '—' : '—';

export default function AdminUncalledSessionsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';

  const [tab, setTab] = useState<'uncalled' | 'requests'>('uncalled');
  const [semesterId, setSemesterId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [callSession, setCallSession] = useState<UncalledSession | null>(null);
  const [reviewing, setReviewing] = useState<MoveRequest | null>(null);

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

  const { data: classes } = useQuery({
    queryKey: ['school-classes-all'],
    queryFn: async () => (await api.get('/school-classes')).data.data || [],
  });
  const { data: allSubjects } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => (await api.get('/subjects')).data.data || [],
  });
  const { data: teachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn: async () => {
      const b = (await api.get('/teachers?limit=1000')).data;
      return b.data || b.teachers || [];
    },
  });

  const filters = {
    academicYearId,
    ...(semesterId ? { semesterId } : {}),
    ...(classId ? { classId } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(teacherId ? { teacherId } : {}),
  };

  const { data: uncalledData, isLoading: loadingUncalled } = useQuery({
    queryKey: ['uncalled-sessions', academicYearId, semesterId, classId, subjectId, teacherId],
    queryFn: async () => (await api.get('/attendance-makeup/uncalled', { params: filters })).data.data,
    enabled: !!academicYearId && isAdmin,
    refetchInterval: 60_000,
  });
  const uncalled: UncalledSession[] = uncalledData?.sessions ?? [];

  const { data: requestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['move-requests-pending', academicYearId, classId, subjectId, teacherId],
    queryFn: async () =>
      (
        await api.get('/attendance-makeup/move-requests/pending', {
          params: { academicYearId, classId: classId || undefined, subjectId: subjectId || undefined, teacherId: teacherId || undefined },
        })
      ).data.data || [],
    enabled: !!academicYearId && isAdmin,
  });
  const requests: MoveRequest[] = requestsData ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['uncalled-sessions'] });
    qc.invalidateQueries({ queryKey: ['move-requests-pending'] });
    qc.invalidateQueries({ queryKey: ['makeup-decisions'] });
    qc.invalidateQueries({ queryKey: ['makeup-upcoming'] });
    qc.invalidateQueries({ queryKey: ['att-agenda'] });
  };

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md text-center" accent="info">
        <ShieldAlert className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
        <p className="font-display text-base font-bold text-ds-text">Espace administration</p>
        <p className="mt-1 text-sm text-ds-text-secondary">Cet écran est réservé aux comptes administrateur.</p>
      </Card>
    );
  }

  const loading = !academicYearId || (tab === 'uncalled' ? loadingUncalled : loadingRequests);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Séances non tenues</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Séances sans appel au-delà du délai de grâce, et demandes de déplacement de cours en attente de validation.
        </p>
      </div>

      <Card className="mb-4" padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              options={(classes || []).map((c: any) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Matière</span>
            <Select
              placeholder="Toutes"
              allowClear
              showSearch
              optionFilterProp="label"
              value={subjectId || undefined}
              onChange={(v) => setSubjectId(v || '')}
              options={(allSubjects || []).map((s: any) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ds-field">
            <span>Enseignant</span>
            <Select
              placeholder="Tous"
              allowClear
              showSearch
              optionFilterProp="label"
              value={teacherId || undefined}
              onChange={(v) => setTeacherId(v || '')}
              options={(teachers || []).map((t: any) => ({ value: t.id, label: `${t.last_name ?? ''} ${t.first_name ?? ''}`.trim() }))}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </Card>

      <Tabs
        className="mb-4"
        aria-label="Vues séances non tenues"
        value={tab}
        onChange={(k) => setTab(k as 'uncalled' | 'requests')}
        items={[
          { key: 'uncalled', label: `Séances non tenues${uncalled.length ? ` (${uncalled.length})` : ''}` },
          { key: 'requests', label: `Demandes de déplacement${requests.length ? ` (${requests.length})` : ''}` },
        ]}
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={72} className="rounded-lg" />
          ))}
        </div>
      ) : tab === 'uncalled' ? (
        uncalled.length === 0 ? (
          <Card className="text-center" accent="info">
            <CheckCircle2 className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
            <p className="font-display font-bold text-ds-text">Aucune séance non tenue</p>
            <p className="mt-1 text-sm text-ds-text-secondary">
              Tous les cours de la période sélectionnée ont un appel enregistré, dans le délai imparti.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {uncalled.map((s) => (
              <div key={`${s.timetableId}|${s.originalDate}`} className="ds-slot-row">
                <span className="ds-slot-time">
                  <Clock width={14} height={14} aria-hidden />
                  {s.startTime}–{s.endTime}
                </span>
                <span className="ds-slot-main">
                  <strong>
                    {s.subject?.name ?? '—'} · {s.class?.name ?? '—'}
                  </strong>
                  <span>
                    {teacherName(s.teacher)} — {longDate(s.originalDate)}
                    {s.occurrenceKind === 'MOVE' && s.makeupOf && ` (déplacé depuis le ${longDate(s.makeupOf)})`}
                    {s.occurrenceKind === 'MAKEUP' && s.makeupOf && ` (rattrapage du ${longDate(s.makeupOf)})`}
                  </span>
                </span>
                <StatusBadge status="danger">{s.isToday ? 'Délai dépassé' : 'Non fait'}</StatusBadge>
                <Button size="sm" icon={<Check aria-hidden />} onClick={() => setCallSession(s)}>
                  Faire l'appel
                </Button>
              </div>
            ))}
          </div>
        )
      ) : requests.length === 0 ? (
        <Card className="text-center" accent="info">
          <CheckCircle2 className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucune demande en attente</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Les demandes de déplacement de cours soumises par les enseignants apparaîtront ici.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="ds-slot-row">
              <span className="ds-slot-time">
                <MoveRight width={14} height={14} aria-hidden />
                {r.requestedStartTime}–{r.requestedEndTime}
              </span>
              <span className="ds-slot-main">
                <strong>
                  {r.subject?.name ?? '—'} · {r.class?.name ?? '—'}
                </strong>
                <span>
                  {teacherName(r.teacher)} — séance du {longDate(r.originalDate)}
                  {r.originalStartTime ? ` (${r.originalStartTime}–${r.originalEndTime})` : ''} → proposé au{' '}
                  {longDate(r.requestedDate)}
                </span>
                {r.reason && <span className="text-ds-text-tertiary">Motif : {r.reason}</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setReviewing(r)}>
                Examiner
              </Button>
            </div>
          ))}
        </div>
      )}

      {callSession && (
        <AdminCallModal session={callSession} onClose={() => setCallSession(null)} onDone={() => { setCallSession(null); invalidate(); }} />
      )}

      {reviewing && (
        <ReviewRequestModal request={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); invalidate(); }} />
      )}
    </div>
  );
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

type CallStatus = 'PRESENT' | 'LATE' | 'ABSENT';

/**
 * Appel fait par l'administration à la place de l'enseignant, pour une séance
 * non tenue. Mêmes champs que l'appel enseignant (§9.6), sans fenêtre
 * temporelle : `POST /attendance-sessions` en tant qu'ADMIN l'ignore.
 */
function AdminCallModal({
  session,
  onClose,
  onDone,
}: {
  session: UncalledSession;
  onClose: () => void;
  onDone: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, CallStatus>>({});

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['attendance-roster', session.class?.id],
    queryFn: async () => (await api.get(`/school-students?classId=${session.class?.id}&limit=1000`)).data.data || [],
    enabled: !!session.class?.id,
  });

  useEffect(() => {
    if (!roster) return;
    const next: Record<string, CallStatus> = {};
    (roster as any[]).forEach((s) => {
      next[s.id] = 'PRESENT';
    });
    setStatuses(next);
  }, [roster]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/attendance-sessions', {
          academicYearId: session.academicYearId,
          classId: session.class?.id,
          subjectId: session.subject?.id,
          teacherId: session.teacher?.id,
          date: session.originalDate,
          timetableId: session.timetableId,
          records: (roster || []).map((s: any) => ({ studentId: s.id, status: statuses[s.id] || 'PRESENT' })),
        })
      ).data,
    onSuccess: (res) => {
      toast.success(res?.message || 'Appel enregistré.');
      onDone();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'enregistrement de l'appel."),
  });

  const students = (roster as any[]) || [];
  const counts = students.reduce(
    (acc, s) => {
      const st = statuses[s.id] || 'PRESENT';
      acc[st === 'PRESENT' ? 'present' : st === 'LATE' ? 'late' : 'absent']++;
      return acc;
    },
    { present: 0, late: 0, absent: 0 },
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={`Appel — ${session.subject?.name ?? ''} · ${session.class?.name ?? ''}`}
    >
      <p className="mb-4 text-sm text-ds-text-secondary">
        {teacherName(session.teacher)} — séance du <strong className="text-ds-text">{longDate(session.originalDate)}</strong> (
        {session.startTime}–{session.endTime}). Non tenue par l'enseignant : vous faites l'appel à sa place.
      </p>

      {rosterLoading ? (
        <div className="ds-att-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={64} className="rounded-lg" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className="text-sm text-ds-text-tertiary">Cette classe ne contient aucun élève inscrit.</p>
      ) : (
        <>
          <div className="ds-att-grid">
            {students.map((s) => {
              const st = statuses[s.id] || 'PRESENT';
              return (
                <div key={s.id} className={cn('ds-att-card', `ds-status-${st.toLowerCase()}`)}>
                  <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>
                    {initials(s.firstName, s.lastName)}
                  </span>
                  <span className="ds-att-name">
                    <strong>
                      {s.firstName} {s.lastName}
                    </strong>
                    <span>{s.studentNumber || '—'}</span>
                  </span>
                  <span className="ds-att-actions" role="group" aria-label={`Statut de ${s.firstName} ${s.lastName}`}>
                    <button
                      type="button"
                      title="Présent"
                      aria-pressed={st === 'PRESENT'}
                      className={cn('ds-att-btn ds-present', st === 'PRESENT' && 'ds-on')}
                      onClick={() => setStatuses((p) => ({ ...p, [s.id]: 'PRESENT' }))}
                    >
                      <Check aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Retard"
                      aria-pressed={st === 'LATE'}
                      className={cn('ds-att-btn ds-late', st === 'LATE' && 'ds-on')}
                      onClick={() => setStatuses((p) => ({ ...p, [s.id]: 'LATE' }))}
                    >
                      <Clock aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Absent"
                      aria-pressed={st === 'ABSENT'}
                      className={cn('ds-att-btn ds-absent', st === 'ABSENT' && 'ds-on')}
                      onClick={() => setStatuses((p) => ({ ...p, [s.id]: 'ABSENT' }))}
                    >
                      <X aria-hidden />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs text-ds-text-tertiary">
              {students.length} élève{students.length > 1 ? 's' : ''} · {counts.present} présents · {counts.late} retards ·{' '}
              {counts.absent} absents
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button icon={<Check aria-hidden />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Enregistrer l'appel
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/**
 * Examen d'une demande de déplacement : valider telle quelle, valider avec une
 * autre date/heure, ou refuser. Le contrôle de conflit est interrogé en direct
 * dès que la date visée (proposée ou modifiée) est complète.
 */
function ReviewRequestModal({
  request,
  onClose,
  onDone,
}: {
  request: MoveRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [overriding, setOverriding] = useState(false);
  const [date, setDate] = useState<dayjs.Dayjs | null>(dayjs(request.requestedDate));
  const [start, setStart] = useState<dayjs.Dayjs | null>(dayjs(request.requestedStartTime, 'HH:mm'));
  const [end, setEnd] = useState<dayjs.Dayjs | null>(dayjs(request.requestedEndTime, 'HH:mm'));
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const dateStr = date?.format('YYYY-MM-DD') ?? '';
  const startStr = start?.format('HH:mm') ?? '';
  const endStr = end?.format('HH:mm') ?? '';
  const complete = !!(dateStr && startStr && endStr);

  const { data: check, isFetching: checking } = useQuery({
    queryKey: ['makeup-conflicts', request.timetableId, request.originalDate, dateStr, startStr, endStr],
    queryFn: async () =>
      (
        await api.get('/attendance-makeup/conflicts', {
          params: {
            timetableId: request.timetableId,
            originalDate: request.originalDate,
            date: dateStr,
            startTime: startStr,
            endTime: endStr,
            teacherId: request.teacher?.id,
          },
        })
      ).data.data as { conflicts: { kind: string; label: string }[]; blocked: boolean; message: string | null },
    enabled: complete,
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/attendance-makeup/move-requests/${request.id}/approve`, {
          date: dateStr,
          startTime: startStr,
          endTime: endStr,
        })
      ).data,
    onSuccess: (r) => {
      toast.success(r?.message || 'Déplacement validé.');
      onDone();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Échec de la validation.'),
  });

  const rejectMutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/attendance-makeup/move-requests/${request.id}/reject`, { adminNote: rejectReason || null })).data,
    onSuccess: (r) => {
      toast.success(r?.message || 'Demande refusée.');
      onDone();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Échec du refus.'),
  });

  return (
    <Modal open onClose={onClose} title="Examiner la demande de déplacement">
      <p className="mb-4 text-sm text-ds-text-secondary">
        {teacherName(request.teacher)} — {request.subject?.name} · {request.class?.name} — séance du{' '}
        <strong className="text-ds-text">{longDate(request.originalDate)}</strong>
        {request.originalStartTime ? ` (${request.originalStartTime}–${request.originalEndTime})` : ''}.
      </p>
      {request.reason && (
        <p className="mb-4 text-sm text-ds-text-secondary">
          Motif de l'enseignant : <span className="text-ds-text">{request.reason}</span>
        </p>
      )}

      {rejecting ? (
        <div className="flex flex-col gap-3">
          <label className="ds-field">
            <span>Motif du refus (facultatif)</span>
            <input
              className="ds-input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Créneau indisponible, motif insuffisant…"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Retour
            </Button>
            <Button
              variant="danger"
              icon={<XCircle aria-hidden />}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Confirmer le refus
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="ds-notice ds-notice-info" role="status">
            <Calendar width={16} height={16} aria-hidden />
            <span>
              Date demandée : <strong>{longDate(request.requestedDate)}</strong> ({request.requestedStartTime}–
              {request.requestedEndTime})
            </span>
          </div>

          {!overriding ? (
            <Button variant="ghost" size="sm" onClick={() => setOverriding(true)}>
              Proposer une autre date
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-ds-border p-3">
              <label className="ds-field">
                <span>Nouvelle date</span>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.day() === 0}
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
            </div>
          )}

          {complete && overriding && (
            <ConflictNotice checking={checking} blocked={!!check?.blocked} message={check?.message ?? null} conflicts={check?.conflicts ?? []} />
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setRejecting(true)}>
              Refuser
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                disabled={!complete || (overriding && (checking || !!check?.blocked))}
                loading={approveMutation.isPending}
                icon={<CheckCircle2 aria-hidden />}
                onClick={() => approveMutation.mutate()}
              >
                {overriding ? 'Valider avec cette date' : 'Valider la date demandée'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ConflictNotice({
  checking,
  blocked,
  message,
  conflicts,
}: {
  checking: boolean;
  blocked: boolean;
  message: string | null;
  conflicts: { kind: string; label: string }[];
}) {
  if (checking) {
    return (
      <div className="ds-notice ds-notice-neutral" role="status">
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
      <span>Créneau libre pour l'enseignant comme pour la classe.</span>
    </div>
  );
}
