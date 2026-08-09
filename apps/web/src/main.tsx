import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
// Design system « Encre & Craie » : titres (display) + données/notes (mono)
// Sous-ensemble latin (app FR) — cohérent entre les deux paquets.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import App from './App.tsx'
import AuthProvider from './components/AuthProvider.tsx'

// Locale FR pour tout l'app (dates dayjs : « mardi 14 juillet 2026 »).
dayjs.locale('fr')
import { ThemeProvider } from './components/theme/ThemeProvider.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import faviconImage from './assets/images/Image.png?url'
import './index.css'

// Configuration du favicon dynamiquement
const setFavicon = (url: string) => {
  // Mettre à jour ou créer le lien favicon
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    document.getElementsByTagName('head')[0].appendChild(link)
  }
  link.href = url
}

// Définir le favicon dès que possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setFavicon(faviconImage))
} else {
  setFavicon(faviconImage)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // Consider data fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Keep data in cache for 5 minutes (renamed from cacheTime in v5)
      refetchOnMount: 'always', // Refetch when component mounts if data is stale
      refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary requests
      retry: 1,
    },
  },
})

// Supprimer les erreurs DOM non critiques des scripts externes
const originalError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  // Filtrer les erreurs connues des scripts externes (osano, Sentry, etc.)
  if (
    typeof message === 'string' &&
    (message.includes('insertBefore') ||
     message.includes('osano') ||
     message.includes('NotFoundError'))
  ) {
    console.warn('Non-critical DOM error suppressed:', message);
    return true; // Supprime l'erreur de la console
  }
  // Laisser les autres erreurs être gérées normalement
  if (originalError) {
    return originalError(message, source, lineno, colno, error);
  }
  return false;
};

// Gérer les erreurs de promesses non capturées
const originalUnhandledRejection = window.onunhandledrejection;
window.onunhandledrejection = (event) => {
  if (
    event.reason?.message?.includes('insertBefore') ||
    event.reason?.message?.includes('osano') ||
    event.reason?.name === 'NotFoundError'
  ) {
    console.warn('Non-critical promise rejection suppressed:', event.reason);
    event.preventDefault(); // Empêche l'erreur d'apparaître dans la console
    return;
  }
  // Laisser les autres erreurs être gérées normalement
  if (originalUnhandledRejection) {
    originalUnhandledRejection.call(window, event);
  }
};

// S'assurer que le DOM est prêt avant de monter React
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Désactiver StrictMode en production pour éviter les conflits avec les scripts externes
const isDevelopment = import.meta.env.DEV;
const AppWrapper = (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(rootElement).render(
  isDevelopment ? <React.StrictMode>{AppWrapper}</React.StrictMode> : AppWrapper
)
