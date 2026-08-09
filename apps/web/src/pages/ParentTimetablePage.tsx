import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ChildSwitcher } from '../components/parent/ChildSwitcher';
import { TimetableBoard } from '../components/school/TimetableBoard';
import { useAcademicYears, useActiveChild } from '../lib/hooks/useParentSpace';

/** Emploi du temps de l'enfant (§9.4) — grille partagée, en lecture seule. */
export default function ParentTimetablePage() {
  const { children, child, childId, setChildId } = useActiveChild();
  const { data: years, currentYear } = useAcademicYears();
  const [yearId, setYearId] = useState('');
  useEffect(() => {
    if (currentYear && !yearId) setYearId(currentYear.id);
  }, [currentYear, yearId]);

  const { data, isLoading } = useQuery({
    queryKey: ['parent-timetable', childId, yearId],
    queryFn: async () =>
      (await api.get(`/parent/children/${childId}/timetable?academicYearId=${yearId}`)).data.data,
    enabled: !!childId && !!yearId,
  });
  const { data: horaires } = useQuery({
    queryKey: ['horaires'],
    queryFn: async () => (await api.get('/horaires')).data.data || [],
  });

  return (
    <div className="animate-fade-in mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
            Emploi du temps
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            La semaine de {child ? child.firstName : 'votre enfant'}
            {data?.class?.name ? ` — classe de ${data.class.name}` : ''}.
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

      <ChildSwitcher items={children} value={childId} onChange={setChildId} />

      <TimetableBoard
        entries={data?.entries || []}
        horaires={horaires}
        loading={isLoading}
        emptyText="Aucun cours n'est encore programmé pour cette classe sur l'année sélectionnée."
      />
    </div>
  );
}
