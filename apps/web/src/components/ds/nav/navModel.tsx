import type { MenuProps } from 'antd';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FilePlus,
  ClipboardCheck,
  BookOpen,
  FileText,
  Home,
  PenSquare,
  Menu as MenuIcon,
} from 'lucide-react';

/** Modèle de navigation simple dérivé du menu Ant de use-app-navigation. */
export interface NavLeaf {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}
export interface NavSection {
  /** Libellé de groupe (undefined = éléments de premier niveau sans en-tête). */
  label?: string;
  items: NavLeaf[];
}

type AntItem = NonNullable<MenuProps['items']>[number] & {
  key?: React.Key;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  children?: AntItem[];
};

/**
 * Convertit le menu Ant (source de vérité : use-app-navigation.tsx) en sections
 * DS. Les entrées avec `children` deviennent un groupe (label + items), les
 * feuilles de premier niveau une section sans label. Aucune donnée inventée.
 */
export function adaptMenu(items: MenuProps['items']): NavSection[] {
  const sections: NavSection[] = [];
  for (const raw of (items ?? []) as AntItem[]) {
    if (!raw || (raw as { type?: string }).type === 'divider') continue;
    const children = raw.children;
    if (children && children.length) {
      sections.push({
        label: typeof raw.label === 'string' ? raw.label : String(raw.key),
        items: children.map(toLeaf),
      });
    } else {
      sections.push({ items: [toLeaf(raw)] });
    }
  }
  return sections;
}

function toLeaf(item: AntItem): NavLeaf {
  return {
    key: String(item.key),
    label: typeof item.label === 'string' ? item.label : String(item.key),
    icon: item.icon,
    onClick: item.onClick,
  };
}

export interface TabbarItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ICON = { className: 'h-5 w-5', 'aria-hidden': true } as const;

/**
 * Raccourcis de la tabbar mobile (§7) : 4 destinations fréquentes par rôle,
 * toutes reliées à des routes réelles existantes. Le 5ᵉ bouton « Menu » ouvre
 * le tiroir de navigation complet (géré par l'AppShell).
 */
export function getTabbarItems(role?: string | null): TabbarItem[] {
  const normalizedRole = String(role).toUpperCase();
  if (normalizedRole === 'STUDENT') {
    return [
      { label: 'Accueil', icon: <Home {...ICON} />, path: '/student' },
      { label: 'Notes', icon: <PenSquare {...ICON} />, path: '/student/grades' },
      { label: 'Planning', icon: <CalendarClock {...ICON} />, path: '/student/timetable' },
      { label: 'Bulletins', icon: <FileText {...ICON} />, path: '/student/bulletins' },
    ];
  }
  if (normalizedRole === 'PARENT') {
    return [
      { label: 'Accueil', icon: <Home {...ICON} />, path: '/parent' },
      { label: 'Notes', icon: <PenSquare {...ICON} />, path: '/parent/grades' },
      { label: 'Présences', icon: <ClipboardCheck {...ICON} />, path: '/parent/attendance' },
      { label: 'Bulletins', icon: <FileText {...ICON} />, path: '/parent/bulletins' },
    ];
  }
  if (normalizedRole === 'TEACHER') {
    return [
      { label: 'Accueil', icon: <LayoutDashboard {...ICON} />, path: '/dashboard' },
      { label: 'Présence', icon: <ClipboardCheck {...ICON} />, path: '/teacher/attendance' },
      { label: 'Notes', icon: <BookOpen {...ICON} />, path: '/evaluations/grades' },
      { label: 'Planning', icon: <CalendarClock {...ICON} />, path: '/teacher/my-timetable' },
    ];
  }
  return [
    { label: 'Accueil', icon: <LayoutDashboard {...ICON} />, path: '/dashboard' },
    { label: 'Élèves', icon: <Users {...ICON} />, path: '/people/students' },
    { label: 'Planning', icon: <CalendarClock {...ICON} />, path: '/academic/timetable' },
    { label: 'Inscriptions', icon: <FilePlus {...ICON} />, path: '/academic/inscriptions' },
  ];
}

export const MenuTabIcon = MenuIcon;
