/**
 * Catalogue statique des menus affectables à un rôle personnalisé (page
 * Rôles). Reflète exactement les entrées de la branche « admin » de
 * `use-app-navigation.tsx` — la seule branche que voient les comptes
 * ADMIN/ACCOUNTANT créés via le module Personnel/Utilisateurs.
 */
export interface MenuCatalogItem {
  key: string;
  label: string;
}

export interface MenuCatalogGroup {
  key: string;
  label: string;
  items: MenuCatalogItem[];
}

export const MENU_CATALOG: MenuCatalogGroup[] = [
  {
    key: 'dashboard',
    label: 'Tableau de bord',
    items: [{ key: '/dashboard', label: 'Tableau de bord' }],
  },
  {
    key: 'people',
    label: 'Gestion des Personnes',
    items: [
      { key: '/people/students', label: 'Élèves' },
      { key: '/people/parents', label: 'Parents' },
      { key: '/people/teachers', label: 'Enseignants' },
      { key: '/people/roles', label: 'Rôles' },
      { key: '/people/users', label: 'Utilisateurs' },
    ],
  },
  {
    key: 'academic',
    label: 'Année Académique',
    items: [
      { key: '/academic/years', label: 'Années Scolaires' },
      { key: '/academic/inscriptions', label: 'Inscriptions' },
      { key: '/people/classrooms', label: 'Salles de Classes' },
      { key: '/academic/timetable', label: 'Emploi du Temps' },
      { key: '/academic/attendance', label: 'Liste de Présence' },
      { key: '/academic/uncalled-sessions', label: 'Séances non tenues' },
    ],
  },
  {
    key: 'pedagogy',
    label: 'Pédagogie',
    items: [
      { key: '/academic/classes', label: 'Classes' },
      { key: '/academic/subjects', label: 'Matières' },
      { key: '/academic/assignments', label: 'Affectations' },
      { key: '/academic/coefficients', label: 'Coefficients' },
      { key: '/academic/class-grades', label: 'Notes par Matière' },
      { key: '/academic/conduct', label: 'Conduite' },
      { key: '/academic/complete-averages', label: 'Moyennes Complètes' },
    ],
  },
];
