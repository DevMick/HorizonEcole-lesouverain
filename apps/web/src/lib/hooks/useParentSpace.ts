import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api';

// Réexport : les écrans Parent consomment l'année scolaire par ce module, mais
// le hook est partagé avec l'espace Élève (cf. useAcademicYears.ts).
export { useAcademicYears } from './useAcademicYears';

/**
 * Socle de données de l'espace Parent (§10) : profil + enfants rattachés,
 * année scolaire en cours, et sélection d'enfant partagée entre les écrans.
 *
 * Toutes les données passent par `/parent/*` — routes scopées côté API par le
 * lien `student_parents` : un parent n'atteint jamais un élève qui n'est pas le
 * sien, même en forgeant un identifiant.
 */

export interface ParentChild {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  avatarUrl?: string | null;
  status?: string;
  relation?: string;
  class?: { id: string; name: string } | null;
}

export interface ParentProfile {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  profession?: string | null;
  workplace?: string | null;
  avatarUrl?: string | null;
  isPrimaryContact: boolean;
  isFinancialResponsible: boolean;
}

/** Enfant sélectionné, persisté : on ne le redemande pas à chaque changement d'écran. */
interface ChildSelection {
  childId: string | null;
  setChildId: (id: string) => void;
}
export const useChildSelection = create<ChildSelection>()(
  persist(
    (set) => ({
      childId: null,
      setChildId: (childId) => set({ childId }),
    }),
    { name: 'parent-selected-child' },
  ),
);

/** Profil du parent connecté + ses enfants. */
export function useParentMe() {
  return useQuery<{ parent: ParentProfile; children: ParentChild[] }>({
    queryKey: ['parent-me'],
    queryFn: async () => (await api.get('/parent/me')).data.data,
  });
}

/**
 * Enfants + enfant actif. Sélectionne automatiquement le premier enfant tant
 * qu'aucun choix n'a été fait (ou si l'enfant mémorisé n'existe plus).
 */
export function useActiveChild() {
  const { data, isLoading, isError } = useParentMe();
  const { childId, setChildId } = useChildSelection();

  const children = data?.children ?? [];
  const known = children.some((c) => c.id === childId);

  useEffect(() => {
    if (!isLoading && children.length > 0 && !known) setChildId(children[0].id);
  }, [isLoading, children, known, setChildId]);

  const child = known ? children.find((c) => c.id === childId)! : children[0] ?? null;

  return {
    parent: data?.parent,
    children,
    child,
    childId: child?.id ?? null,
    setChildId,
    isLoading,
    isError,
  };
}

export const fullName = (c?: { firstName?: string; lastName?: string } | null) =>
  `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();

export const initialsOf = (c?: { firstName?: string; lastName?: string } | null) =>
  `${c?.firstName?.charAt(0) ?? ''}${c?.lastName?.charAt(0) ?? ''}`.toUpperCase();
