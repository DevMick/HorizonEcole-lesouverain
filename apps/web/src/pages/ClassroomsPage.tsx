import { useEffect, useMemo, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { ClassroomFormPage } from '../components/classrooms/ClassroomFormPage';

/** Salles de classe (§10) — re-skin via scaffold générique. Routeur `classrooms`. */

export default function ClassroomsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['classrooms'],
    queryFn: async () => { const d = (await api.get('/classrooms?limit=1000')).data; return d.data?.data || d.data || []; },
  });
  const items = useMemo(() => (data || []).filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['classrooms'] });
  const createM = useMutation({
    mutationFn: async (v: any) => (await api.post('/classrooms', v)).data,
    onSuccess: () => { toast.success('Salle créée.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: async ({ id, ...v }: any) => (await api.patch(`/classrooms/${id}`, v)).data,
    onSuccess: () => { toast.success('Salle modifiée.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/classrooms/${id}`)).data,
    onSuccess: () => { toast.success('Salle supprimée.'); invalidate(); },
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
    setEditing(null);
    setFormOpen(false);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const handleOpenEdit = (classroom: any) => {
    setEditing(classroom);
    setFormOpen(true);
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

  const handleViewDetail = (classroom: any) => {
    // No detail page for classrooms
  };

  return (
    <div className="animate-fade-in">
      {!formOpen ? (
        <EntityBoard
          title="Salles de classe"
          subtitle="Gestion des salles de l'établissement."
          icon={DoorOpen}
          primaryLabel="Nouvelle salle"
          onPrimary={handleOpenCreate}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom…"
          items={items}
          loading={isLoading}
          cardOf={(c) => ({ key: c.id, title: c.name })}
          onEdit={handleOpenEdit}
          onDelete={(c) => deleteM.mutate(c.id)}
          emptyTitle="Aucune salle"
          emptyText="Créez une nouvelle salle pour commencer."
        />
      ) : (
        <ClassroomFormPage
          form={form}
          editing={editing}
          onCancel={handleFormCancel}
          onSubmit={handleFormSubmit}
          submitting={createM.isPending || updateM.isPending}
        />
      )}
    </div>
  );
}
