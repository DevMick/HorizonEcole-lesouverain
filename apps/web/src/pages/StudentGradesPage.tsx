import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { GradesBoard } from '../components/school/GradesBoard';
import { SchoolFiltersCard } from '../components/school/SchoolFiltersCard';
import { useAcademicYears } from '../lib/hooks/useAcademicYears';
import { useStudentMe } from '../lib/hooks/useStudentSpace';

/** Mes notes (§9.5) — regroupées par matière, chaque note avec son type d'évaluation. */
export default function StudentGradesPage() {
  const { data: me } = useStudentMe();
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
    queryKey: ['student-grades', yearId, semesterId ?? 'all', subjectId ?? 'all'],
    queryFn: async () => (await api.get(`/student/grades?${query}`)).data.data,
    enabled: !!yearId,
  });

  const className = data?.class?.name ?? me?.class?.name;

  return (
    <div className="animate-fade-in mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Mes notes
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Chacune de mes notes, avec son type d'évaluation
          {className ? ` — classe de ${className}` : ''}.
        </p>
      </div>

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
        emptyText="Aucune note n'a encore été saisie sur cette année."
      />
    </div>
  );
}
