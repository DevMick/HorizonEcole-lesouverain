import { useMemo, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../components/ds';
import { EntityBoard } from '../components/shared/EntityBoard';
import { EntityFormModal, type EntityField } from '../components/shared/EntityFormModal';

/**
 * Parents (§10) — re-skin via scaffold. CRUD sur `/parents`.
 * NB : l'association élève↔parent se fait depuis la fiche Élève (§9.3, onglet
 * Parents) — non redupliquée ici (consolidation, pas de perte : les deux côtés
 * pointent la même relation `student_parents`).
 */

const FIELDS: EntityField[] = [
  { name: 'lastName', label: 'Nom', required: true, min: 2, colSpan: 1 },
  { name: 'firstName', label: 'Prénom', required: true, min: 2, colSpan: 1 },
  { name: 'phone', label: 'Contact', required: true, min: 8, colSpan: 1, placeholder: '+225 …' },
  { name: 'email', label: 'Email (optionnel)', colSpan: 1, placeholder: 'exemple@email.com' },
];

export default function ParentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['parents'],
    queryFn: async () => { const b = (await api.get('/parents', { params: { limit: 1000, page: 1 } })).data; return b.data?.data || b.data || []; },
  });
  const items = useMemo(() => (data || []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q);
  }), [data, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['parents'] });
  const createM = useMutation({
    mutationFn: async (v: any) => (await api.post('/parents', v)).data,
    onSuccess: () => { toast.success('Parent créé.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la création.'),
  });
  const updateM = useMutation({
    mutationFn: async ({ id, ...v }: any) => (await api.put(`/parents/${id}`, v)).data,
    onSuccess: () => { toast.success('Parent modifié.'); setFormOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erreur lors de la modification.'),
  });
  const deleteM = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/parents/${id}`)).data,
    onSuccess: () => { toast.success('Parent supprimé.'); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Impossible de supprimer.'),
  });

  return (
    <div className="animate-fade-in">
      <EntityBoard
        title="Parents"
        subtitle="Répertoire des parents et tuteurs."
        icon={UsersRound}
        primaryLabel="Nouveau parent"
        onPrimary={() => { setEditing(null); setFormOpen(true); }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher par nom ou contact…"
        items={items}
        loading={isLoading}
        cardOf={(p) => ({
          key: p.id,
          title: `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim() || '—',
          subtitle: p.phone || p.email || '—',
        })}
        onEdit={(p) => { setEditing(p); setFormOpen(true); }}
        onDelete={(p) => deleteM.mutate(p.id)}
        emptyTitle="Aucun parent"
        emptyText="Ajoutez un parent pour commencer."
      />
      <EntityFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier le parent' : 'Nouveau parent'}
        fields={FIELDS}
        initial={editing ? { lastName: editing.lastName, firstName: editing.firstName, phone: editing.phone, email: editing.email } : null}
        submitLabel={editing ? 'Modifier' : 'Créer'}
        submitting={createM.isPending || updateM.isPending}
        onSubmit={(v) => (editing ? updateM.mutate({ id: editing.id, ...v }) : createM.mutate(v))}
      />
    </div>
  );
}
