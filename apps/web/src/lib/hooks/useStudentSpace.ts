import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * Socle de données de l'espace Élève (§10).
 *
 * Aucun identifiant d'élève ne circule : les routes `/student/*` ne lisent que
 * l'élève du compte connecté. Il n'y a donc rien à sélectionner ni à mémoriser,
 * contrairement à l'espace Parent et son sélecteur d'enfant.
 */

export interface StudentProfile {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  avatarUrl?: string | null;
  status?: string;
  enrollmentDate?: string;
  class?: { id: string; name: string } | null;
}

export function useStudentMe() {
  return useQuery<StudentProfile>({
    queryKey: ['student-me'],
    queryFn: async () => (await api.get('/student/me')).data.data,
  });
}
