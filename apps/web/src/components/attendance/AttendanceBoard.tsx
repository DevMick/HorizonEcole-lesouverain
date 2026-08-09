import dayjs from 'dayjs';
import { DatePicker } from 'antd';
import { Check, Clock, X, CalendarClock, Users } from 'lucide-react';
import { Button, Card, Skeleton } from '../ds';
import { cn } from '../../lib/utils';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export interface RosterStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  studentNumber?: string;
}
export interface ClassOption {
  id: string;
  name: string;
}

export interface AttendanceBoardProps {
  classes: ClassOption[];
  classId: string;
  onClassChange: (id: string) => void;
  date: string;
  onDateChange: (d: string) => void;
  period: 'MORNING' | 'AFTERNOON';
  onPeriodChange: (p: 'MORNING' | 'AFTERNOON') => void;
  students: RosterStudent[];
  statuses: Record<string, AttendanceStatus>;
  onSetStatus: (id: string, s: AttendanceStatus) => void;
  loading?: boolean;
  saving?: boolean;
  onSave: () => void;
}

const AVATAR_COLORS = ['#34478F', '#217A54', '#CC8722', '#B92C3C', '#2C689F', '#4A5FA8'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
const initials = (f?: string, l?: string) => `${f?.[0] ?? ''}${l?.[0] ?? ''}`.toUpperCase();

/**
 * Vue de prise de présence (§9.6 / §5.12) — présentation pure.
 * Toolbar (classe/date/période), compteurs live, grille de vignettes à 3
 * boutons tactiles, bouton flottant « Enregistrer l'appel ».
 */
export function AttendanceBoard({
  classes, classId, onClassChange, date, onDateChange, period, onPeriodChange,
  students, statuses, onSetStatus, loading, saving, onSave,
}: AttendanceBoardProps) {
  const counts = students.reduce(
    (acc, s) => {
      const st = statuses[s.id] || 'PRESENT';
      acc[st === 'PRESENT' ? 'present' : st === 'LATE' ? 'late' : 'absent']++;
      return acc;
    },
    { present: 0, late: 0, absent: 0 },
  );
  const className = classes.find((c) => c.id === classId)?.name;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Présence</h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          {className ? <>Classe <strong className="text-ds-text">{className}</strong> · </> : null}
          {dayjs(date).format('dddd D MMMM YYYY')} · {period === 'MORNING' ? 'Matin' : 'Après-midi'}
        </p>
      </div>

      <Card className="mb-4" padded>
        <div className="flex flex-col gap-4">
          {classes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn('ds-chip', c.id === classId && 'ds-chip-active')}
                  aria-pressed={c.id === classId}
                  onClick={() => onClassChange(c.id)}
                >
                  <Users width={14} height={14} aria-hidden />
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ds-text-secondary">
              <CalendarClock width={16} height={16} aria-hidden />
              <DatePicker
                value={dayjs(date)}
                maxDate={dayjs()}
                onChange={(date) => onDateChange(date ? date.format('YYYY-MM-DD') : '')}
                style={{ width: 'auto' }}
              />
            </label>
            <div className="ds-segment" role="tablist" aria-label="Période">
              <button type="button" role="tab" aria-selected={period === 'MORNING'} className={cn(period === 'MORNING' && 'ds-seg-active')} onClick={() => onPeriodChange('MORNING')}>Matin</button>
              <button type="button" role="tab" aria-selected={period === 'AFTERNOON'} className={cn(period === 'AFTERNOON' && 'ds-seg-active')} onClick={() => onPeriodChange('AFTERNOON')}>Après-midi</button>
            </div>
          </div>

          <div className="ds-att-summary" aria-live="polite">
            <span className="ds-att-pill"><span className="ds-att-dot" style={{ background: 'var(--success-500)' }} />Présents <span className="ds-att-n">{counts.present}</span></span>
            <span className="ds-att-pill"><span className="ds-att-dot" style={{ background: 'var(--amber-500)' }} />Retards <span className="ds-att-n">{counts.late}</span></span>
            <span className="ds-att-pill"><span className="ds-att-dot" style={{ background: 'var(--danger-500)' }} />Absents <span className="ds-att-n">{counts.absent}</span></span>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="ds-att-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={64} className="rounded-lg" />)}
        </div>
      ) : !classId ? (
        <Card className="text-center"><p className="text-sm text-ds-text-secondary">Sélectionnez une classe pour faire l'appel.</p></Card>
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
                <div key={s.id} className={cn('ds-att-card', `ds-status-${st.toLowerCase()}`)}>
                  <span className="ds-avatar ds-avatar-sm" style={{ background: colorFor(s.lastName || s.id) }} aria-hidden>
                    {initials(s.firstName, s.lastName)}
                  </span>
                  <span className="ds-att-name">
                    <strong>{s.firstName} {s.lastName}</strong>
                    <span>{s.studentNumber || '—'}</span>
                  </span>
                  <span className="ds-att-actions" role="group" aria-label={`Statut de ${s.firstName} ${s.lastName}`}>
                    <button type="button" title="Présent" aria-pressed={st === 'PRESENT'} className={cn('ds-att-btn ds-present', st === 'PRESENT' && 'ds-on')} onClick={() => onSetStatus(s.id, 'PRESENT')}><Check aria-hidden /></button>
                    <button type="button" title="Retard" aria-pressed={st === 'LATE'} className={cn('ds-att-btn ds-late', st === 'LATE' && 'ds-on')} onClick={() => onSetStatus(s.id, 'LATE')}><Clock aria-hidden /></button>
                    <button type="button" title="Absent" aria-pressed={st === 'ABSENT'} className={cn('ds-att-btn ds-absent', st === 'ABSENT' && 'ds-on')} onClick={() => onSetStatus(s.id, 'ABSENT')}><X aria-hidden /></button>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="ds-sticky-save">
            <span className="ds-save-count">{students.length} élève{students.length > 1 ? 's' : ''} · {counts.absent} absent{counts.absent > 1 ? 's' : ''}</span>
            <Button size="lg" block className="!flex-1" icon={<Check aria-hidden />} loading={saving} onClick={onSave}>
              Enregistrer l'appel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
