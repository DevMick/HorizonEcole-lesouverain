import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ChildSwitcher } from '../components/parent/ChildSwitcher';
import { GradesBoard } from '../components/school/GradesBoard';
import { SchoolFiltersCard } from '../components/school/SchoolFiltersCard';
import { useAcademicYears, useActiveChild } from '../lib/hooks/useParentSpace';

/** Notes & évaluations de l'enfant (§9.5) — regroupées par matière, type d'évaluation en tête. */
export default function ParentGradesPage() {
  const { children, child, childId, setChildId } = useActiveChild();
  const { data: years, currentYear } = useAcademicYears();

  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState<string | undefined>();
  const [subjectId, setSubjectId] = useState<string | undefined>();

  useEffect(() => {
    if (currentYear && !yearId) setYearId(currentYear.id);
  }, [currentYear, yearId]);

  const { data: semesters } = useQuery({
    queryKey: ['semesters', yearId],
    queryFn: async () => (await api.get(`/semesters?academicYearId=${yearId}`)).data.data || [],
    enabled: !!yearId,
  });

  const query = useMemo(() => {
    const p = new URLSearchParams({ academicYearId: yearId });
    if (semesterId) p.set('semesterId', semesterId);
    if (subjectId) p.set('subjectId', subjectId);
    return p.toString();
  }, [yearId, semesterId, subjectId]);

  const { data, isLoading } = useQuery({
    queryKey: ['parent-grades', childId, yearId, semesterId ?? 'all', subjectId ?? 'all'],
    queryFn: async () => (await api.get(`/parent/children/${childId}/grades?${query}`)).data.data,
    enabled: !!childId && !!yearId,
  });

  return (
    <div className="animate-fade-in mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Notes &amp; évaluations
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Chaque note de {child ? child.firstName : 'votre enfant'}, avec son type d'évaluation
          {data?.class?.name ? ` — classe de ${data.class.name}` : ''}.
        </p>
      </div>

      <ChildSwitcher items={children} value={childId} onChange={setChildId} />

      <SchoolFiltersCard
        years={years || []}
        yearId={yearId}
        onYearChange={(v) => {
          setYearId(v);
          setSemesterId(undefined);
          setSubjectId(undefined);
        }}
        semesters={semesters}
        semesterId={semesterId}
        onSemesterChange={setSemesterId}
        subjects={data?.subjects || []}
        subjectId={subjectId}
        onSubjectChange={setSubjectId}
      />

      <GradesBoard
        bySubject={data?.bySubject || []}
        stats={data?.stats}
        loading={isLoading}
        semesterSelected={!!semesterId}
        filtered={!!(semesterId || subjectId)}
        emptyText={`Aucune note n'a encore été saisie pour ${child ? child.firstName : 'cet enfant'} sur cette année.`}
      />
    </div>
  );
}
