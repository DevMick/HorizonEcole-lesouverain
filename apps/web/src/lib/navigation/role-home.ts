/**
 * Page d'accueil par défaut selon le rôle de l'utilisateur connecté.
 *
 * - ADMIN / ACCOUNTANT / TEACHER : tableau de bord (le menu adapte le contenu).
 * - PARENT : Espace Famille (`/parent/*`).
 * - STUDENT : Ma Scolarité (`/student/*`).
 *
 * Parent et Élève ont chacun leur propre jeu de routes, sans aucune page
 * d'administration montée — voir App.tsx.
 *
 * Utilisé après la connexion et pour les redirections « catch-all ».
 */
export function roleHome(role?: string | null): string {
  switch (String(role).toUpperCase()) {
    case 'PARENT':
      return '/parent';
    case 'STUDENT':
      return '/student';
    default:
      return '/dashboard';
  }
}

/** Vrai pour le rôle Parent, qui dispose de son propre jeu de routes `/parent/*`. */
export function isParentRole(role?: string | null): boolean {
  return String(role).toUpperCase() === 'PARENT';
}

/** Vrai pour le rôle Élève, qui dispose de son propre jeu de routes `/student/*`. */
export function isStudentRole(role?: string | null): boolean {
  return String(role).toUpperCase() === 'STUDENT';
}
