import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  BookOpen,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hash,
  Lock,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Button, Card, Skeleton, StatusBadge, toast, type BadgeStatus } from '../ds';
import { cn } from '../../lib/utils';

dayjs.locale('fr');

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

/** Statuts calculés par le serveur (attendance-policy.ts) — jamais recalculés ici. */
type SlotStatus = 'TOO_EARLY' | 'TODO' | 'EDITABLE' | 'DONE' | 'UPCOMING' | 'GRACE_EXPIRED' | 'MISSED';

interface AgendaSlot {
  timetableId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  class: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string } | null;
  classroom: { id: string; name: string } | null;
  startTime: string;
  endTime: string;
  /** Heure limite (HH:MM) du délai de grâce avant confiscation à l'administration. */
  graceEndsAt: string;
  date: string;
  status: SlotStatus;
  writable: boolean;
  sessionId: string | null;
  sessionNumber: number;
  editMinutesLeft: number;
  counts: { present: number; late: number; absent: number; excused: number; total: number } | null;
}

const STATUS_META: Record<SlotStatus, { badge: BadgeStatus; label: string }> = {
  TOO_EARLY: { badge: 'info', label: 'Pas encore commencé' },
  TODO: { badge: 'warning', label: 'Appel à faire' },
  EDITABLE: { badge: 'success', label: 'Appel fait' },
  DONE: { badge: 'neutral', label: 'Verrouillé' },
  UPCOMING: { badge: 'info', label: 'À venir' },
  GRACE_EXPIRED: { badge: 'danger', label: 'Délai dépassé' },
  MISSED: { badge: 'danger', label: 'Non fait' },
};

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

interface Props {
  academicYearId?: string;
}

/**
 * Appel par séance, piloté par l'emploi du temps (§9.6).
 *
 * L'enseignant ne choisit plus « classe + matière + date » : il choisit une
 * séance de son agenda du jour, et classe/matière/horaire en découlent. Les
 * statuts et les droits d'écriture viennent du serveur — ce composant ne décide
 * rien, il reflète. Voir apps/api/src/services/attendance-policy.ts.
 */
