import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { CalendarDays, MapPin, User } from 'lucide-react';
import { Card, Skeleton } from '../ds';
import {
  TimetableGrid,
  deriveSlotsFromEntries,
  deriveSlotsFromHoraires,
  type TTCell,
} from '../timetable/TimetableGrid';

dayjs.locale('fr');

/**
 * Emploi du temps en lecture seule (§9.4 / §5.11), partagé par les espaces
 * Parent et Élève.
 *
 * Deux représentations, pas un simple reflow : la semaine complète en grille sur
 * desktop/tablette, et un agenda du jour sur mobile — la question posée depuis un
 * téléphone est presque toujours « c'est quoi, aujourd'hui ? ». Les créneaux
 * viennent de la table `horaires` quand elle est renseignée, pour afficher les
 * bandes récréation/pause comme dans la vue administration ; sinon ils sont
 * dérivés des cours eux-mêmes.
 */

const DAYS = [
  { value: 'MONDAY', label: 'Lundi' },
  { value: 'TUESDAY', label: 'Mardi' },
  { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' },
  { value: 'FRIDAY', label: 'Vendredi' },
  { value: 'SATURDAY', label: 'Samedi' },
];
export const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export interface TimetableBoardProps {
  entries: any[];
  horaires?: any[];
  loading?: boolean;
  /** Phrase de l'état vide, adaptée au point de vue (« votre enfant » / « toi »). */
  emptyText?: string;
}

export function TimetableBoard({ entries, horaires, loading, emptyText }: TimetableBoardProps) {
  const today = DAY_KEYS[dayjs().day()];
  const [day, setDay] = useState(() => (today === 'SUNDAY' ? 'MONDAY' : today));

  const slots = useMemo(() => {
    const fromHoraires = deriveSlotsFromHoraires(horaires || []);
    return fromHoraires.length ? fromHoraires : deriveSlotsFromEntries(entries);
  }, [horaires, entries]);

  const cellFor = (d: string, start: string, end: string): TTCell | null => {
    const t = entries.find(
      (x: any) => x.day_of_week === d && x.start_time === start && x.end_time === end,
    );
    return t ? { id: t.id, subject: t.subject, classroom: t.classroom, teacher: t.teacher } : null;
  };

  const dayCourses = useMemo(
    () =>
      entries
        .filter((e: any) => e.day_of_week === day)
        .sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time))),
    [entries, day],
  );

  if (loading) return <Skeleton height={420} className="rounded-lg" />;

  if (entries.length === 0) {
    return (
      <Card className="text-center" accent="info">
        <CalendarDays className="mx-auto mb-2 text-ds-text-tertiary" aria-hidden />
        <p className="font-display font-bold text-ds-text">Aucun emploi du temps</p>
        <p className="mt-1 text-sm text-ds-text-secondary">
          {emptyText ?? "Aucun cours n'est encore programmé pour cette classe sur l'année sélectionnée."}
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop / tablette : la semaine en grille */}
      <div className="hidden md:block">
        <TimetableGrid slots={slots} days={DAYS} cellFor={cellFor} readOnly />
      </div>

      {/* Mobile : agenda du jour, sélecteur de jour en chips (§5.11) */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {DAYS.map((d) => {
            const active = d.value === day;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => setDay(d.value)}
                aria-pressed={active}
                className="min-h-[44px] shrink-0 rounded-[var(--radius-md)] border px-3 text-[.82rem] font-bold transition-colors duration-[var(--dur-fast)]"
                style={
                  active
                    ? {
                        background: 'var(--role-accent)',
                        borderColor: 'var(--role-accent)',
                        color: '#fff',
                      }
                    : {
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                {d.label.slice(0, 3)}
                {d.value === today ? ' •' : ''}
              </button>
            );
          })}
        </div>

        {dayCourses.length === 0 ? (
          <Card className="text-center" accent="info">
            <p className="text-sm text-ds-text-secondary">Aucun cours ce jour-là.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {dayCourses.map((c: any) => (
              <li key={c.id}>
                <Card accent className="flex items-start gap-3">
                  <span className="flex w-[62px] shrink-0 flex-col font-mono text-[.8rem] leading-tight text-ds-text">
                    {c.start_time}
                    <span className="text-ds-text-tertiary">{c.end_time}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-display text-[.95rem] text-ds-text">
                      {c.subject?.name || 'Cours'}
                    </strong>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[.78rem] text-ds-text-tertiary">
                      {c.teacher && (
                        <span className="inline-flex items-center gap-1">
                          <User width={12} height={12} aria-hidden />
                          {c.teacher.first_name} {c.teacher.last_name}
                        </span>
                      )}
                      {c.classroom?.name && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin width={12} height={12} aria-hidden />
                          {c.classroom.name}
                        </span>
                      )}
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
