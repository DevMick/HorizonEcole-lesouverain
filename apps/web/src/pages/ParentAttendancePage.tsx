import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ChildSwitcher } from '../components/parent/ChildSwitcher';
import { AttendanceBoard } from '../components/school/AttendanceBoard';
import { SchoolFiltersCard } from '../components/school/SchoolFiltersCard';
import { useAcademicYears, useActiveChild } from '../lib/hooks/useParentSpace';

/** Présences & assiduité de l'enfant (§5.12) — historique des appels par séance. */
export default function ParentAttendancePage() {
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
    queryKey: ['parent-attendance', childId, yearId, semesterId ?? 'all', subjectId ?? 'all'],
    queryFn: async () =>
      (await api.get(`/parent/children/${childId}/attendance?${query}`)).data.data,
    enabled: !!childId && !!yearId,
  });

  return (
    <div className="animate-fade-in mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-[1.5rem] font-bold tracking-tight text-ds-text">
          Présences &amp; assiduité
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Chaque appel fait en classe par les enseignants, séance par séance.
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

      <AttendanceBoard
        sessions={data?.sessions || []}
        stats={data?.stats}
        loading={isLoading}
        filtered={!!(semesterId || subjectId)}
        emptyText={`Aucune séance n'a encore fait l'objet d'un appel pour ${child ? child.firstName : 'cet enfant'} sur cette année.`}
      />
    </div>
  );
}
