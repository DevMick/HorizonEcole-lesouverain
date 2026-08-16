import { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { SchoolClassFormPage } from '../components/school/SchoolClassFormPage';
import { ClassGeneratorPage } from '../components/school/ClassGeneratorPage';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Classes (§10) — re-skin « Encre & Craie » via le scaffold générique. Routeur module courant `school-classes`.
 *  Création exclusivement via le générateur de divisions par niveau ; le
 *  formulaire classe ne sert plus qu'à l'édition (renommer une classe). */

export default function SchoolClassesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genCounts, setGenCounts] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['school-classes'],
    queryFn: async () => (await api.get('/school-classes')).data.data || [],
  });
  const items = useMemo(() => (data || []).filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['school-classes'] });

  // Générateur de classes — divisions numérotées par niveau (ex. Sixième 1, Sixième 2…).
  const existingNames = useMemo(() => new Set((data || []).map((c: any) => (c.name || '').trim().toLowerCase())), [data]);
  const existingCountFor = (levelKey: string) => {
    const re = new RegExp(`^${escapeRegExp(levelKey)}\\s*\\d+$`, 'i');
    return (data || []).filter((c: any) => re.test((c.name || '').trim())).length;
  };
  const namesToCreate = useMemo(() => {
    const names: string[] = [];
    for (const [levelKey, count] of Object.entries(genCounts)) {
      for (let n = 1; n <= (count || 0); n++) {
        const name = `${levelKey} ${n}`;
        if (!existingNames.has(name.toLowerCase())) names.push(name);
      }
    }
    return names;
  }, [genCounts, existingNames]);

  const generateM = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(namesToCreate.map((name) => api.post('/school-classes', { name })));
      const failed = results.filter((r) => r.status === 'rejected').length;
      return { succeeded: results.length - failed, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded > 0) toast.success(`${succeeded} classe${succeeded > 1 ? 's' : ''} créée${succeeded > 1 ? 's' : ''}.`);
      if (failed > 0) toast.error(`${failed} création${failed > 1 ? 's' : ''} en échec.`);
      setGenerateOpen(false);
      setGenCounts({});
      invalidate();
    },
    onError: () => toast.error('Erreur lors de la génération des classes.'),
  });

  // Rattrapage du programme MENA (matières + rattachements) pour les classes
  // déjà créées. Les nouvelles classes le reçoivent automatiquement à leur
  // création ; ce bouton ne sert donc qu'aux classes antérieures. Idempotent.
  const curriculumM = useMutation({
    mutationFn: async () => (await api.post('/school-classes/curriculum/generate')).data,
    onSuccess: (res: any) => {
      const d = res?.data || {};
      toast.success(
        `${d.classesTraitees ?? 0} classe(s) traitée(s) — ` +
        `${d.matieresCreees ?? 0} matière(s), ${d.rattachementsCrees ?? 0} rattachement(s).`,
      );
      if (d.classesIgnorees?.length) {
        toast.error(`Niveau non reconnu : ${d.classesIgnorees.join(', ')}.`);
      }
      queryClient.invalidateQueries({ queryKey: ['school-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-subjects'] });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la génération du programme.'),
  });

  const updateM = useMutation({
    mutationFn: async ({ id, ...v }: any) => (await api.patch(`/school-classes/${id}`, v)).data,
    onSuccess: () => { toast.success('Classe modifiée.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/school-classes/${id}`)).data,
    onSuccess: () => { toast.success('Classe supprimée.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });

  const handleFormSubmit = () => {
    form.validateFields().then((values) => {
      updateM.mutate({ id: editing.id, ...values });
    });
  };

  const handleFormCancel = () => {
    form.resetFields();
    setEditing(null);
    setFormOpen(false);
  };

  const handleOpenEdit = (schoolClass: any) => {
    setEditing(schoolClass);
    setFormOpen(true);
  };

  const handleViewDetail = (schoolClass: any) => {
    navigate(`/academic/classes/${schoolClass.id}`);
  };

  // Le formulaire ne monte qu'après le re-render déclenché par setFormOpen(true) ;
  // appeler setFieldsValue avant que <Form> existe n'a aucun effet (champs pas
  // encore enregistrés). On attend donc le montage via useEffect + micro-délai.
  useEffect(() => {
    if (formOpen && editing) {
      const t = setTimeout(() => form.setFieldsValue({
        name: editing.name,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [formOpen, editing, form]);

  return (
    <div className="animate-fade-in">
      {generateOpen ? (
        <ClassGeneratorPage
          counts={genCounts}
          onCountChange={(levelKey, n) => setGenCounts((prev) => ({ ...prev, [levelKey]: n }))}
          existingCountFor={existingCountFor}
          onCancel={() => { setGenerateOpen(false); setGenCounts({}); }}
          onSubmit={() => generateM.mutate()}
          submitting={generateM.isPending}
          toCreateCount={namesToCreate.length}
        />
      ) : !formOpen ? (
        <EntityBoard
          title="Classes"
          subtitle="Gestion des classes et niveaux scolaires."
          icon={GraduationCap}
          primaryLabel="Générer les classes"
          onPrimary={() => setGenerateOpen(true)}
          secondaryLabel={curriculumM.isPending ? 'Génération…' : 'Générer les matières'}
          onSecondary={() => curriculumM.mutate()}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom…"
          items={items}
          loading={isLoading}
          cardOf={(c) => ({
            key: c.id,
            title: c.name,
            badges: [
              { label: `${c._count?.classSubjects ?? 0} matière${(c._count?.classSubjects ?? 0) > 1 ? 's' : ''}`, kind: 'neutral' },
            ],
            onClick: () => handleViewDetail(c),
          })}
          onEdit={handleOpenEdit}
          onDelete={(c) => deleteM.mutate(c.id)}
          emptyTitle="Aucune classe"
          emptyText="Générez les classes de ton établissement pour commencer."
        />
      ) : (
        <SchoolClassFormPage
          form={form}
          editing={editing}
          onCancel={handleFormCancel}
          onSubmit={handleFormSubmit}
          submitting={updateM.isPending}
        />
      )}
    </div>
  );
}
