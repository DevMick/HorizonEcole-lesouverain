/**
 * Politique d'appel (§9.6) — règles temporelles de la prise de présence.
 *
 * Un appel n'existe que par rapport à un créneau de l'emploi du temps
 * (`class_timetables`). Les règles ci-dessous sont la source de vérité unique :
 * le service les applique à l'écriture, l'agenda les expose à l'UI. L'UI ne fait
 * que refléter un statut calculé ici — elle ne décide jamais.
 *
 * Règles retenues :
 *  - Saisie : uniquement le jour du cours (jour calendaire, fuseau de l'école).
 *  - Correction : jusqu'à EDIT_WINDOW_MINUTES après l'enregistrement, puis verrou.
 *  - Aucune séance hors emploi du temps (pas de « séance libre »).
 *
 * Ces fenêtres se calculent depuis la date du créneau et `created_at` de la
 * séance : aucune colonne supplémentaire, donc aucune migration.
 */

import config from '@school/config';

/** Fenêtre de correction après enregistrement, en minutes. */
export const EDIT_WINDOW_MINUTES = 30;

/**
 * Délai de grâce après le début du cours, en minutes, avant qu'une séance sans
 * appel ne soit considérée comme non tenue et confiée à l'administration
 * (page « Séances non tenues »).
 */
export const GRACE_MINUTES = 10;

/**
 * Fuseau de l'école — source unique : @school/config (surchargeable via
 * SCHOOL_TIMEZONE). Le « jour du cours » est un jour calendaire *local* : le
 * serveur peut tourner ailleurs, on ne se fie donc ni à sa TZ ni à l'horloge du
 * client.
 */
const SCHOOL_TIMEZONE = config.school.timezone;

/**
 * Jours tels que stockés dans l'enum Prisma `DayOfWeek`, indexés par
 * `Date.getUTCDay()` (0 = dimanche). L'enum ne contient pas SUNDAY : un créneau
 * le dimanche n'existe pas, `dayOfWeekFor` renvoie donc null ce jour-là.
 */
