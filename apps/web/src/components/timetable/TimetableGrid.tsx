import { Trash2 } from 'lucide-react';

export interface TTCell {
  id: string;
  subject?: { name?: string; code?: string } | null;
  teacher?: { first_name?: string; last_name?: string } | null;
  classroom?: { name?: string } | null;
}
export interface TTSlot { start: string; end: string; label: string; isBreak?: boolean; isSeparator?: boolean; bandLabel?: string }
export interface TTDay { value: string; label: string }

export interface TimetableGridProps {
  slots: TTSlot[];
  days: TTDay[];
  cellFor: (day: string, start: string, end: string) => TTCell | null;
  onDelete?: (cell: TTCell) => void;
  loading?: boolean;
  /** Lecture seule (vue enseignant) : pas de suppression. */
  readOnly?: boolean;
}

const isEPS = (c?: TTCell | null) =>
  !!(c?.subject?.code === 'EPS' || c?.subject?.name?.toUpperCase().includes('EPS') || c?.subject?.name?.toUpperCase().includes('ÉDUCATION PHYSIQUE'));

const timeKey = (t: string) => {
  const m = t.match(/(\d{1,2})\D(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
};

/** Dérive la liste des créneaux (horaires) réellement utilisés à partir des
 *  entrées d'emploi du temps — remplace une liste de créneaux fixe : les
 *  horaires sont libres, saisis par l'utilisateur (§ voir TimetablePage). */
export function deriveSlotsFromEntries(rows: any[]): TTSlot[] {
  const map = new Map<string, TTSlot>();
  (rows || []).forEach((t: any) => {
    const start = String(t.start_time ?? '').trim();
    const end = String(t.end_time ?? '').trim();
    if (!start || !end) return;
    const key = `${start}|${end}`;
    if (!map.has(key)) map.set(key, { start, end, label: `${start} - ${end}` });
  });
  return Array.from(map.values()).sort((a, b) => timeKey(a.start) - timeKey(b.start));
}

/** Libellé de bande affiché pour les créneaux non-cours. */
export const bandLabel = (type?: string) =>
  type === 'RECREATION' ? 'RÉCRÉATION' : type === 'PAUSE' ? 'APRÈS-MIDI' : '';

/** Dérive les lignes de la grille depuis la table `horaires` (structure de la
 *  journée) : chaque horaire devient une ligne ; RECREATION / PAUSE deviennent
 *  des bandes pleine largeur (isBreak / isSeparator). */
export function deriveSlotsFromHoraires(horaires: any[]): TTSlot[] {
  return (horaires || [])
    .map((h: any): TTSlot => {
      const start = String(h.start_time ?? '').trim();
      const end = String(h.end_time ?? '').trim();
      const type = String(h.type ?? 'COURS');
      return {
        start,
        end,
        label: `${start} - ${end}`,
        isBreak: type === 'RECREATION',
        isSeparator: type === 'PAUSE',
        bandLabel: type !== 'COURS' ? bandLabel(type) : undefined,
      } as TTSlot;
    })
    .filter((s) => s.start && s.end)
    .sort((a, b) => timeKey(a.start) - timeKey(b.start));
}

/**
 * Grille d'emploi du temps (§9.4 / §5.11) — présentation pure « Encre & Craie ».
 * Jours × créneaux horaires (dynamiques, dérivés des données), cellule = carte
 * compacte (cours, enseignant, salle). Création via le formulaire « Ajouter un
 * créneau » (TimetablePage) ; ici, uniquement l'affichage + suppression.
 */
export function TimetableGrid({ slots, days, cellFor, onDelete, loading, readOnly }: TimetableGridProps) {
  if (!loading && slots.length === 0) {
    return (
      <div className="ds-tt-wrap">
        <p className="py-8 text-center text-sm text-ds-text-tertiary">Aucun créneau pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="ds-tt-wrap" aria-busy={loading || undefined}>
      <table className="ds-tt-table">
        <thead>
          <tr>
            <th className="ds-tt-hcol">Horaires</th>
            {days.map((d) => <th key={d.value}>{d.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            // Bande pleine largeur (récréation / après-midi) : pas de cellule cours.
            if (slot.isBreak || slot.isSeparator) {
              return (
                <tr key={slot.label}>
                  <td className="ds-tt-slot font-mono">{slot.label}</td>
                  <td className="ds-tt-band" colSpan={days.length}>{slot.bandLabel || bandLabel(slot.isBreak ? 'RECREATION' : 'PAUSE')}</td>
                </tr>
              );
            }
            return (
            <tr key={slot.label}>
              <td className="ds-tt-slot font-mono">{slot.label}</td>
              {days.map((d) => {
                const cell = cellFor(d.value, slot.start, slot.end);
                if (cell) {
                  return (
                    <td key={d.value} className="ds-tt-td">
                      <div className={readOnly ? 'ds-tt-cell ds-tt-cell-ro' : 'ds-tt-cell'}>
                        {!readOnly && onDelete && (
                          <button type="button" className="ds-tt-del" aria-label="Supprimer" onClick={() => onDelete(cell)}>
                            <Trash2 width={13} height={13} aria-hidden />
                          </button>
                        )}
                        <span className="ds-tt-subject">{cell.subject?.code || cell.subject?.name || 'Matière'}</span>
                        {!isEPS(cell) && cell.classroom?.name && <span className="ds-tt-room">{cell.classroom.name}</span>}
                        <span className="ds-tt-teacher">{cell.teacher ? `${cell.teacher.first_name ?? ''} ${cell.teacher.last_name ?? ''}`.trim() : 'Enseignant'}</span>
                      </div>
                    </td>
                  );
                }
                return <td key={d.value} className="ds-tt-td"><span className="ds-tt-empty-ro">—</span></td>;
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
