import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { withTransitionsSuppressed } from '../utils';

export type ThemeMode = 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';

export function applyThemeClass(resolved: ResolvedThemeMode) {
  withTransitionsSuppressed(() => {
    // `.dark` : pilote Tailwind (darkMode:'class') + le thème Ant Design existant.
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    // `data-theme` : pilote les tokens du design system « Encre & Craie » (index.css).
    document.documentElement.setAttribute('data-theme', resolved);
  });
}

interface ThemeState {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light',
      resolvedMode: 'light',
      setMode: (mode) => {
        applyThemeClass(mode);
        set({ mode, resolvedMode: mode });
      },
    }),
    {
      name: 'horizonecole-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Legacy persisted value from the removed "system" mode
          if ((state.mode as string) !== 'light' && (state.mode as string) !== 'dark') {
            state.mode = 'light';
          }
          applyThemeClass(state.mode);
          state.resolvedMode = state.mode;
        }
      },
    },
  ),
);
