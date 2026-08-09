import { useEffect, useMemo, useState } from 'react';
import { UserCog } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Form } from 'antd';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { PersonnelUserFormPage } from '../components/personnel/PersonnelUserFormPage';

export default function PersonnelUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['personnel-users'],
    queryFn: async () => (await api.get('/users')).data.data || [],
  });
  const { data: roles } = useQuery({
    queryKey: ['roles-all'],
    queryFn: async () => (await api.get('/roles')).data.data || [],
  });

  const items = useMemo(() => (data || []).filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  }), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['personnel-users'] });
  const createM = useMutation({
    mutationFn: async (payload: any) => (await api.post('/users', payload)).data,
    onSuccess: () => { toast.success('Utilisateur créé.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => (await api.patch(`/users/${id}`, payload)).data,
    onSuccess: () => { toast.success('Utilisateur modifié.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => { toast.success('Utilisateur supprimé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });

  const handleOpenCreate = () => {
    setEditing(null);
    setResetPassword(false);
    form.resetFields();
    setFormOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditing(user);
    setResetPassword(false);
    setFormOpen(true);
  };

  const handleCancel = () => {
    form.resetFields();
    setEditing(null);
    setResetPassword(false);
    setFormOpen(false);
  };

  useEffect(() => {
    if (formOpen && editing) {
      const t = setTimeout(() => form.setFieldsValue({
        lastName: editing.lastName,
        firstName: editing.firstName,
        email: editing.email,
        phone: editing.phone,
        roleId: editing.roleId,
        isActive: editing.isActive,
      }), 50);
      return () => clearTimeout(t);
    }
  }, [formOpen, editing, form]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload: any = {
        lastName: values.lastName.trim(),
        firstName: values.firstName.trim(),
        email: values.email.trim(),
        phone: values.phone || undefined,
        roleId: values.roleId,
        isActive: values.isActive,
      };
      if (editing) {
        if (resetPassword && values.password) payload.password = values.password;
        updateM.mutate({ id: editing.id, payload });
      } else {
        payload.password = values.password;
        createM.mutate(payload);
      }
    });
  };

  return (
    <div className="animate-fade-in">
      {!formOpen ? (
        <EntityBoard
          title="Utilisateurs"
          subtitle="Comptes du personnel utilisant l'application (secrétariat, comptabilité…)."
          icon={UserCog}
          primaryLabel="Nouvel utilisateur"
          onPrimary={handleOpenCreate}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom, email…"
          items={items}
          loading={isLoading}
          cardOf={(u) => ({
            key: u.id,
            title: `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || '—',
            subtitle: u.email || '—',
            badges: [
              ...(u.customRole ? [{ label: u.customRole.name, kind: 'role' as const }] : []),
              { label: u.isActive ? 'Actif' : 'Inactif', kind: u.isActive ? ('success' as const) : ('danger' as const) },
              ...(u.isProtected ? [{ label: 'Protégé', kind: 'warning' as const }] : []),
            ],
            deleteDisabled: !!u.isProtected,
            deleteDisabledReason: 'Ce compte administrateur est protégé et ne peut pas être supprimé.',
          })}
          onEdit={handleOpenEdit}
          onDelete={(u) => {
            if (u.isProtected) {
              toast.error('Ce compte administrateur est protégé et ne peut pas être supprimé.');
              return;
            }
            deleteM.mutate(u.id);
          }}
          deleteLabel={(u) => `Le compte de « ${u.firstName} ${u.lastName} » sera supprimé.`}
          emptyTitle="Aucun utilisateur"
          emptyText="Ajoutez un compte pour un membre du personnel."
        />
      ) : (
        <PersonnelUserFormPage
          form={form}
          editing={editing}
          roles={roles || []}
          resetPassword={resetPassword}
          onResetPasswordChange={setResetPassword}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          submitting={createM.isPending || updateM.isPending}
        />
      )}
    </div>
  );
}
