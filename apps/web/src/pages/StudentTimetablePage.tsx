import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TimetableBoard } from '../components/school/TimetableBoard';
import { useAcademicYears } from '../lib/hooks/useAcademicYears';
import { useStudentMe } from '../lib/hooks/useStudentSpace';

/**
 * Mon emploi du temps (§9.4) — la semaine de la classe de l'élève.
 *
 * La classe est rappelée dans le sous-titre plutôt que dans un sélecteur : un
 * élève n'a qu'une classe, la lui faire choisir serait une fausse liberté.
 */
export default function StudentTimetablePage() {
  const { data: me } = useStudentMe();
  const { data: years, currentYear } = useAcademicYears();
  const [yearId, setYearId] = useState('');
  useEffect(() => {
    if (currentYear && !yearId) setYearId(currentYear.id);
  }, [currentYear, yearId]);

  const { data, isLoading } = useQuery({
    queryKey: ['student-timetable', yearId],
    queryFn: async () => (await api.get(`/student/timetable?academicYearId=${yearId}`)).data.data,
    enabled: !!yearId,
  });
  const { data: horaires } = useQuery({
    queryKey: ['horaires'],
    queryFn: async () => (await api.get('/horaires')).data.data || [],
  });

  const className = data?.class?.name ?? me?.class?.name;

  return (
    <div className="animate-fade-in mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            Mon emploi du temps
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            Ma semaine de cours{className ? ` — classe de ${className}` : ''}.
          </p>
        </div>
        <label className="ds-field w-48">
          <span>Année scolaire</span>
          <Select
            placeholder="Sélectionner…"
            value={yearId || undefined}
            onChange={setYearId}
            options={(years || []).map((y: any) => ({
              value: y.id,
              label: `${y.name}${y.isCurrent ? ' (En cours)' : ''}`,
            }))}
            style={{ width: '100%' }}
          />
        </label>
      </div>

      <TimetableBoard
        entries={data?.entries || []}
        horaires={horaires}
        loading={isLoading}
        emptyText="Aucun cours n'est encore programmé pour ta classe sur l'année sélectionnée."
      />
    </div>
  );
}
