import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Applique une mutation du DOM (bascule thème/rôle) en neutralisant les
 * transitions le temps d'un frame. Nécessaire car Chromium ne réinvalide pas
 * une propriété transitionnée quand la valeur d'une var() CSS change
 * (ex. `background: var(--role-accent)` figé au changement de thème).
 */
export function withTransitionsSuppressed(mutate: () => void) {
  if (typeof document === 'undefined') {
    mutate();
    return;
  }
  const html = document.documentElement;
  html.classList.add('ds-theme-switching');
  mutate();
  // Force un reflow pour committer l'état sans transition, puis réactive.
  // setTimeout (et non rAF) : fiable même onglet en arrière-plan (rAF gelé).
  void html.offsetWidth;
  setTimeout(() => html.classList.remove('ds-theme-switching'), 0);
}

/**
 * Nom d'état civil d'un élève : le nom, puis le ou les prénoms, le tout en
 * capitales — la forme des registres et documents scolaires.
 *
 * L'ordre porte l'information (on cherche un élève par son nom), et la casse
 * unique évite qu'un élève à trois prénoms se lise autrement qu'un élève à un
 * seul : « COULIBALY YANNICK AKA JEAN », « KONÉ ADAMA ».
 */
export function studentName(lastName?: string | null, firstName?: string | null): string {
  const nom = (lastName || '').trim();
  const prenoms = (firstName || '').trim();
  return [nom, prenoms].filter(Boolean).join(' ').toUpperCase();
}

/** Minuscules sans accents ni ponctuation — base d'une recherche « Kone » = « Koné ». */
export function searchable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function calculateAge(birthDate: string | Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

export function generateStudentNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `S${year}${random}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
