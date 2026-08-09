import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { toast } from '../components/ds';
import { GradesBoard, type GradeCell, type NoteDraft } from '../components/grades/GradesBoard';

/**
 * Saisie des notes / bulletin (§9.5) — conteneur de données.
 * Re-skin « Encre & Craie » de l'ancien GradesPage : la logique métier
 * (colonnes Note 1..N, un type d'évaluation par colonne, verrou trimestre,
 * CRUD note par note) est conservée à l'identique ; seule la présentation
 * change (voir GradesBoard) et le roster passe sur le module courant
 * `/school-students` (au lieu du legacy `/students`). Ajoute la moyenne
 * matière live, calculée avec la formule exacte du bulletin PDF.
 */
export default function GradesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [currentTeacherId, setCurrentTeacherId] = useState('');

  // Années académiques
  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });

  // Enseignant courant
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacher-info'],
    queryFn: async () => (await api.get('/teachers/me/info')).data.data,
    enabled: user?.role === 'TEACHER',
  });
  useEffect(() => {
    if (teacherInfo?.id) setCurrentTeacherId(teacherInfo.id);
  }, [teacherInfo]);

  // Année courante par défaut
  useEffect(() => {
    if (academicYearsData && academicYearsData.length > 0) {
      const currentYear = academicYearsData.find((y: any) => y.isCurrent);
      if (currentYear && currentYear.id !== selectedAcademicYear) setSelectedAcademicYear(currentYear.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearsData]);

  // Trimestres
  const { data: semestersData } = useQuery({
    queryKey: ['semesters', selectedAcademicYear],
    queryFn: async () => {
      if (!selectedAcademicYear) return [];
      return (await api.get(`/semesters?academicYearId=${selectedAcademicYear}`)).data.data || [];
    },
    enabled: !!selectedAcademicYear,
  });

  // Trimestre actif (selon les dates) — logique conservée à l'identique
  const getActiveSemester = () => {
    if (!semestersData || semestersData.length === 0) return null;
    const now = dayjs();
    const sorted = [...semestersData].sort((a: any, b: any) =>
      dayjs(a.start_date).isBefore(dayjs(b.start_date)) ? -1 : 1,
    );
    for (const s of sorted) {
      const start = dayjs(s.start_date);
      const end = dayjs(s.end_date);
      if ((now.isAfter(start) || now.isSame(start, 'day')) && (now.isBefore(end) || now.isSame(end, 'day'))) return s;
    }
    for (const s of sorted) if (dayjs(s.start_date).isAfter(now)) return s;
    return sorted[sorted.length - 1] || null;
  };
  const activeSemester = getActiveSemester();
  const isActiveSemesterFinished = activeSemester ? dayjs().isAfter(dayjs(activeSemester.end_date)) : false;

  const selectedSemesterFinished = useMemo(() => {
    if (!selectedSemester || !semestersData) return false;
    const sel = semestersData.find((s: any) => s.id === selectedSemester);
    return sel ? dayjs().isAfter(dayjs(sel.end_date)) : false;
  }, [selectedSemester, semestersData]);

  useEffect(() => {
    if (activeSemester && activeSemester.id !== selectedSemester) setSelectedSemester(activeSemester.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSemester]);

  // Affectations enseignant (matières + classes)
  const { data: assignmentsData } = useQuery({
    queryKey: ['teacher-assignments', currentTeacherId, selectedAcademicYear],
    queryFn: async () => {
      if (!currentTeacherId || !selectedAcademicYear) return [];
      return (await api.get(`/grades/teacher/${currentTeacherId}/assignments?academicYearId=${selectedAcademicYear}`)).data.data || [];
    },
    enabled: !!currentTeacherId && !!selectedAcademicYear && user?.role === 'TEACHER',
  });

  const uniqueClasses = useMemo(() => {
    const map = new Map<string, any>();
    (assignmentsData || []).forEach((a: any) => a.class && map.set(a.class.id, a.class));
    return [...map.values()];
  }, [assignmentsData]);

  // La classe pilote la matière : on ne propose que les matières que l'enseignant
  // enseigne dans la classe choisie.
  const filteredAssignments = useMemo(
    () => (assignmentsData || []).filter((a: any) => (!selectedClass || a.class?.id === selectedClass)),
    [assignmentsData, selectedClass],
  );
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, any>();
    filteredAssignments.forEach((a: any) => a.subject && map.set(a.subject.id, a.subject));
    return [...map.values()];
  }, [filteredAssignments]);

  // Élèves de la classe — module courant `/school-students` (renvoie gender)
  const { data: studentsData } = useQuery({
    queryKey: ['grades-students-by-class', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      return (await api.get(`/school-students?classId=${selectedClass}&limit=1000`)).data.data || [];
    },
    enabled: !!selectedClass,
  });

  // Types d'évaluation du périmètre courant (enseignant + année + classe + matière).
  // Chaque type = une colonne de notes pré-configurée pour ce périmètre précis.
  const { data: evaluationTypesData } = useQuery({
    queryKey: ['evaluation-types', currentTeacherId, selectedAcademicYear, selectedClass, selectedSubject],
    queryFn: async () => (await api.get('/evaluation-types', {
      params: { teacherId: currentTeacherId, academicYearId: selectedAcademicYear, classId: selectedClass, subjectId: selectedSubject },
    })).data.data || [],
    enabled: !!currentTeacherId && !!selectedAcademicYear && !!selectedClass && !!selectedSubject,
  });

  // Notes existantes
  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades', selectedAcademicYear, currentTeacherId, selectedSubject, selectedSemester, selectedClass],
    queryFn: async () => {
      if (!selectedAcademicYear || !currentTeacherId) return [];
      const params = new URLSearchParams({ academicYearId: selectedAcademicYear, teacherId: currentTeacherId });
      if (selectedSubject) params.append('subjectId', selectedSubject);
      if (selectedSemester) params.append('semesterId', selectedSemester);
      if (selectedClass) params.append('classId', selectedClass);
      return (await api.get(`/grades?${params.toString()}`)).data.data || [];
    },
    enabled: !!selectedAcademicYear && !!currentTeacherId,
  });

  // Notes d'un élève, dans la matière/trimestre courants, triées par date de création
  // (colonnes stables) — logique conservée à l'identique.
  const getStudentGrades = (studentId: string): GradeCell[] => {
    const filtered = (gradesData || []).filter(
      (g: any) => g.student_id === studentId && g.subject_id === selectedSubject && g.semester_id === selectedSemester,
    );
    return filtered.sort(
      (a: any, b: any) => new Date(a.created_at || a.createdAt || 0).getTime() - new Date(b.created_at || b.createdAt || 0).getTime(),
    );
  };
  // Colonnes = types d'évaluation de l'enseignant (déjà paramétrés : barème + coefficient),
  // triés par nom puis numéro. Chaque type = une colonne pré-configurée.
  const columns = useMemo(() => {
    const types = [...(evaluationTypesData || [])];
    types.sort((a: any, b: any) =>
      a.name === b.name ? (a.number ?? 0) - (b.number ?? 0) : String(a.name).localeCompare(String(b.name)),
    );
    return types.map((t: any) => ({
      id: t.id,
      name: t.name,
      number: t.number ?? null,
      maxNote: t.max_note ?? 20,
      coefficient: t.coefficient ?? 1,
    }));
  }, [evaluationTypesData]);

  // Matrice (note par colonne) + moyenne matière live.
  // Moyenne : chaque note ramenée sur /20 puis pondérée par le coefficient du type
  // (1 par défaut, 2 ou un coefficient créé par l'enseignant) — formule IDENTIQUE
  // au bulletin PDF.
  const { matrix, averages } = useMemo(() => {
    const matrix: Record<string, (GradeCell | null)[]> = {};
    const averages: Record<string, number | null> = {};
    (studentsData || []).forEach((s: any) => {
      const grades = getStudentGrades(s.id);
      const row = columns.map(
        (c) => grades.find((g: any) => (g.evaluation_type_id || g.evaluationType?.id) === c.id) ?? null,
      );
      matrix[s.id] = row;

      let totalWeighted = 0;
      let totalCoeff = 0;
      row.forEach((g, i) => {
        if (!g) return;
        const note = typeof g.note === 'number' ? g.note : parseFloat(String(g.note));
        if (Number.isNaN(note)) return;
        const mn = g.max_note || columns[i].maxNote || 20;
        const normalized = (note / mn) * 20;
        const weight = columns[i].coefficient || 1;
        totalWeighted += normalized * weight;
        totalCoeff += weight;
      });
      averages[s.id] = totalCoeff > 0 ? Math.round((totalWeighted / totalCoeff) * 100) / 100 : null;
    });
    return { matrix, averages };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsData, gradesData, columns, selectedSubject, selectedSemester]);

  // Mutations — payloads identiques à l'existant
  const createMutation = useMutation({
    mutationFn: async (d: NoteDraft) =>
      (await api.post('/grades', {
        academicYearId: selectedAcademicYear, teacherId: currentTeacherId, subjectId: selectedSubject,
        semesterId: selectedSemester, studentId: d.studentId, classId: selectedClass,
        evaluationTypeId: d.evaluationTypeId, note: d.note, maxNote: d.maxNote,
      })).data,
    onSuccess: () => { toast.success('Note enregistrée.'); queryClient.invalidateQueries({ queryKey: ['grades'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Échec de l'enregistrement de la note."),
  });
  const updateMutation = useMutation({
    mutationFn: async (d: NoteDraft) =>
      (await api.patch(`/grades/${d.gradeId}`, { evaluationTypeId: d.evaluationTypeId, note: d.note, maxNote: d.maxNote })).data,
    onSuccess: () => { toast.success('Note modifiée.'); queryClient.invalidateQueries({ queryKey: ['grades'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Échec de la modification de la note.'),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/grades/${id}`)).data,
    onSuccess: () => { toast.success('Note supprimée.'); queryClient.invalidateQueries({ queryKey: ['grades'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Échec de la suppression de la note.'),
  });

  const filtersReady = !!(selectedAcademicYear && selectedSemester && selectedSubject && selectedClass && currentTeacherId);

  return (
    <div className="animate-fade-in">
      <GradesBoard
        semesters={(semestersData || []) as any}
        semesterId={selectedSemester}
        onSemesterChange={(value) => {
          if (activeSemester && value !== activeSemester.id && !isActiveSemesterFinished) {
            toast.warning("Le trimestre actif n'est pas encore terminé.");
            return;
          }
          setSelectedSemester(value);
        }}
        activeSemesterId={activeSemester?.id}
        activeSemesterName={activeSemester?.name}
        activeSemesterRange={
          activeSemester
            ? `${dayjs(activeSemester.start_date).format('DD/MM/YYYY')} – ${dayjs(activeSemester.end_date).format('DD/MM/YYYY')}`
            : undefined
        }
        classes={uniqueClasses as any}
        classId={selectedClass}
        onClassChange={(value) => { setSelectedClass(value); setSelectedSubject(''); }}
        subjects={uniqueSubjects as any}
        subjectId={selectedSubject}
        onSubjectChange={setSelectedSubject}
        students={(studentsData || []) as any}
        columns={columns}
        matrix={matrix}
        averages={averages}
        loading={gradesLoading}
        filtersReady={filtersReady}
        semesterLocked={selectedSemesterFinished}
        saving={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
        onSubmitNote={(d) => (d.gradeId ? updateMutation.mutate(d) : createMutation.mutate(d))}
        onDeleteNote={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}
