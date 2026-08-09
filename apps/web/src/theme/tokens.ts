import { theme as antdTheme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

type SemanticTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
};

const hsl = (v: string) => `hsl(${v})`;

export const darkTokens: SemanticTokens = {
  background: '220 13% 18%',
  foreground: '210 20% 98%',
  card: '220 13% 16%',
  cardForeground: '210 20% 98%',
  popover: '220 13% 14%',
  popoverForeground: '210 20% 98%',
  primary: '262 83% 58%',
  primaryForeground: '210 20% 98%',
  secondary: '220 13% 22%',
  secondaryForeground: '210 20% 98%',
  muted: '220 13% 20%',
  mutedForeground: '215 20% 65%',
  accent: '262 83% 58%',
  accentForeground: '210 20% 98%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 20% 98%',
  border: '220 13% 25%',
  input: '220 13% 20%',
  ring: '262 83% 58%',
};

export const lightTokens: SemanticTokens = {
  background: '240 20% 99%',
  foreground: '222 47% 11%',
  card: '0 0% 100%',
  cardForeground: '222 47% 11%',
  popover: '0 0% 100%',
  popoverForeground: '222 47% 11%',
  primary: '262 83% 52%',
  primaryForeground: '0 0% 100%',
  secondary: '240 5% 96%',
  secondaryForeground: '222 47% 11%',
  muted: '240 5% 96%',
  mutedForeground: '215 16% 47%',
  accent: '262 83% 52%',
  accentForeground: '0 0% 100%',
  destructive: '0 72% 51%',
  destructiveForeground: '0 0% 100%',
  border: '220 13% 91%',
  input: '220 13% 91%',
  ring: '262 83% 52%',
};

/**
 * Accent de rôle du design system « Encre & Craie » (§11 / §12.2).
 * Admin = Bleu-Encre (ink-600), Enseignant = Vert-Tableau (green-600).
 * Les rôles hors périmètre (comptable/élève/parent) retombent sur l'accent Admin.
 */
export function getRoleAccent(role?: string | null): string {
  return String(role).toUpperCase() === 'TEACHER' ? '#217A54' : '#34478F';
}

export function getAntdTheme(mode: ThemeMode, role?: string | null): ThemeConfig {
  const t = mode === 'dark' ? darkTokens : lightTokens;

  return {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      // §12.2 — colorPrimary dynamique par rôle (design system)
      colorPrimary: getRoleAccent(role),
      // Sémantiques : valeurs -600/-500 des échelles §3.4 (alignées sur le prototype)
      colorSuccess: '#0E8B5E',
      colorWarning: '#E8A33D',
      colorError: '#B92C3C',
      colorInfo: '#3C82C4',
      borderRadius: 14,
      fontFamily: "'Inter', sans-serif",
      // Surfaces conservées telles quelles pour ne pas déplacer les écrans existants
      colorBgBase: hsl(t.background),
      colorBgContainer: hsl(t.card),
      colorBgElevated: hsl(t.popover),
      colorText: hsl(t.foreground),
      colorTextSecondary: hsl(t.mutedForeground),
      colorBorder: hsl(t.border),
      // Les popups Ant Design (Select/TimePicker/DatePicker/Dropdown) sont
      // portées sur document.body avec un z-index par défaut (~1000) plus bas
      // que nos modales DS (.ds-modal-overlay = 1210) : sans ceci, tout menu
      // déroulant ouvert depuis une modale DS apparaît caché derrière elle.
      zIndexPopupBase: 1250,
    },
    components: {
      Card: { colorBgContainer: 'transparent', boxShadowTertiary: 'none' },
      Table: { colorBgContainer: 'transparent', headerBg: 'transparent' },
      Modal: { contentBg: hsl(t.card) },
      Select: { colorBgContainer: hsl(t.card), colorBorder: hsl(t.border) },
    },
  };
}
