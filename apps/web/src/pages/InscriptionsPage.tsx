import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { InscriptionFormPage } from '../components/inscriptions/InscriptionFormPage';

/**
 * Inscriptions — cette page ne montre QUE l'interface d'inscription (aucune
 * liste, aucun tableau de bord : ces vues vivent ailleurs, ex. la fiche
 * élève ou la liste des élèves). Sert à rattacher un ou plusieurs élèves à
 * une classe pour l'année scolaire en cours ; l'année n'est jamais un champ
 * visible, elle est résolue en arrière-plan (année marquée `isCurrent`).
 */
export default function InscriptionsPage() {
  const queryClient = useQueryClient();
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [classId, setClassId] = useState('');

  const { data: years } = useQuery({ queryKey: ['academic-years-all'], queryFn: async () => (await api.get('/academic-years')).data.data || [] });
  const currentYear = years?.find((y: any) => y.isCurrent);

  const { data: classes } = useQuery({ queryKey: ['school-classes-all'], queryFn: async () => (await api.get('/school-classes')).data.data || [] });

  const { data: allStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-all-for-inscriptions'],
    queryFn: async () => (await api.get('/students', { params: { limit: 1000, page: 1 } })).data?.data || [],
  });

  const { data: yearInscriptions } = useQuery({
    queryKey: ['inscriptions-current-year', currentYear?.id],
    queryFn: async () => (await api.get('/inscriptions', { params: { academicYearId: currentYear.id } })).data.data || [],
    enabled: !!currentYear,
  });

  const enrolledIds = useMemo(() => new Set((yearInscriptions || []).map((i: any) => i.studentId || i.student?.id)), [yearInscriptions]);

  const studentOptions = useMemo(
    () => (allStudents || [])
      .filter((s: any) => !enrolledIds.has(s.id))
      .map((s: any) => ({ id: s.id, label: `${s.lastName ?? ''} ${s.firstName ?? ''}`.trim() })),
    [allStudents, enrolledIds],
  );
  const classOptions = useMemo(() => (classes || []).map((c: any) => ({ id: c.id, label: c.name })), [classes]);

  const createM = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        studentIds.map((studentId) => api.post('/inscriptions', { studentId, classId, academicYearId: currentYear.id })),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { succeeded: results.length - failed, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded > 0) toast.success(`${succeeded} élève${succeeded > 1 ? 's' : ''} inscrit${succeeded > 1 ? 's' : ''}.`);
      if (failed > 0) toast.error(`${failed} inscription${failed > 1 ? 's' : ''} en échec.`);
      queryClient.invalidateQueries({ queryKey: ['inscriptions-current-year'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setStudentIds([]);
      setClassId('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Erreur lors de l'inscription."),
  });

  return (
    <div className="animate-fade-in">
      <InscriptionFormPage
        yearName={currentYear?.name}
        hasCurrentYear={!!currentYear}
        studentIds={studentIds}
        onStudentIdsChange={setStudentIds}
        classId={classId}
        onClassChange={setClassId}
        studentOptions={studentOptions}
        classOptions={classOptions}
        studentsLoading={studentsLoading}
        onReset={() => { setStudentIds([]); setClassId(''); }}
        onSubmit={() => createM.mutate()}
        submitting={createM.isPending}
      />
    </div>
  );
}
