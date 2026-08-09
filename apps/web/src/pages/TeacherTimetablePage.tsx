import { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card } from '../components/ds';
import { TimetableGrid, deriveSlotsFromEntries, type TTCell } from '../components/timetable/TimetableGrid';

/** Mon Emploi du Temps (§10, enseignant) — re-skin lecture seule. `/teachers/me/timetable`, grille DS partagée.
 *  Créneaux (horaires) dérivés des données — pas de liste fixe, les horaires sont libres (§ TimetablePage admin). */

const DAYS = [
  { value: 'MONDAY', label: 'Lundi' }, { value: 'TUESDAY', label: 'Mardi' }, { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' }, { value: 'FRIDAY', label: 'Vendredi' }, { value: 'SATURDAY', label: 'Samedi' },
];

export default function TeacherTimetablePage() {
  const [yearId, setYearId] = useState('');
  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  useEffect(() => { if (years && !yearId) setYearId((years.find((y: any) => y.isCurrent) || years[0])?.id || ''); }, [years, yearId]);

  const { data: timetable } = useQuery({
    queryKey: ['teacher-timetable', yearId],
    queryFn: async () => (await api.get(`/teachers/me/timetable?academicYearId=${yearId}`)).data.data || [],
    enabled: !!yearId,
  });

  const cellFor = (day: string, start: string, end: string): TTCell | null => {
    const t = (timetable || []).find((x: any) => x.day_of_week === day && x.start_time === start && x.end_time === end);
    // Vue enseignant : on met la classe à la place de « l'enseignant » (l'info utile ici).
    return t ? { id: t.id, subject: t.subject, classroom: t.classroom, teacher: { first_name: t.class?.name, last_name: '' } } : null;
  };

  const slots = useMemo(() => deriveSlotsFromEntries(timetable || []), [timetable]);

  return (
    <div className="animate-fade-in mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">Mon emploi du temps</h1>
          <p className="mt-1 text-sm text-ds-text-secondary">Vos cours de la semaine.</p>
        </div>
        <label className="ds-field w-48">
          <span>Année scolaire</span>
          <Select
            placeholder="Sélectionner…"
            value={yearId || undefined}
            onChange={(v) => setYearId(v)}
            options={(years || []).map((y: any) => ({ value: y.id, label: y.name }))}
            style={{ width: '100%' }}
          />
        </label>
      </div>

      {yearId ? (
        <TimetableGrid slots={slots} days={DAYS} cellFor={cellFor} readOnly />
      ) : (
        <Card className="text-center" accent="info"><p className="text-sm text-ds-text-secondary">Chargement…</p></Card>
      )}
    </div>
  );
}
