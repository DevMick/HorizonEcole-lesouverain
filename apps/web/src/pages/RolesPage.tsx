import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { RoleFormPage } from '../components/roles/RoleFormPage';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get('/roles')).data.data || [],
  });

  const items = useMemo(() => (data || []).filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
  }), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] });
  const createM = useMutation({
    mutationFn: async (payload: any) => (await api.post('/roles', payload)).data,
    onSuccess: () => { toast.success('Rôle créé.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => (await api.patch(`/roles/${id}`, payload)).data,
    onSuccess: () => { toast.success('Rôle modifié.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/roles/${id}`)).data,
    onSuccess: () => { toast.success('Rôle supprimé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer ce rôle.'),
  });

  const handleOpenCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setSelectedKeys([]);
    setNameError('');
    setFormOpen(true);
  };

  const handleOpenEdit = (role: any) => {
    if (role.isProtected) {
      toast.error('Ce rôle est protégé : il reçoit automatiquement tous les menus et ne peut pas être modifié.');
      return;
    }
    setEditing(role);
    setName(role.name);
    setDescription(role.description || '');
    setSelectedKeys(role.menuKeys || []);
    setNameError('');
    setFormOpen(true);
  };

  const handleCancel = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    if (name.trim().length < 2) {
      setNameError('Le nom doit contenir au moins 2 caractères');
      return;
    }
    setNameError('');
    const payload = { name: name.trim(), description: description.trim() || undefined, menuKeys: selectedKeys };
    if (editing) {
      updateM.mutate({ id: editing.id, payload });
    } else {
      createM.mutate(payload);
    }
  };

  const toggleKey = (key: string) => setSelectedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  const selectGroup = (groupKeys: string[]) => setSelectedKeys((prev) => Array.from(new Set([...prev, ...groupKeys])));
  const clearGroup = (groupKeys: string[]) => setSelectedKeys((prev) => prev.filter((k) => !groupKeys.includes(k)));

  return (
    <div className="animate-fade-in">
      {!formOpen ? (
        <EntityBoard
          title="Rôles"
          subtitle="Définissez les profils du personnel et les menus qui leur sont accessibles."
          icon={Shield}
          primaryLabel="Nouveau rôle"
          onPrimary={handleOpenCreate}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher un rôle…"
          items={items}
          loading={isLoading}
          cardOf={(r) => ({
            key: r.id,
            title: r.name,
            subtitle: r.description || '—',
            badges: [
              ...(r.isProtected ? [{ label: 'Protégé', kind: 'warning' as const }] : []),
              { label: `${r.menuKeys?.length ?? 0} menu(s)`, kind: 'info' as const },
              { label: `${r.usersCount ?? 0} utilisateur(s)`, kind: 'role' as const },
            ],
          })}
          onEdit={handleOpenEdit}
          onDelete={(r) => {
            if (r.isProtected) {
              toast.error('Ce rôle est protégé et ne peut pas être supprimé.');
              return;
            }
            deleteM.mutate(r.id);
          }}
          deleteLabel={(r) => `« ${r.name} » sera supprimé.`}
          emptyTitle="Aucun rôle"
          emptyText="Créez un rôle pour définir un profil de personnel."
        />
      ) : (
        <RoleFormPage
          editing={editing}
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          selectedKeys={selectedKeys}
          onToggleKey={toggleKey}
          onSelectGroup={selectGroup}
          onClearGroup={clearGroup}
          nameError={nameError}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
          submitting={createM.isPending || updateM.isPending}
        />
      )}
    </div>
  );
}
