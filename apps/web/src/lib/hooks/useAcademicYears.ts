import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * Années scolaires + année « en cours ».
 *
 * L'année en cours pilote tous les écrans des espaces Parent et Élève par
 * défaut : ni l'un ni l'autre ne devrait avoir à choisir une année pour voir
 * quelque chose — le sélecteur ne sert qu'à consulter l'historique.
 */
export function useAcademicYears() {
  const query = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => (await api.get('/academic-years')).data.data || [],
  });

  const currentYear = useMemo(
    () => (query.data || []).find((y: any) => y.isCurrent) || (query.data || [])[0] || null,
    [query.data],
  );

  return { ...query, currentYear };
}
