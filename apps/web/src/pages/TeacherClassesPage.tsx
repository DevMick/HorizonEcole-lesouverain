import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { EntityBoard } from '../components/shared/EntityBoard';

/** Mes Classes (§10, enseignant) — re-skin lecture seule via scaffold. `/teachers/me/assignments`. */

export default function TeacherClassesPage() {
  const [search, setSearch] = useState('');
  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  const currentYear = years?.find((y: any) => y.isCurrent) ?? years?.[0];

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-assignments', currentYear?.id],
    queryFn: async () => (await api.get(`/teachers/me/assignments${currentYear?.id ? `?academicYearId=${currentYear.id}` : ''}`)).data.data || [],
    enabled: !!currentYear?.id,
  });
  const items = useMemo(() => (data || []).filter((a: any) => !search || a.class?.name?.toLowerCase().includes(search.toLowerCase())), [data, search]);

  return (
    <div className="animate-fade-in">
      <EntityBoard
        title="Mes classes"
        subtitle={currentYear ? `Vos classes et matières — ${currentYear.name}.` : 'Vos classes et matières.'}
        icon={GraduationCap}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher une classe…"
        items={items}
        loading={isLoading}
        cardOf={(a) => ({
          key: a.class?.id || a.class?.name,
          title: a.class?.name || 'Classe',
          badges: (a.subjects || []).map((s: any) => ({ label: s.name, kind: 'neutral' as const })),
        })}
        emptyTitle="Aucune classe affectée"
        emptyText="Vous n'avez aucune affectation pour cette année."
      />
    </div>
  );
}
