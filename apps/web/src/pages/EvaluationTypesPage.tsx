import { useMemo, useState, useEffect } from 'react';
import { Form, Select } from 'antd';
import { ClipboardList } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { EvaluationTypeFormPage, DEFAULT_COEFFICIENT_OPTIONS } from '../components/pedagogy/EvaluationTypeFormPage';

/**
 * Types d'évaluation (§10) — propres à l'enseignant connecté ET rattachés à un
 * périmètre (année scolaire en cours + classe + matière). On sélectionne la
 * classe puis la matière — les matières proposées sont celles que l'enseignant
 * enseigne dans cette classe (l'année est celle en cours, résolue en arrière-plan) ;
 * la liste et la création sont alors limitées à ce périmètre. Chaque type crée
 * automatiquement une colonne dans la saisie des notes pour ce même périmètre.
 */
export default function EvaluationTypesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [form] = Form.useForm();

  const { data: teacher } = useQuery({
    queryKey: ['teacher-info'],
    queryFn: async () => (await api.get('/teachers/me/info')).data.data,
    enabled: user?.role === 'TEACHER',
  });
  const teacherId = teacher?.id;

  // Année scolaire en cours (résolue en arrière-plan).
  const { data: years } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });
  const currentYear = years?.find((y: any) => y.isCurrent);

  // Affectations de l'enseignant → matières et classes disponibles.
  const { data: assignments } = useQuery({
    queryKey: ['teacher-assignments', teacherId, currentYear?.id],
    queryFn: async () => (await api.get(`/grades/teacher/${teacherId}/assignments?academicYearId=${currentYear.id}`)).data.data || [],
    enabled: !!teacherId && !!currentYear?.id && user?.role === 'TEACHER',
  });
  const classes = useMemo(() => {
    const m = new Map<string, any>();
    (assignments || []).forEach((a: any) => a.class && m.set(a.class.id, a.class));
    return [...m.values()];
  }, [assignments]);
  const subjects = useMemo(() => {
    const m = new Map<string, any>();
    (assignments || [])
      .filter((a: any) => !selectedClass || a.class?.id === selectedClass)
      .forEach((a: any) => a.subject && m.set(a.subject.id, a.subject));
    return [...m.values()];
  }, [assignments, selectedClass]);

  const filtersReady = !!(teacherId && currentYear?.id && selectedSubject && selectedClass);

  const { data, isLoading } = useQuery({
    queryKey: ['evaluation-types', teacherId, currentYear?.id, selectedClass, selectedSubject],
    queryFn: async () => (await api.get('/evaluation-types', {
      params: { teacherId, academicYearId: currentYear.id, classId: selectedClass, subjectId: selectedSubject },
    })).data.data || [],
    enabled: filtersReady,
  });
  const items = useMemo(() => (data || []).filter((t: any) => !search || t.name?.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const subjectLabel = subjects.find((s) => s.id === selectedSubject)?.name;
  const classLabel = classes.find((c) => c.id === selectedClass)?.name;
  const scopeLabel = filtersReady ? `${classLabel} · ${subjectLabel} · ${currentYear?.name}` : undefined;

  // Coefficients proposés dans le formulaire : les 2 défauts (toujours présents,
  // côté serveur) + ceux que l'enseignant a créés lui-même via le bouton « + ».
  const { data: coefficientOptions } = useQuery({
    queryKey: ['evaluation-coefficients', teacherId],
    queryFn: async () => (await api.get('/evaluation-coefficients')).data.data || [],
    enabled: !!teacherId,
  });

  const addCoefficientM = useMutation({
    mutationFn: async ({ value }: { value: number }) => (
      await api.post('/evaluation-coefficients', { value })
    ).data,
    onSuccess: (_res, vars) => {
      toast.success(`Coefficient ${vars.value} créé.`);
      queryClient.invalidateQueries({ queryKey: ['evaluation-coefficients'] });
    },
    // L'erreur est affichée dans la modale du formulaire (pas de toast en double).
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['evaluation-types'] });
  const createM = useMutation({
    mutationFn: async (v: any) => (await api.post('/evaluation-types', {
      name: v.name, teacherId,
      academicYearId: currentYear.id, classId: selectedClass, subjectId: selectedSubject,
      coefficient: Number(v.coefficient) || 1, maxNote: Number(v.maxNote) || 20,
    })).data,
    onSuccess: () => { toast.success('Type créé.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: async ({ id, ...v }: any) => (await api.patch(`/evaluation-types/${id}`, { name: v.name, coefficient: Number(v.coefficient) || 1, maxNote: Number(v.maxNote) || 20 })).data,
    onSuccess: () => { toast.success('Type modifié.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/evaluation-types/${id}`)).data,
    onSuccess: () => { toast.success('Type supprimé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });

  const handleFormSubmit = () => {
    form.validateFields().then((values) => {
      if (editing) {
        updateM.mutate({ id: editing.id, ...values });
      } else {
        createM.mutate(values);
      }
    });
  };

  const handleFormCancel = () => {
    form.resetFields();
    setFormOpen(false);
    setEditing(null);
  };

  const handleOpenCreate = () => {
    if (!filtersReady) {
      toast.warning('Sélectionnez d\'abord une classe et une matière.');
      return;
    }
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditing(item);
    form.resetFields();
    setFormOpen(true);
  };

  // Le formulaire ne monte qu'après le re-render déclenché par setFormOpen(true) ;
  // appeler setFieldsValue avant que <Form> existe n'a aucun effet (champs pas
  // encore enregistrés). On attend donc le montage via useEffect + micro-délai.
  useEffect(() => {
    if (formOpen && editing) {
      const t = setTimeout(() => form.setFieldsValue({
        name: editing.name,
        coefficient: editing.coefficient ?? 1,
        maxNote: editing.max_note ?? 20,
        number: editing.number ?? undefined,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [formOpen, editing, form]);

  const filterControls = (
    <>
      <label className="ds-field min-w-[160px]">
        <span>Classe</span>
        <Select
          value={selectedClass || undefined}
          onChange={(v) => { setSelectedClass(v); setSelectedSubject(''); }}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Sélectionner…"
          disabled={!classes.length}
          style={{ width: '100%' }}
        />
      </label>
      <label className="ds-field min-w-[180px]">
        <span>Matière</span>
        <Select
          value={selectedSubject || undefined}
          onChange={setSelectedSubject}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          placeholder="Sélectionner…"
          disabled={!selectedClass}
          style={{ width: '100%' }}
        />
      </label>
    </>
  );

  return (
    <div className="animate-fade-in">
      {formOpen ? (
        <EvaluationTypeFormPage
          form={form}
          editing={editing}
          existingTypes={(data || []) as any}
          scopeLabel={scopeLabel}
          coefficientOptions={coefficientOptions?.length ? coefficientOptions : DEFAULT_COEFFICIENT_OPTIONS}
          onAddCoefficient={async (value) => {
            await addCoefficientM.mutateAsync({ value });
            // On attend le refetch pour que la nouvelle option existe dans le
            // select avant que le formulaire ne la sélectionne.
            await queryClient.refetchQueries({ queryKey: ['evaluation-coefficients'] });
            return value;
          }}
          addingCoefficient={addCoefficientM.isPending}
          onCancel={handleFormCancel}
          onSubmit={handleFormSubmit}
          submitting={createM.isPending || updateM.isPending}
        />
      ) : (
        <EntityBoard
          title="Types d'évaluation"
          subtitle={currentYear ? `Année en cours : ${currentYear.name}. Types propres à la classe et à la matière choisies.` : 'Aucune année scolaire en cours.'}
          icon={ClipboardList}
          primaryLabel="Nouveau type"
          onPrimary={handleOpenCreate}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom…"
          filters={filterControls}
          items={filtersReady ? items : []}
          loading={filtersReady && isLoading}
          cardOf={(t) => ({
            key: t.id,
            title: t.number != null ? `${t.name} N°${t.number}` : t.name,
            badges: [
              { label: `Note sur ${t.max_note ?? 20}`, kind: 'neutral' as const },
              ...(t.coefficient > 1 ? [{ label: `Coefficientée ×${t.coefficient}`, kind: 'role' as const }] : []),
            ],
          })}
          onEdit={handleOpenEdit}
          onDelete={(t) => deleteM.mutate(t.id)}
          emptyTitle={filtersReady ? 'Aucun type d\'évaluation' : 'Sélectionnez une classe et une matière'}
          emptyText={filtersReady
            ? 'Créez un type (devoir, interrogation…) pour cette classe et cette matière.'
            : 'Choisissez la classe puis la matière ci-dessus pour voir et créer leurs types d\'évaluation.'}
        />
      )}
    </div>
  );
}
