import { useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { EntityBoard } from '../components/shared/EntityBoard';

/**
 * Utilisateurs (§10) — re-skin via scaffold. Lecture seule (l'écran existant
 * n'a ni création ni édition câblées ; le routeur `users` expose GET + PUT,
 * mais on reste fidèle au périmètre actuel). `role`/`isActive` en badges.
 */

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur', TEACHER: 'Enseignant', ACCOUNTANT: 'Comptable', STUDENT: 'Élève', PARENT: 'Parent',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const b = (await api.get('/users')).data; return b.data?.data || b.data || []; },
  });
  const items = useMemo(() => (data || []).filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  }), [data, search]);

  return (
    <div className="animate-fade-in">
      <EntityBoard
        title="Utilisateurs"
        subtitle="Comptes du système."
        icon={User}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher par nom ou email…"
        items={items}
        loading={isLoading}
        cardOf={(u) => ({
          key: u.id,
          title: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
          subtitle: u.email,
          badges: [
            { label: ROLE_LABEL[u.role] || u.role, kind: 'role' },
            { label: u.isActive ? 'Actif' : 'Inactif', kind: u.isActive ? 'success' : 'danger' },
          ],
        })}
        emptyTitle="Aucun utilisateur"
        emptyText="Aucun compte ne correspond à cette recherche."
      />
    </div>
  );
}
