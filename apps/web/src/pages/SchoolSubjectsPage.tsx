import { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { SchoolSubjectFormPage } from '../components/school/SchoolSubjectFormPage';

/** Matières (§10) — re-skin « Encre & Craie » via le scaffold générique. Routeur module courant `school-subjects`. */

export default function SchoolSubjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: async () => (await api.get('/school-subjects')).data.data || [],
  });
  const items = useMemo(() => (data || []).filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
  }), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['school-subjects'] });
  const createM = useMutation({
    mutationFn: async (v: any) => (await api.post('/school-subjects', v)).data,
    onSuccess: () => { toast.success('Matière créée.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/school-subjects/${id}`)).data,
    onSuccess: () => { toast.success('Matière supprimée.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });

  const handleFormSubmit = () => {
    form.validateFields().then((values) => {
      createM.mutate(values);
    });
  };

  const handleFormCancel = () => {
    form.resetFields();
    setFormOpen(false);
  };

  const handleOpenCreate = () => {
    form.resetFields();
    setFormOpen(true);
  };

  return (
    <div className="animate-fade-in">
      {!formOpen ? (
        <EntityBoard
          title="Matières"
          subtitle="Gestion des matières et disciplines enseignées."
          icon={BookOpen}
          primaryLabel="Nouvelle matière"
          onPrimary={handleOpenCreate}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom ou code…"
          items={items}
          loading={isLoading}
          cardOf={(s) => ({
            key: s.id,
            title: s.name,
            badges: s.code ? [{ label: s.code, kind: 'role' }] : undefined,
          })}
          onDelete={(s) => deleteM.mutate(s.id)}
          emptyTitle="Aucune matière"
          emptyText="Créez une nouvelle matière pour commencer."
        />
      ) : (
        <SchoolSubjectFormPage
          form={form}
          onCancel={handleFormCancel}
          onSubmit={handleFormSubmit}
          submitting={createM.isPending}
        />
      )}
    </div>
  );
}
