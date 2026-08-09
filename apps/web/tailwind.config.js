/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // === Design System « Encre & Craie » (§3 / §12.1) ===
        // Palettes à valeurs fixes (identiques clair/sombre sauf teintes -50,
        // recalculées via data-theme dans index.css). Voir docs/design-system-horizonecole.md
        ink: {
          50: '#EEF1FA', 100: '#DCE3F5', 200: '#B7C4E8', 300: '#8FA0D8',
          400: '#647DC5', 500: '#4A5FA8', 600: '#34478F', 700: '#293770',
          800: '#202B57', 900: '#171F3F',
        },
        green: {
          50: '#EAF5F0', 100: '#CDE8DC', 300: '#7FC1A3', 400: '#4FAE85',
          500: '#2F9468', 600: '#217A54', 700: '#1A6144', 900: '#0F3B2A',
        },
        amber: {
          50: '#FDF3E4', 100: '#FBE4C0', 300: '#F0BE72', 500: '#E8A33D',
          600: '#CC8722', 700: '#A66C1B',
        },
        danger: {
          50: '#FBEAEC', 500: '#D93B4C', 600: '#B92C3C', 700: '#8F1F2C',
        },
        // « role-accent » — accent dynamique par rôle, piloté par data-role.
        'role-accent': {
          DEFAULT: 'var(--role-accent)',
          soft: 'var(--role-accent-soft)',
          strong: 'var(--role-accent-700)',
        },
        // Surfaces / texte neutres, pilotés par data-theme (voir index.css).
        surface: {
          page: 'var(--bg-page)',
          DEFAULT: 'var(--bg-elevated)',
          subtle: 'var(--bg-subtle)',
        },
        ds: {
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-tertiary': 'var(--text-tertiary)',
          page: 'var(--bg-page)',
          elevated: 'var(--bg-elevated)',
          subtle: 'var(--bg-subtle)',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50: 'rgb(var(--role-primary) / 0.05)',
          100: 'rgb(var(--role-primary) / 0.1)',
          200: 'rgb(var(--role-primary) / 0.2)',
          300: 'rgb(var(--role-primary) / 0.4)',
          400: 'rgb(var(--role-primary) / 0.6)',
          500: 'rgb(var(--role-primary))', // Dynamic role-based color
          600: 'rgb(var(--role-primary) / 0.9)',
          700: 'rgb(var(--role-primary) / 0.8)',
          800: 'rgb(var(--role-primary) / 0.7)',
          900: 'rgb(var(--role-primary) / 0.6)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          50: '#fef4f0',
          100: '#fde4d6',
          200: '#fbc9ad',
          300: '#f9a87e',
          400: '#f7874f',
          500: '#E96702',
          600: '#d15a02',
          700: '#b94d01',
          800: '#a14001',
          900: '#893301',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // École LE SOUVERAIN DE LARABIA - Couleurs officielles
        // Couleurs additionnelles pour le système
        success: {
          50: '#E4F8F0', 500: '#16A672', 600: '#0E8B5E', 700: '#0B6E4A',
        },
        warning: {
          500: '#E96702',
          600: '#d15a02',
        },
        error: {
          500: '#dc2626',
          600: '#b91c1c',
        },
        info: {
          50: '#E9F2FB', 500: '#3C82C4', 600: '#2C689F', 700: '#204F79',
        },
      },
      borderRadius: {
        // §12.1 — échelle du design system (merge sur les défauts Tailwind).
        sm: '8px',
        md: '14px',
        lg: '20px',
        full: '999px',
      },
      fontFamily: {
        // §12.1 — display (titres), body (courant), mono (données/notes).
        display: ['"Space Grotesk"', 'Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'SFMono-Regular', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // §12.1 — élévations subtiles « Papier » (recalculées en sombre via CSS vars).
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.16,1,.3,1)',
        'in-out': 'cubic-bezier(.4,0,.2,1)',
      },
    },
  },
  plugins: [],
}