export function AttendanceSessionBoard({ academicYearId }: Props) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  const { data: agenda, isLoading } = useQuery({
    queryKey: ['att-agenda', academicYearId, date],
    queryFn: async () =>
      (await api.get('/attendance-sessions/my-agenda', { params: { academicYearId, date } })).data.data,
    enabled: !!academicYearId,
    // Les statuts dépendent du temps (fenêtre de correction) : on les rafraîchit
    // pour que le verrou apparaisse sans recharger la page.
    refetchInterval: 60_000,
  });

  // `enabled: !!academicYearId` : tant que l'année n'est pas résolue, React
  // Query ne considère pas la requête comme chargeante — sans ça l'écran
  // afficherait brièvement « Aucun cours ce jour », ce qui est faux.
  const pending = !academicYearId || isLoading;
  const slots: AgendaSlot[] = agenda?.slots ?? [];
  const openSlot = slots.find((s) => s.timetableId === openSlotId) ?? null;

  // Ouvre d'office la séance à faire (ou la seule séance du jour) : « le système
  // s'adapte » sans clic. On ne force jamais un créneau non inscriptible.
  useEffect(() => {
    if (!slots.length) {
      setOpenSlotId(null);
      return;
    }
    if (openSlotId && slots.some((s) => s.timetableId === openSlotId)) return;
    const target =
      slots.find((s) => s.status === 'TODO') ??
      slots.find((s) => s.status === 'TOO_EARLY') ??
      slots.find((s) => s.writable) ??
      null;
    setOpenSlotId(target?.timetableId ?? null);
  }, [slots, openSlotId]);

  const isToday = date === dayjs().format('YYYY-MM-DD');
  const shiftDay = (n: number) => {
    setDate((d) => dayjs(d).add(n, 'day').format('YYYY-MM-DD'));
    setOpenSlotId(null);
  };

  return (
    <div>
      {/* Navigation par jour — l'appel est adossé à une date de cours */}
      <Card className="mb-4" padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              aria-label="Jour précédent"
              icon={<ChevronLeft aria-hidden />}
              onClick={() => shiftDay(-1)}
            />
            <div className="min-w-[13rem] text-center">
              <p className="font-display text-base font-bold capitalize text-ds-text">
                {dayjs(date).format('dddd D MMMM YYYY')}
              </p>
              <p className="text-xs text-ds-text-secondary">
                {slots.length === 0
                  ? 'Aucun cours'
                  : `${slots.length} séance${slots.length > 1 ? 's' : ''}`}
              </p>
            </div>
            <Button
              variant="ghost"
              aria-label="Jour suivant"
              icon={<ChevronRight aria-hidden />}
              onClick={() => shiftDay(1)}
            />
          </div>
          {!isToday && (
            <Button
              variant="secondary"
              onClick={() => {
                setDate(dayjs().format('YYYY-MM-DD'));
                setOpenSlotId(null);
              }}
            >
              Aujourd'hui
            </Button>
          )}
        </div>
      </Card>

      {pending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={72} className="rounded-lg" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <Card className="text-center" accent="info">
          <CalendarClock className="mx-auto mb-3 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucun cours ce jour</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            L'appel est adossé à votre emploi du temps : il n'y a pas de séance à appeler
            {isToday ? " aujourd'hui" : ' ce jour-là'}.
          </p>
        </Card>
      ) : (
        <>
          {/* Séances du jour */}
          <div className="mb-4 flex flex-col gap-2">
            {slots.map((s) => {
              const meta = STATUS_META[s.status];
              const active = s.timetableId === openSlotId;
              return (
                <button
                  key={s.timetableId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setOpenSlotId(s.timetableId)}
                  className={cn('ds-slot-row', active && 'ds-slot-row-active')}
                >
                  <span className="ds-slot-time">
                    <CalendarClock width={14} height={14} aria-hidden />
                    {s.startTime}–{s.endTime}
                  </span>
                  <span className="ds-slot-main">
                    <strong>{s.subject?.name ?? '—'}</strong>
                    <span>
                      {s.class?.name ?? '—'}
                      {s.classroom?.name ? ` · ${s.classroom.name}` : ''}
                    </span>
                  </span>
                  <StatusBadge status={meta.badge} icon={s.status === 'DONE' ? <Lock aria-hidden /> : undefined}>
                    {meta.label}
                  </StatusBadge>
                </button>
              );
            })}
          </div>

          {openSlot && (
            <SlotCallPanel
              key={`${openSlot.timetableId}|${openSlot.date}`}
              slot={openSlot}
              academicYearId={academicYearId!}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Appel d'une séance donnée. Classe, matière et horaires sont ceux du créneau —
 * affichés, jamais choisis. Le serveur reste seul juge : `slot.writable` ne fait
 * que masquer une action qu'il refuserait de toute façon.
 */
function SlotCallPanel({ slot, academicYearId }: { slot: AgendaSlot; academicYearId: string }) {
  const qc = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['attendance-roster', slot.classId],
    queryFn: async () => (await api.get(`/school-students?classId=${slot.classId}&limit=1000`)).data.data || [],
    enabled: !!slot.classId,
  });

  // Présences déjà saisies (correction / consultation).
  const { data: existingRecords } = useQuery({
    queryKey: ['att-session-records', slot.sessionId],
    queryFn: async () => (await api.get(`/attendance-sessions/${slot.sessionId}/records`)).data.data || [],
    enabled: !!slot.sessionId,
  });

  // Init : séance existante sinon « Présent » par défaut.
  useEffect(() => {
    if (!roster) return;
    if (slot.sessionId && existingRecords === undefined) return; // évite d'écraser la saisie par le défaut
    const map = new Map<string, string>();
    (existingRecords || []).forEach((r: any) => map.set(r.student_id, r.status));
    const next: Record<string, AttendanceStatus> = {};
    (roster as any[]).forEach((s) => {
      const raw = map.get(s.id);
      next[s.id] = raw === 'LATE' ? 'LATE' : raw === 'ABSENT' || raw === 'EXCUSED' ? 'ABSENT' : 'PRESENT';
    });
    setStatuses(next);
  }, [roster, existingRecords, slot.sessionId]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/attendance-sessions', {
          academicYearId,
          classId: slot.classId,
          subjectId: slot.subjectId,
          date: slot.date,
          timetableId: slot.timetableId,
          records: (roster || []).map((s: any) => ({ studentId: s.id, status: statuses[s.id] || 'PRESENT' })),
        })
      ).data,
    onSuccess: (res) => {
      toast.success(res?.message || 'Appel enregistré.');
      qc.invalidateQueries({ queryKey: ['att-agenda'] });
      qc.invalidateQueries({ queryKey: ['att-session-records'] });
      qc.invalidateQueries({ queryKey: ['att-session-history'] });
      qc.invalidateQueries({ queryKey: ['attendance-stats'] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error || "Échec de l'enregistrement de l'appel."),
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

  const readOnly = !slot.writable;
  const setStatus = (id: string, st: AttendanceStatus) =>
    !readOnly && setStatuses((p) => ({ ...p, [id]: st }));

  return (
    <div>
      {/* Récapitulatif de la séance — dérivé du créneau, non modifiable */}
      <Card className="mb-4" padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ds-text-secondary">
            <span className="ds-seance-badge">
              <Hash width={14} height={14} aria-hidden />
              Séance {slot.sessionNumber}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen width={14} height={14} aria-hidden />
              {slot.subject?.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users width={14} height={14} aria-hidden />
              {slot.class?.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock width={14} height={14} aria-hidden />
              {slot.startTime}–{slot.endTime}
            </span>
            {slot.classroom?.name && (
              <span className="inline-flex items-center gap-1">
                <MapPin width={14} height={14} aria-hidden />
                {slot.classroom.name}
              </span>
            )}
          </div>
          <div className="ds-att-summary" aria-live="polite">
            <span className="ds-att-pill">
              <span className="ds-att-dot" style={{ background: 'var(--success-500)' }} />
              Présents <span className="ds-att-n">{counts.present}</span>
            </span>
            <span className="ds-att-pill">
              <span className="ds-att-dot" style={{ background: 'var(--amber-500)' }} />
              Retards <span className="ds-att-n">{counts.late}</span>
            </span>
            <span className="ds-att-pill">
              <span className="ds-att-dot" style={{ background: 'var(--danger-500)' }} />
              Absents <span className="ds-att-n">{counts.absent}</span>
            </span>
          </div>
        </div>

        <SlotNotice slot={slot} />
      </Card>

      {rosterLoading ? (
        <div className="ds-att-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={64} className="rounded-lg" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card className="text-center" accent="warning">
          <p className="font-display font-bold text-ds-text">Aucun élève</p>
          <p className="mt-1 text-sm text-ds-text-secondary">Cette classe ne contient aucun élève inscrit.</p>
        </Card>
      ) : (
        <>
          <div className="ds-att-grid">
            {students.map((s) => {
              const st = statuses[s.id] || 'PRESENT';
              return (
                <div
                  key={s.id}
                  className={cn('ds-att-card', `ds-status-${st.toLowerCase()}`, readOnly && 'ds-att-card-locked')}
                >
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
                      disabled={readOnly}
                      aria-pressed={st === 'PRESENT'}
                      className={cn('ds-att-btn ds-present', st === 'PRESENT' && 'ds-on')}
                      onClick={() => setStatus(s.id, 'PRESENT')}
                    >
                      <Check aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Retard"
                      disabled={readOnly}
                      aria-pressed={st === 'LATE'}
                      className={cn('ds-att-btn ds-late', st === 'LATE' && 'ds-on')}
                      onClick={() => setStatus(s.id, 'LATE')}
                    >
                      <Clock aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Absent"
                      disabled={readOnly}
                      aria-pressed={st === 'ABSENT'}
                      className={cn('ds-att-btn ds-absent', st === 'ABSENT' && 'ds-on')}
                      onClick={() => setStatus(s.id, 'ABSENT')}
                    >
                      <X aria-hidden />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <div className="ds-sticky-save">
              <span className="ds-save-count">
                Séance {slot.sessionNumber} · {students.length} élève{students.length > 1 ? 's' : ''} ·{' '}
                {counts.absent} absent{counts.absent > 1 ? 's' : ''}
              </span>
              <Button
                size="lg"
                block
                className="!flex-1"
                icon={<Check aria-hidden />}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {slot.status === 'EDITABLE' ? "Corriger l'appel" : "Enregistrer l'appel"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Explique pourquoi la séance est (ou n'est plus) modifiable. */
function SlotNotice({ slot }: { slot: AgendaSlot }) {
  if (slot.status === 'TODO') return null;

  const notice: Record<Exclude<SlotStatus, 'TODO'>, { accent: string; text: string }> = {
    TOO_EARLY: {
      accent: 'ds-notice-info',
      text: `Le cours n'a pas encore commencé. L'appel s'ouvrira à ${slot.startTime}, et restera possible jusqu'à ${slot.graceEndsAt}.`,
    },
    EDITABLE: {
      accent: 'ds-notice-success',
      text: `Appel enregistré. Vous pouvez encore le corriger pendant ${slot.editMinutesLeft} min, puis il sera verrouillé.`,
    },
    DONE: {
      accent: 'ds-notice-neutral',
      text: "Appel enregistré et verrouillé. Contactez l'administration pour une correction.",
    },
    UPCOMING: {
      accent: 'ds-notice-info',
      text: "Cours à venir : l'appel s'ouvrira le jour du cours.",
    },
    GRACE_EXPIRED: {
      accent: 'ds-notice-danger',
      text: `Le délai de ${slot.graceEndsAt} pour faire l'appel est dépassé. La séance est désormais confiée à l'administration.`,
    },
    MISSED: {
      accent: 'ds-notice-danger',
      text: "Aucun appel n'a été fait et le cours est passé. Contactez l'administration.",
    },
  };
  const n = notice[slot.status as Exclude<SlotStatus, 'TODO'>];

  return (
    <p className={cn('ds-notice mt-3', n.accent)} role="status">
      <Lock width={14} height={14} aria-hidden />
      {n.text}
    </p>
  );
}
