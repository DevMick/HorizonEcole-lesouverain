import { useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ChevronDown, Hourglass, Trophy } from 'lucide-react';
import { Card, Skeleton, StatusBadge } from '../ds';
import { cn } from '../../lib/utils';

dayjs.locale('fr');

/**
 * Bulletins & résultats (§9.5), partagé par les espaces Parent et Élève.
 *
 * Un bulletin n'est pas une entité stockée : il est recalculé à partir des notes
 * du trimestre. Mais il n'apparaît ici qu'une fois *généré par l'administration*
 * — la saisie des notes par les enseignants ne suffit pas. Tant que ce n'est pas
 * fait, la carte n'affiche ni moyenne ni détail : le bulletin est un document
 * remis, pas un flux de notes qu'on regarderait se remplir en direct.
 *
 * Une fois généré, la moyenne générale et le détail par matière sont lisibles en
 * ligne, et la carte porte la date de génération. Le document lui-même n'est pas
 * consultable depuis ces espaces : il est remis par l'administration.
 */

export interface BulletinSubject {
  id: string;
  name: string;
  coefficient: number;
  gradesCount: number;
  average: number | null;
}
export interface Bulletin {
  semester: { id: string; name: string; startDate: string; endDate: string };
  /** Le bulletin a été généré par l'administration : lui seul ouvre l'accès. */
  available: boolean;
  /** Date de génération — imprimée sur le document. `null` tant qu'il n'est pas généré. */
  publishedAt?: string | null;
  gradesCount: number;
  generalAverage: number | null;
  subjects: BulletinSubject[];
}

function mentionOf(avg: number) {
  if (avg >= 16) return { label: 'Très bien', kind: 'success' as const };
  if (avg >= 14) return { label: 'Bien', kind: 'success' as const };
  if (avg >= 12) return { label: 'Assez bien', kind: 'info' as const };
  if (avg >= 10) return { label: 'Passable', kind: 'info' as const };
  return { label: 'Insuffisant', kind: 'danger' as const };
}

function BulletinCard({ bulletin }: { bulletin: Bulletin }) {
  const [open, setOpen] = useState(false);
  const { semester, available, publishedAt, generalAverage, gradesCount, subjects } = bulletin;
  const mention = generalAverage !== null ? mentionOf(generalAverage) : null;

  return (
    <Card accent={available ? 'role' : 'warning'} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="block font-display text-[1.05rem] text-ds-text">{semester.name}</strong>
          <span className="mt-0.5 block text-[.8rem] text-ds-text-tertiary">
            Du {dayjs(semester.startDate).format('DD/MM/YYYY')} au{' '}
            {dayjs(semester.endDate).format('DD/MM/YYYY')}
          </span>
          {available && publishedAt && (
            <span className="mt-0.5 block text-[.8rem] text-ds-text-tertiary">
              Bulletin édité le {dayjs(publishedAt).format('D MMMM YYYY')}
            </span>
          )}
        </div>
        {available ? (
          <StatusBadge status="success">Disponible</StatusBadge>
        ) : (
          <StatusBadge status="warning" icon={<Hourglass aria-hidden />}>
            En préparation
          </StatusBadge>
        )}
      </div>

      {available ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-md)] bg-ds-subtle px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[.72rem] font-bold uppercase tracking-wide text-ds-text-tertiary">
                Moyenne générale
              </span>
              <span
                className="font-mono text-[1.7rem] font-semibold leading-none"
                style={{ color: 'var(--role-accent)' }}
              >
                {generalAverage !== null ? generalAverage.toFixed(2) : '—'}
                <span className="ml-1 text-[.85rem] text-ds-text-tertiary">/20</span>
              </span>
            </div>
            {mention && <StatusBadge status={mention.kind}>{mention.label}</StatusBadge>}
            <span className="ml-auto text-[.8rem] text-ds-text-tertiary">
              <span className="font-mono">{gradesCount}</span> note{gradesCount > 1 ? 's' : ''} ·{' '}
              <span className="font-mono">{subjects.length}</span> matière
              {subjects.length > 1 ? 's' : ''}
            </span>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex min-h-[36px] items-center gap-1.5 text-[.82rem] font-bold text-ds-text-secondary hover:text-ds-text"
            >
              <ChevronDown
                width={15}
                height={15}
                aria-hidden
                className={cn(
                  'transition-transform duration-[var(--dur-fast)]',
                  open && 'rotate-180',
                )}
              />
              {open ? 'Masquer' : 'Voir'} le détail par matière
            </button>

            {open && (
              <ul className="mt-2 flex flex-col divide-y divide-ds-border rounded-[var(--radius-md)] border border-ds-border">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[.86rem] font-semibold text-ds-text">
                        {s.name}
                      </strong>
                      <span className="text-[.75rem] text-ds-text-tertiary">
                        Coef. <span className="font-mono">{s.coefficient}</span> ·{' '}
                        <span className="font-mono">{s.gradesCount}</span> note
                        {s.gradesCount > 1 ? 's' : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'ds-grade-avg',
                        (s.average ?? 0) >= 10 ? 'ds-avg-pass' : 'ds-avg-fail',
                      )}
                    >
                      {s.average !== null ? s.average.toFixed(2) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-ds-text-secondary">
          Le bulletin de ce trimestre n'a pas encore été édité par l'administration. Ses moyennes
          seront affichées ici dès qu'il aura été délivré.
        </p>
      )}
    </Card>
  );
}

export interface BulletinsBoardProps {
  bulletins: Bulletin[];
  loading?: boolean;
}

export function BulletinsBoard({ bulletins, loading }: BulletinsBoardProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={220} className="rounded-lg" />
        ))}
      </div>
    );
  }

  if (bulletins.length === 0) {
    return (
      <Card className="text-center" accent="info">
        <Trophy className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
        <p className="font-display font-bold text-ds-text">Aucun trimestre défini</p>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Aucun trimestre n'est encore configuré pour cette année scolaire.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {bulletins.map((b) => (
        <BulletinCard key={b.semester.id} bulletin={b} />
      ))}
    </div>
  );
}
