/**
 * Chargement des variables d'environnement.
 *
 * ⚠️ DOIT être le tout premier import de chaque point d'entrée, avant
 * `@school/config` (et donc avant tout module qui l'importe, même
 * indirectement : token.service, settings.service, attendance-policy…).
 *
 * Pourquoi : `@school/config` lit `process.env` **au chargement du module**, et
 * les imports ES sont évalués avant le corps du module. Appeler `dotenv.config()`
 * dans le corps de index.ts arrivait donc trop tard — le package était déjà figé
 * sur ses valeurs par défaut codées en dur, et une variable définie uniquement
 * dans `.env` n'était jamais lue (le défaut masquait silencieusement le
 * problème). Isoler le chargement dans un import à effet de bord est le seul
 * moyen fiable de le faire arriver en premier.
 *
 * Ne rien importer d'applicatif ici : ce module doit rester sans dépendance sur
 * le reste du code, sinon on réintroduit le problème qu'il résout.
 */
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Emplacements candidats, du plus spécifique au plus général. Les deux premiers
// dépendent du cwd (racine, ou apps/api quand on passe par `pnpm --filter api`).
// Le dernier est ancré sur l'emplacement du fichier : il fonctionne quel que
// soit le cwd — utile pour les scripts `tsx src/scripts/*.ts`. Il résout vers la
// racine du monorepo aussi bien depuis `src/` (tsx) que depuis `dist/` (node).
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

let loadedFrom: string | null = null;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedFrom = envPath;
    break;
  }
}

if (loadedFrom) {
  console.log(`📄 Loaded .env from: ${loadedFrom}`);
} else {
  // Repli sur le comportement par défaut de dotenv (cherche ./.env).
  dotenv.config();
  console.log('⚠️  Using default dotenv.config() - .env file may not be loaded correctly');
}

/** Chemin du `.env` effectivement chargé, ou null si aucun n'a été trouvé. */
export const envFile = loadedFrom;