const DOW_BY_INDEX = [null, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export type SlotStatus =
  | 'TOO_EARLY' // cours du jour, pas encore commencé → saisie pas encore ouverte
  | 'TODO' // cours du jour, en cours (dans la fenêtre de grâce) → saisie ouverte
  | 'EDITABLE' // appel fait, encore dans la fenêtre de correction
  | 'DONE' // appel fait et verrouillé
  | 'UPCOMING' // cours à venir (autre jour) → saisie pas encore ouverte
  | 'GRACE_EXPIRED' // cours du jour, délai de grâce dépassé sans appel → confié à l'administration
  | 'MISSED'; // cours passé (jour révolu) sans appel → saisie définitivement fermée

/** Date du jour (YYYY-MM-DD) dans le fuseau de l'école. */
export function schoolToday(now: Date = new Date()): string {
  // 'en-CA' formate en YYYY-MM-DD, ce qui évite un parsing manuel.
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(now);
}

/** Vrai si `date` (YYYY-MM-DD) est aujourd'hui pour l'école. */
export function isSchoolToday(date: string, now: Date = new Date()): boolean {
  return date === schoolToday(now);
}

/** Heure courante (HH:MM, 24h) dans le fuseau de l'école. */
export function schoolNowTime(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

/**
 * Jour de la semaine (valeur `DayOfWeek`) d'une date YYYY-MM-DD, ou null le
 * dimanche. La date est interprétée en UTC pour rester indépendante de la TZ du
 * serveur : 'YYYY-MM-DD' désigne un jour calendaire, pas un instant.
 */
export function dayOfWeekFor(date: string): string | null {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return DOW_BY_INDEX[d.getUTCDay()] ?? null;
}

/** Vrai si la séance enregistrée à `recordedAt` est encore corrigeable. */
export function isWithinEditWindow(recordedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - recordedAt.getTime() <= EDIT_WINDOW_MINUTES * 60_000;
}

/** Minutes restantes pour corriger (0 si verrouillé). Sert à l'affichage. */
export function editWindowMinutesLeft(recordedAt: Date, now: Date = new Date()): number {
  const left = EDIT_WINDOW_MINUTES * 60_000 - (now.getTime() - recordedAt.getTime());
  return left <= 0 ? 0 : Math.ceil(left / 60_000);
}

/**
 * Statut d'un créneau à une date donnée, selon qu'un appel existe déjà.
 * `recordedAt` = `created_at` de la séance (première saisie), pas `updated_at` :
 * la fenêtre court depuis l'appel initial, sinon chaque correction la relancerait
 * indéfiniment et le verrou ne fermerait jamais.
 *
 * `startTime` (HH:MM du créneau) borne la saisie le jour du cours : fermée avant
 * le début du cours (`TOO_EARLY`), ouverte pendant [`startTime`, `startTime` +
 * `GRACE_MINUTES`[ (`TODO`), puis confiée à l'administration au-delà
 * (`GRACE_EXPIRED`) — la page « Séances non tenues » reprend cette même règle.
 */
export function computeSlotStatus(
  date: string,
  startTime: string | null,
  recordedAt: Date | null,
  now: Date = new Date(),
): SlotStatus {
  if (recordedAt) {
    return isWithinEditWindow(recordedAt, now) ? 'EDITABLE' : 'DONE';
  }
  const today = schoolToday(now);
  if (date > today) return 'UPCOMING';
  if (date < today) return 'MISSED';
  if (!startTime) return 'TODO'; // pas de créneau connu (garde-fou) : ne pas bloquer la saisie
  const nowTime = schoolNowTime(now);
  if (nowTime < startTime) return 'TOO_EARLY';
  return nowTime < addMinutesToTime(startTime, GRACE_MINUTES) ? 'TODO' : 'GRACE_EXPIRED';
}

/** Un appel peut-il être écrit (création ou correction) pour ce statut ? */
export function isWritable(status: SlotStatus): boolean {
  return status === 'TODO' || status === 'EDITABLE';
}

// --- Utilitaires dates / horaires (partagés avec le rattrapage) -----------

/** 'YYYY-MM-DD' d'une Date, en UTC (les dates métier sont des jours calendaires). */
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Décale une date 'YYYY-MM-DD' de n jours. */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate(d);
}

/**
 * Toutes les dates entre `from` et `to` (bornes incluses) tombant sur
 * `dayOfWeek`. Sert à dérouler les occurrences d'un créneau hebdomadaire sur un
 * trimestre.
 */
export function occurrenceDates(dayOfWeek: string, from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (DOW_BY_INDEX[d.getUTCDay()] === dayOfWeek) out.push(fmtDate(d));
  }
  return out;
}

/** 'HH:MM' → minutes depuis minuit. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

/** Décale une heure 'HH:MM' de n minutes (borné à la journée, 00:00–23:59). */
export function addMinutesToTime(time: string, minutes: number): string {
  const total = Math.min(Math.max(toMinutes(time) + minutes, 0), 23 * 60 + 59);
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Deux plages horaires se chevauchent-elles ? Bornes ouvertes à droite : un
 * cours 08:00–09:00 et un cours 09:00–10:00 s'enchaînent sans conflit.
 */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** Message d'erreur métier associé à un statut non inscriptible. */
export function refusalReason(status: SlotStatus): string {
  switch (status) {
    case 'DONE':
      return `L'appel de cette séance est verrouillé (modification possible pendant ${EDIT_WINDOW_MINUTES} min après l'enregistrement). Contactez l'administration pour une correction.`;
    case 'UPCOMING':
      return "L'appel n'est possible que le jour du cours.";
    case 'TOO_EARLY':
      return "Le cours n'a pas encore commencé : l'appel s'ouvrira à l'heure du cours.";
    case 'GRACE_EXPIRED':
      return `Le délai de ${GRACE_MINUTES} min après le début du cours est dépassé : l'appel est confié à l'administration.`;
    case 'MISSED':
      return "Le cours est passé : l'appel n'était possible que le jour même. Contactez l'administration.";
    default:
      return "L'appel n'est pas possible pour cette séance.";
  }
}
