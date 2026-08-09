import { useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { BookOpen, ChevronDown, PenSquare, Trophy, User } from 'lucide-react';
import { Card, Skeleton, StatusBadge } from '../ds';
import { cn } from '../../lib/utils';

dayjs.locale('fr');

/**
 * Notes & évaluations (§9.5), partagé par les espaces Parent et Élève.
 *
 * Le regroupement est fait par matière, pas par date : la question posée est
 * « comment ça se passe en maths ? », pas « qu'est-ce qui s'est passé le 12 ? ».
 * Chaque note porte son **type d'évaluation** — c'est lui qui donne sa valeur au
 * chiffre : un 11 en interrogation et un 11 en composition ne se lisent pas de la
 * même façon, et le coefficient de l'évaluation explique pourquoi la moyenne ne
 * tombe pas où on l'attendait.
 */

export interface Grade {
  id: string;
  note: number;
  maxNote: number;
  date: string;
  semester?: { id: string; name: string } | null;
  teacher?: { id: string; first_name: string; last_name: string } | null;
  evaluationType?: {
    id: string;
    name: string;
    number?: number | null;
    coefficient?: number | null;
    maxNote: number;
  } | null;
}
export interface SubjectGrades {
  id: string;
  name: string;
  code?: string | null;
  coefficient: number;
  gradesCount: number;
  average: number | null;
  grades: Grade[];
}
export interface GradesStats {
  gradesCount: number;
  subjectsCount: number;
  generalAverage: number | null;
}

/** Note ramenée sur 20 — la seule échelle comparable entre barèmes /10 et /20. */
export const on20 = (note: number, maxNote: number) =>
  maxNote === 20 ? note : (note / maxNote) * 20;

/**
 * Le nom du type d'évaluation est saisi librement par l'enseignant : on ne le
 * réinterprète pas, on le teinte seulement pour hiérarchiser la lecture (une
 * composition pèse plus qu'une interro). Tout nom non reconnu reste neutre.
 */
function evalTone(name?: string | null): 'role' | 'neutral' {
  const n = (name || '').toLowerCase();
  return /compos|examen|bac|blanc/.test(n) ? 'role' : 'neutral';
}

export function evalLabel(t?: Grade['evaluationType']) {
  if (!t) return 'Évaluation';
  return t.number ? `${t.name} n°${t.number}` : t.name;
}

function SubjectCard({ subject }: { subject: SubjectGrades }) {
  const [open, setOpen] = useState(true);
  const avg = subject.average;

  return (
    <Card accent className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 text-left"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ background: 'var(--role-accent-soft)', color: 'var(--role-accent-700)' }}
          aria-hidden
        >
          <BookOpen width={17} height={17} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate font-display text-[.98rem] text-ds-text">
            {subject.name}
          </strong>
          <span className="text-[.75rem] text-ds-text-tertiary">
            Coef. <span className="font-mono">{subject.coefficient}</span> ·{' '}
            <span className="font-mono">{subject.gradesCount}</span> note
            {subject.gradesCount > 1 ? 's' : ''}
          </span>
        </span>
        <span
          className={cn(
            'ds-grade-avg text-[1.15rem]',
            (avg ?? 0) >= 10 ? 'ds-avg-pass' : 'ds-avg-fail',
          )}
        >
          {avg !== null ? avg.toFixed(2) : '—'}
        </span>
        <ChevronDown
          width={16}
          height={16}
          aria-hidden
          className={cn(
            'shrink-0 text-ds-text-tertiary transition-transform duration-[var(--dur-fast)]',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul className="flex flex-col divide-y divide-ds-border rounded-[var(--radius-md)] border border-ds-border">
          {subject.grades.map((g) => {
            const pass = on20(g.note, g.maxNote) >= 10;
            return (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={evalTone(g.evaluationType?.name)} icon={false}>
                      {evalLabel(g.evaluationType)}
                    </StatusBadge>
                    {g.evaluationType?.coefficient ? (
                      <span className="ds-chip ds-chip-mini">
                        Coef. <span className="font-mono">{g.evaluationType.coefficient}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[.74rem] text-ds-text-tertiary">
                    <span className="font-mono">{dayjs(g.date).format('DD/MM/YYYY')}</span>
                    {g.semester?.name ? <span>· {g.semester.name}</span> : null}
                    {g.teacher && (
                      <span className="inline-flex items-center gap-1">
                        <User width={11} height={11} aria-hidden />
                        {g.teacher.first_name} {g.teacher.last_name}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    'ds-grade-avg shrink-0 text-[1.05rem]',
                    pass ? 'ds-avg-pass' : 'ds-avg-fail',
                  )}
                >
                  {g.note.toFixed(2)}
                  <span className="ml-0.5 text-[.75rem] font-medium text-ds-text-tertiary">
                    /{g.maxNote}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export interface GradesBoardProps {
  bySubject: SubjectGrades[];
  stats?: GradesStats;
  loading?: boolean;
  /** Vrai si un trimestre est sélectionné — change le libellé de la moyenne. */
  semesterSelected?: boolean;
  filtered?: boolean;
  emptyText?: string;
}

export function GradesBoard({
  bySubject,
  stats,
  loading,
  semesterSelected,
  filtered,
  emptyText,
}: GradesBoardProps) {
  return (
    <>
      <div className="ds-stat-grid mb-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {loading || !stats ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={92} className="rounded-lg" />
          ))
        ) : (
          <>
            <Card
              accent={
                stats.generalAverage === null
                  ? 'info'
                  : stats.generalAverage >= 10
                    ? 'success'
                    : 'danger'
              }
              className="ds-stat"
            >
              <div className="ds-stat-body">
                <span className="ds-stat-label">
                  Moyenne {semesterSelected ? 'du trimestre' : "de l'année"}
                </span>
                <span className="ds-stat-value">
                  {stats.generalAverage !== null ? stats.generalAverage.toFixed(2) : '—'}
                </span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <Trophy width={20} height={20} />
              </span>
            </Card>
            <Card accent className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Notes reçues</span>
                <span className="ds-stat-value">{stats.gradesCount}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <PenSquare width={20} height={20} />
              </span>
            </Card>
            <Card accent="info" className="ds-stat">
              <div className="ds-stat-body">
                <span className="ds-stat-label">Matières évaluées</span>
                <span className="ds-stat-value">{stats.subjectsCount}</span>
              </div>
              <span className="ds-stat-medallion" aria-hidden>
                <BookOpen width={20} height={20} />
              </span>
            </Card>
          </>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={180} className="rounded-lg" />
          ))}
        </div>
      ) : bySubject.length === 0 ? (
        <Card className="text-center" accent="info">
          <PenSquare className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
          <p className="font-display font-bold text-ds-text">Aucune note</p>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {filtered ? 'Aucune note ne correspond à ces filtres.' : emptyText}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bySubject.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </>
  );
}
