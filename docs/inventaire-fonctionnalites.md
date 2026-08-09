# Inventaire fonctionnel — Système de gestion scolaire « HorizonEcole »

> Document produit par lecture directe du code source (`apps/`, `packages/`). Aucun comportement n'a été supposé : lorsqu'un point est ambigu ou paraît incohérent dans le code, il est **signalé explicitement** plutôt que deviné. Les noms de fichiers, routes, services et composants sont conservés tels quels.

> **Périmètre de ce document.** L'inventaire couvre le **périmètre pédagogique et administratif** (élèves, parents, enseignants, scolarité, évaluations, présences, discipline, emploi du temps, documents, paramètres). Les modules **financiers et de paie** sont **hors périmètre** à la demande et ne sont pas décrits ici.

---

## 1. Préambule — stack détectée et type d'application

**Type d'application** : application **web full-stack** de gestion scolaire (back-office administratif + espace enseignant). Il ne s'agit ni d'une CLI, ni d'un worker, ni d'une librairie.

**Stack réellement observée dans le code :**

| Couche | Technologie (constatée dans les `package.json` / imports) |
|--------|-----------------------------------------------------------|
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`), orchestration `concurrently` — `package.json` racine |
| Backend | Node.js + **Express 4** + TypeScript (`apps/api`), point d'entrée `apps/api/src/index.ts` |
| Frontend | **React 18** + **Vite 5** + **Ant Design 5** + Tailwind, point d'entrée `apps/web/src/main.tsx`, routage `apps/web/src/App.tsx` |
| État/données client | Zustand (`lib/store.ts`), TanStack React Query, Axios (`lib/api.ts`) |
| Base de données | **PostgreSQL** via **Prisma 5** (`packages/database`), client exporté `prisma` |
| Validation | **Zod** (schémas dans les services et middleware `validate`) |
| Auth | **JWT** (access token) + refresh token stocké en base, **bcrypt** |
| Config partagée | `packages/config` (`@school/config`) |
| Types partagés | `packages/types` (`@school/types`) |
| Docs API | Swagger (`/api-docs`) |
| Génération docs | PDFKit, Puppeteer, docxtemplater, mammoth (côté API) |

**Unité fonctionnelle retenue pour l'inventaire.**
L'application expose deux surfaces fonctionnelles : des **pages** côté React et des **endpoints REST** côté Express. La logique métier réelle (accès base, règles de calcul, autorisations) réside **dans l'API**. L'unité fonctionnelle pertinente à inventorier est donc **le routeur REST Express** (`apps/api/src/routes/*.ts`), regroupant chacun un ensemble d'endpoints d'une même ressource. Les **pages React** sont inventoriées en annexe (§6) car elles ne sont que des consommatrices de ces endpoints.

- **31 routeurs** documentés ci-dessous (périmètre pédagogique & administratif). Le code contient d'autres routeurs (finances, paie) montés dans `apps/api/src/index.ts` mais **exclus du périmètre**.
- **Services** métier (`apps/api/src/services/*.ts`) appelés par ces routeurs.
- **Modèles** Prisma (`packages/database/prisma/schema.prisma`).
- **Pages** React (`apps/web/src/pages/*.tsx`).

---

## 2. Tableau de vue d'ensemble des routeurs (périmètre couvert)

Préfixe commun : `/api` (montage dans `apps/api/src/index.ts`). Un middleware de compatibilité y redirige aussi les requêtes sans préfixe `/api`. Les routes d'authentification sont en plus montées sur `/auth`.

Légende « Accès » : garde d'autorisation telle qu'écrite dans le code. ⚠️ = incohérence de rôle réelle (voir §3.2).

| # | Routeur (fichier) | Montée sur | Rôle fonctionnel | Accès / contexte |
|---|-------------------|-----------|------------------|------------------|
| 1 | `auth.ts` | `/api/auth`, `/auth` | Connexion, refresh, profil, mot de passe | `login`/`refresh` publics ; `me`/`logout`/`change-password` authentifiés ; `register` = ADMIN |
| 2 | `users.ts` | `/api/users` | Gestion des comptes utilisateurs | `authenticate` + `authorize('ADMIN')` |
| 3 | `students.ts` | `/api/students` | Élèves (variante « legacy ») | authentifié ; écritures `ADMIN`/`SECRETARY` ⚠️, suppression `ADMIN` |
| 4 | `parents.ts` | `/api/parents` | Parents (legacy) | authentifié ; écritures `ADMIN`/`SECRETARY` ⚠️ |
| 5 | `student-parents.ts` | `/api/student-parents` | Lien élève↔parent | `ADMIN`/`SECRETARY` ⚠️ |
| 6 | `schoolStudents.ts` | `/api/school-students` | Élèves (module courant) | écritures `ADMIN`/`TEACHER` ; suppression `ADMIN` |
| 7 | `schoolParents.ts` | `/api/school-parents` | Parents (module courant) | écritures `ADMIN`/`TEACHER` ; suppression `ADMIN` |
| 8 | `teachers.ts` | `/api/teachers` | Enseignants + endpoints `/me` | authentifié ; espace enseignant via `/me/*` |
| 9 | `academicYears.ts` | `/api/academic-years` | Années académiques | authentifié (écritures via service) |
| 10 | `schoolClasses.ts` | `/api/school-classes` | Classes scolaires | authentifié |
| 11 | `classes.ts` | `/api/classes` | Classes (legacy) | authentifié |
| 12 | `schoolSubjects.ts` | `/api/school-subjects` | Matières | authentifié |
| 13 | `subjects.ts` | `/api/subjects` | Matières (legacy) | authentifié |
| 14 | `classSubjects.ts` | `/api/class-subjects` | Association classe↔matière | authentifié |
| 15 | `coefficients.ts` | `/api/coefficients` | Coefficients matière/classe | authentifié |
| 16 | `subjectAssignments.ts` | `/api/subject-assignments` | Affectation matières aux classes | authentifié |
| 17 | `classAssignments.ts` | `/api/class-assignments` | Affectations enseignant↔classe | authentifié |
| 18 | `classMainTeachers.ts` | `/api/class-main-teachers` | Professeurs principaux | authentifié |
| 19 | `classrooms.ts` | `/api/classrooms` | Salles de classe | **aucune authentification** ⚠️ |
| 20 | `inscriptions.ts` | `/api/inscriptions` | Inscriptions | écritures `ADMIN` |
| 21 | `evaluationTypes.ts` | `/api/evaluation-types` | Types d'évaluation | authentifié |
| 22 | `grades.ts` | `/api/grades` | Notes + bulletins/moyennes PDF | authentifié |
| 23 | `semesters.ts` | `/api/semesters` | Trimestres/semestres | authentifié |
| 24 | `attendances.ts` | `/api/attendances` | Présences (résumés) | saisie `ADMIN`/`ENSEIGNANT` ⚠️ ; suppression `ADMIN` |
| 25 | `studentAbsences.ts` | `/api/student-absences` | Absences élèves | `TEACHER`/`ADMIN` en écriture |
| 26 | `discipline.ts` | `/api/discipline` | Incidents & sanctions | `ADMIN`/`ENSEIGNANT` ⚠️ selon action |
| 27 | `timetables.ts` | `/api/timetables` | Créneaux d'emploi du temps | **aucune authentification** ⚠️ |
| 28 | `schedules.ts` | `/api/schedules` | Emplois du temps + exceptions | écritures `ADMIN` ; exceptions `ADMIN`/`ENSEIGNANT` ⚠️ |
| 29 | `documents.ts` | `/api/documents` | Documents joints (upload) | authentifié ; suppression `ADMIN` |
| 30 | `settings.ts` | `/api/settings` | Paramètres établissement | lecture authentifiée ; MAJ `ADMIN` |
| 31 | `dashboard.ts` | `/api/dashboard` | Statistiques d'accueil | authentifié |

En plus des routeurs : `GET /` (infos API), `GET /api/health` (ping base via `prisma.$queryRaw`), `GET /api-docs` (Swagger UI), `GET /api-docs.json`, et service statique `/uploads`.

---

## 3. Mécanismes transverses communs

### 3.1 Chaîne de middleware globale (`apps/api/src/index.ts`)

Appliquée à toutes les requêtes, dans l'ordre :

1. `helmet()` — en-têtes de sécurité HTTP.
2. `cors(...)` — liste blanche d'origines (`localhost:5173/3000/5174`, `ecole-le-souverain-web.vercel.app`, `process.env.CORS_ORIGIN`) ; **en `development`, toutes les origines sont acceptées**.
3. `rateLimit(config.rateLimit)` — **100 requêtes / 15 min par IP** (`packages/config`).
4. `morgan('combined')` — journalisation HTTP.
5. `cookieParser()` — lecture des cookies (refresh token).
6. `express.json({ limit: '10mb' })` + `urlencoded`.
7. Middleware de **réécriture d'URL** : toute route sans préfixe `/api` (hors `/`, `/auth`, `/api-docs`) est réécrite en `/api/...`.

En fin de pile : `notFound` (404 JSON) puis `errorHandler`.

### 3.2 Authentification & autorisation

- **`authenticate`** (`middleware/auth.ts`) : lit l'en-tête `Authorization: Bearer <token>`, vérifie via `TokenService.verifyAccessToken`, puis **recharge l'utilisateur** en base (`prisma.user.findUnique`) et rejette si absent ou `isActive === false`. Renseigne `req.user = { id, email, role }`.
- **`optionalAuthenticate`** : variante non bloquante (poursuit sans `req.user` si pas de token).
- **`authorize(...roles)`** (déprécié) et **`requireRole(...roles)`** (`middleware/rbac.ts`) : comparent `req.user.role` à une liste de rôles autorisés (403 sinon). Helpers : `canAccessOwnResourceOrAdmin`, `isAdmin`, `isTeacher`, etc.
- **`TokenService`** (`services/token.service.ts`) :
  - Access token JWT signé avec `config.jwt.secret`, **expiration codée en dur à `1h`** (⚠️ ne suit pas `config.jwt.expiresIn = '7d'`).
  - Refresh token = chaîne aléatoire (`crypto.randomBytes(64)`) **persistée dans la table `RefreshToken`** (expiration 7 jours), transportée par un JWT contenant `tokenId`. Vérification côté base + suppression si expiré. Révocation individuelle ou globale (`revokeAllUserTokens`).
  - Le refresh token est posé en **cookie httpOnly** (`sameSite: strict`, `secure` en production) par `POST /api/auth/login`.

> ⚠️ **Incohérence de rôles (signalée sans la deviner)** : l'énumération `UserRole` de Prisma (`schema.prisma`) ne contient que **`ADMIN`, `TEACHER`, `ACCOUNTANT`, `STUDENT`, `PARENT`**. Or plusieurs routeurs gardent leurs endpoints avec des libellés **français** absents de l'énum : `'ENSEIGNANT'` (`attendances`, `discipline`, `schedules`) et `'SECRETARY'` (`students`, `parents`, `student-parents`). Comme `req.user.role` vaut toujours une valeur de l'énum anglaise, ces gardes **ne peuvent jamais correspondre** à ces libellés : en pratique seuls les `ADMIN` (présents dans les mêmes listes) franchissent ces contrôles. Cette divergence est présente telle quelle dans le code ; elle est reportée ici sans interprétation supplémentaire.

### 3.3 Validation des entrées

- **`validate(schema)`** / alias `validateRequest` (`middleware/validate.ts`) : `schema.safeParse({ body, query, params })` avec **Zod** ; répond `400 { error, details }` en cas d'échec, et réinjecte les valeurs transformées dans `req`.
- Les schémas Zod sont définis soit dans le routeur (ex. `auth.ts`), soit **exportés par le service** correspondant (ex. `createTeacherSchema` depuis `teacher.service.ts`).

### 3.4 Gestion d'erreurs (`middleware/errorHandler.ts`)

Traduction centralisée en réponses HTTP :

- Prisma `P2002` → `409 Duplicate entry` ; `P2025` → `404 Record not found`.
- `ValidationError` → 400 ; `JsonWebTokenError` → 401 ; `TokenExpiredError` → 401.
- Défaut → `error.status || 500` (la `stack` n'est renvoyée qu'en `development`).

**Enveloppe de réponse commune** observée dans les routeurs :
- Succès : `{ success: true, data, message? }` (ou objet direct pour certains routeurs legacy).
- Erreur : `{ success: false, error, message? }` ou `{ error, details }`.

### 3.5 Journal d'audit (`services/audit.service.ts` + `middleware/auditTracking.ts`)

- `AuditService` enregistre connexions/échecs de connexion, déconnexions, changements de mot de passe, créations d'utilisateur (table `audit_logs`).
- `middleware/auditTracking.ts` propose `trackCreate/Update/Delete/Read` qui interceptent `res.json` pour journaliser l'action, l'IP (`x-forwarded-for`) et le `user-agent` **après** la réponse (via `setImmediate`).

### 3.6 Upload de fichiers (`middleware/upload.ts`)

- **multer** en stockage disque sous `uploads/{avatars,documents,students,parents,justificatifs}`.
- Trois configurations : `avatarUpload` (images, 2 Mo, 1 fichier), `documentUpload` (PDF/Office/images, 10 Mo, 5 fichiers), `justificatifUpload` (PDF/images, 10 Mo, 1 fichier).
- `handleUploadError` normalise les erreurs multer en `400`. Fichiers servis statiquement via `/uploads`.

### 3.7 Génération de documents (`services/pdf.service.ts`)

`PDFService` produit des documents PDF (PDFKit / Puppeteer / docxtemplater). Dans le périmètre couvert, il est utilisé par le routeur **`grades`** (bulletins de notes et moyennes). `PDFService.ensureUploadsDir()` est appelé au démarrage.

### 3.8 Configuration (`packages/config/src/index.ts`)

Objet `config` centralisant : `database.url`, `server.{port,nodeEnv}`, `jwt.{secret,expiresIn,refreshExpiresIn}`, `cors`, `rateLimit`, `bcrypt.saltRounds` (**12**), `pagination`, `upload`, `email` (prévu, non branché), `school` (identité de l'établissement), `academic`. `validateConfig()` exige `DATABASE_URL` et `JWT_SECRET`.

> ⚠️ **À signaler** : le code contient des **valeurs par défaut sensibles en dur** — une URL PostgreSQL complète avec identifiants (Aiven) et un secret JWT `'secret-ultra-securise'`. Ces valeurs ne sont utilisées que si les variables d'environnement sont absentes, mais elles sont présentes en clair dans le dépôt.

### 3.9 Accès aux données

- Client Prisma unique exporté par `@school/database` (`prisma`), importé par les services **et** par certains routeurs qui interrogent la base directement (voir §5, patron B). Arrêt propre `prisma.$disconnect()` sur `SIGTERM`/`SIGINT`.

### 3.10 Client frontend (`apps/web/src/lib/api.ts`)

- Instance Axios (`baseURL = VITE_API_URL || http://localhost:4001/api`).
- **Intercepteur requête** : ajoute `Authorization: Bearer <token>` depuis `localStorage`, sauf sur `/auth/login|register|refresh`.
- **Intercepteur réponse** : sur `401` (hors page login), purge `localStorage` et redirige vers `/login`.
- Le routage React (`App.tsx`) est **protégé globalement** par la présence d'un token (`isAuthenticated` + `localStorage`), sans distinction de rôle côté front.

---

## 4. Patron commun des routeurs

La grande majorité des routeurs suit un même schéma ; les sections du §5 ne décrivent que les **écarts** par rapport à lui.

**Patron A — routeur adossé à un service** (cas le plus fréquent)
- **Structure** : `const router = Router()` → endpoints REST → `export default router`.
- **Entrées** : paramètres d'URL (`:id`, filtres `query`), corps JSON validé par un schéma **Zod** (via `validate(...)` ou `safeParse` dans le service).
- **Traitement** : chaque handler délègue à une **classe de service** (`XxxService.method(...)`) qui contient la logique métier et les appels **Prisma**.
- **Sorties** : enveloppe `{ success, data, message }` en cas de succès ; erreurs via `throw`/réponse directe puis `errorHandler`.
- **Sécurité** : `authenticate` en tête, puis éventuellement `requireRole(...)`/`authorize(...)`.

**Patron B — routeur « direct Prisma »** (pas de service dédié)
Certains routeurs interrogent `prisma` directement dans le handler, sans classe de service : `users.ts`, `dashboard.ts`, `classes.ts`, `subjects.ts`, `schoolClasses.ts`, `schoolSubjects.ts`, `classSubjects.ts`, `schoolStudents.ts`, `schoolParents.ts`. Ils suivent sinon la même enveloppe de réponse et les mêmes gardes.

**Patron C — routeur de génération documentaire**
Endpoints se terminant par `/pdf` ou `/bulletin` (ici `grades`) : délèguent à `PDFService` et renvoient un flux/fichier plutôt que du JSON.

---

## 5. Détail par routeur (unités fonctionnelles)

> Format : **Fichier source** · **Entrées/Sorties** (endpoints + gardes) · **Fonctionnement** (service et dépendances réelles). Sauf mention contraire, toutes les routes passent par `authenticate` et renvoient l'enveloppe commune (§3.4). Seuls les écarts au patron (§4) sont détaillés.

### Domaine — Authentification & comptes

#### `auth.ts` — Authentification
- **Source** : `apps/api/src/routes/auth.ts` (monté sur `/api/auth` et `/auth`).
- **Entrées/Sorties** :
  | Méthode | Chemin | Garde | Entrée | Sortie |
  |---------|--------|-------|--------|--------|
  | POST | `/login` | public | `{ email, password }` (Zod) | `{ data: { user, accessToken } }` + cookie `refreshToken` |
  | POST | `/register` | `authenticate` + `ADMIN` | `{ email, password, firstName, lastName, role, phone? }` | utilisateur créé (201) |
  | POST | `/refresh` | cookie | cookie `refreshToken` | nouveau `accessToken` |
  | POST | `/logout` | `authenticate` | cookie | révoque tokens, efface cookie |
  | GET | `/me` | `authenticate` | — | profil courant |
  | POST | `/change-password` | `authenticate` | `{ currentPassword, newPassword }` | 200 + révocation des refresh tokens |
- **Fonctionnement** : `bcrypt.compare`/`hash` (coût `config.bcrypt.saltRounds`), `TokenService` (access/refresh), `AuditService` (login réussi/échoué, logout, changement de mot de passe), `prisma.user`. Les échecs de login sont journalisés sans bloquer.

#### `users.ts` — Utilisateurs *(patron B)*
- **Source** : `routes/users.ts`. **Accès** : `authenticate` + `authorize('ADMIN')`.
- **E/S** : `GET /` (liste paginée, `getUsersSchema`), `PUT /:id` (`updateUserSchema`).
- **Fonctionnement** : accès **direct `prisma.user`**, validation Zod locale. Pas de service dédié.

### Domaine — Personnes (élèves, parents, enseignants)

#### `students.ts` — Élèves (legacy)
- **Source** : `routes/students.ts`. Service : `StudentService` (`services/student.service.ts`).
- **E/S** : `GET /` (filtres `getStudentsSchema`), `GET /:id`, `POST /` & `PUT /:id` (`ADMIN`/`SECRETARY` ⚠️), `DELETE /:id` (`ADMIN`), `POST /:id/avatar` (upload avatar), `POST /:id/documents` (upload), `POST /:id/parents` & `DELETE /:id/parents/:parentId`, `GET /stats/overview`.
- **Fonctionnement** : `StudentService` + Prisma ; uploads via `middleware/upload.ts`. Coexiste avec `schoolStudents.ts` (module courant) — doublon fonctionnel à noter.

#### `schoolStudents.ts` — Élèves (module courant) *(patron B)*
- **Source** : `routes/schoolStudents.ts`. **Accès** : écritures `authorize('ADMIN','TEACHER')`, suppression `ADMIN`.
- **E/S** : `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/parents`, `DELETE /:id/parents/:parentId`, `GET /stats/overview`.
- **Fonctionnement** : **`prisma` en direct** (modèles `Student`, `student_parents`). C'est ce routeur qu'utilise la page « Gestion des personnes » du front.

#### `parents.ts` / `schoolParents.ts` — Parents
- **Sources** : `routes/parents.ts` (service `ParentService`, gardes `ADMIN`/`SECRETARY` ⚠️) et `routes/schoolParents.ts` (patron B, `prisma` direct, gardes `ADMIN`/`TEACHER`). Deux implémentations coexistantes.
- **E/S** : CRUD standard + `GET /stats/overview` ; `parents.ts` ajoute `POST /:id/avatar` et `GET /search/:query`.
- **Fonctionnement** : Prisma (`parents`), avatars via multer côté `parents.ts`.

#### `student-parents.ts` — Liaison élève↔parent
- **Source** : `routes/student-parents.ts`. Service : `StudentService`.
- **E/S** : `POST /link` (`linkStudentParentSchema`), `DELETE /unlink/:studentId/:parentId`, garde `ADMIN`/`SECRETARY` ⚠️.
- **Fonctionnement** : crée/supprime les lignes `student_parents` via `StudentService`.

#### `teachers.ts` — Enseignants (+ espace enseignant)
- **Source** : `routes/teachers.ts`. Service : `TeacherService` (`createTeacherSchema`, `updateTeacherSchema`).
- **E/S** :
  | Méthode | Chemin | Objet |
  |---------|--------|-------|
  | GET | `/` | liste des enseignants |
  | GET | `/me/info` | fiche de l'enseignant connecté |
  | GET | `/me/assignments` | ses affectations |
  | GET | `/me/timetable` | son emploi du temps |
  | GET | `/:id`, `/:id/assignments`, `/:id/timetable` | consultation par id |
  | POST | `/` | création |
  | PATCH/DELETE | `/:id` | mise à jour / suppression |
  | POST | `/:id/create-account` | crée un `User` rôle `TEACHER` lié à l'enseignant |
- **Fonctionnement** : `TeacherService` + Prisma (`teachers`, `teacher_class_assignments`, `class_timetables`, `User`). Les endpoints `/me/*` s'appuient sur `req.user.id` (self-service enseignant).

### Domaine — Scolarité & pédagogie

#### `academicYears.ts` — Années académiques
- **Source** : `routes/academicYears.ts`. Service : `AcademicYearService`.
- **E/S** : `GET /`, `GET /current`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/set-current`, `DELETE /:id`.
- **Fonctionnement** : `AcademicYearService` + Prisma (`AcademicYear`). `set-current` bascule l'année active.

#### `schoolClasses.ts` / `classes.ts` — Classes *(patron B pour schoolClasses)*
- **Sources** : `routes/schoolClasses.ts` (Prisma direct, modèle `SchoolClass`) et `routes/classes.ts` (legacy, Prisma direct, `createClassSchema`/`updateClassSchema`).
- **E/S** : CRUD classes ; `schoolClasses` = `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma direct. Deux routeurs « classes » coexistent (legacy vs module courant).

#### `schoolSubjects.ts` / `subjects.ts` — Matières *(patron B pour schoolSubjects)*
- **Sources** : `routes/schoolSubjects.ts` (Prisma direct) et `routes/subjects.ts` (legacy, `createSubjectSchema`/`updateSubjectSchema`).
- **E/S** : CRUD matières (`subjects`).

#### `classSubjects.ts` — Classe↔matière *(patron B)*
- **Source** : `routes/classSubjects.ts`. **E/S** : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma direct (modèle `class_subjects`).

#### `coefficients.ts` — Coefficients
- **Source** : `routes/coefficients.ts`. Service : `CoefficientService`.
- **E/S** : `GET /classes`, `GET /subjects`, `GET /class/:classId`, `PATCH /class/:classId/subject/:subjectId`, `POST /class/:classId/batch` (mise à jour en lot).
- **Fonctionnement** : `CoefficientService` + Prisma (coefficients portés par `class_subjects`).

#### `subjectAssignments.ts` — Affectation matières↔classes
- **Source** : `routes/subjectAssignments.ts`. Service : `SubjectAssignmentService`.
- **E/S** : `GET /classes`, `GET /class/:classId`, `POST /class/:classId`.

#### `classAssignments.ts` — Affectation enseignant↔classe
- **Source** : `routes/classAssignments.ts`. Service : `ClassAssignmentService` (`createAssignmentSchema`, `updateAssignmentSchema`).
- **E/S** : `GET /`, `GET /teachers`, `GET /teacher/:teacherId`, `GET /class/:classId`, `POST /`, `PATCH /teacher/:teacherId`, `DELETE /:id`, `DELETE /teacher/:teacherId`.
- **Fonctionnement** : Prisma (`teacher_class_assignments`).

#### `classMainTeachers.ts` — Professeurs principaux
- **Source** : `routes/classMainTeachers.ts`. Service : `ClassMainTeacherService`.
- **E/S** : `GET /`, `GET /:id`, `GET /class/:classId/year/:academicYearId`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma (`class_main_teachers`).

#### `classrooms.ts` — Salles ⚠️
- **Source** : `routes/classrooms.ts`. Service : `ClassroomService` (`createClassroomSchema`, `updateClassroomSchema`).
- **E/S** : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : `ClassroomService` + Prisma (`classrooms`). ⚠️ **Aucun middleware `authenticate` n'est appliqué** : ce routeur est entièrement public en l'état du code.

#### `inscriptions.ts` — Inscriptions
- **Source** : `routes/inscriptions.ts`. Service : `InscriptionService`.
- **E/S** : `GET /`, `GET /statistics`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` (écritures `requireRole('ADMIN')`).
- **Fonctionnement** : `InscriptionService` + Prisma (`inscriptions`). Un script `convert-inscriptions-to-students` existe (`apps/api/src/scripts/`) pour transformer les inscriptions en élèves.

### Domaine — Évaluations

#### `evaluationTypes.ts` — Types d'évaluation
- **Source** : `routes/evaluationTypes.ts`. Service : `EvaluationTypeService` (`create/updateEvaluationTypeSchema`).
- **E/S** : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma (`evaluation_types`).

#### `grades.ts` — Notes, moyennes & bulletins *(patrons A + C)*
- **Source** : `routes/grades.ts`. Services : `GradeService`, `PDFService`.
- **E/S** :
  | Méthode | Chemin | Objet |
  |---------|--------|-------|
  | GET | `/` | notes (filtres) |
  | GET | `/teacher/:teacherId/assignments` | classes/matières de l'enseignant |
  | GET/POST/PATCH/DELETE | `/`, `/:id` | CRUD note |
  | GET | `/complete-averages/pdf` | PDF des moyennes complètes |
  | GET | `/class-grades-by-subject/pdf` | PDF notes par matière |
  | GET | `/student-bulletin/pdf` | bulletin élève PDF |
- **Fonctionnement** : `GradeService` calcule moyennes/coefficients (modèles `grades`, `evaluation_types`, `class_subjects`) ; `PDFService` génère les documents.

#### `semesters.ts` — Trimestres/semestres
- **Source** : `routes/semesters.ts`. Service : `SemesterService`.
- **E/S** : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma (`semesters`, enum `Trimester`).

### Domaine — Présences & discipline

#### `attendances.ts` — Présences ⚠️(rôle)
- **Source** : `routes/attendances.ts`. Service : `AttendanceService` (`batchAttendanceSchema`).
- **E/S** : `GET /`, `GET /stats`, `GET /class/:classId`, `POST /batch` (`ADMIN`/`ENSEIGNANT` ⚠️), `DELETE /:id` (`ADMIN`), `GET /summaries`, `GET /summaries/student/:studentId`.
- **Fonctionnement** : Prisma (`attendances`, `attendance_summaries`).

#### `studentAbsences.ts` — Absences élèves
- **Source** : `routes/studentAbsences.ts`. Service : `StudentAbsenceService`.
- **E/S** : `GET /`, `GET /teacher/:teacherId/classes`, `GET /timetable`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` (écritures `requireRole('TEACHER','ADMIN')`).
- **Fonctionnement** : Prisma (`student_absences`), croise emploi du temps et affectations enseignant.

#### `discipline.ts` — Incidents & sanctions
- **Source** : `routes/discipline.ts`. Service : `DisciplineService` (schémas incident/sanction).
- **E/S** : sous-ressource **incidents** (`GET /incidents`, `/incidents/stats`, `/incidents/:id`, POST/PUT/DELETE) et **sanctions** (`GET /sanctions`, `/sanctions/:id`, POST/PUT, `POST /sanctions/:id/execute`, DELETE). Gardes `ADMIN`/`ENSEIGNANT` ⚠️ selon action.
- **Fonctionnement** : Prisma (`disciplinary_incidents`, enums `IncidentSeverity`, `SanctionType`).

### Domaine — Emploi du temps

#### `timetables.ts` — Créneaux ⚠️
- **Source** : `routes/timetables.ts`. Service : `TimetableService` (`create/updateTimetableSchema`).
- **E/S** : `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- **Fonctionnement** : Prisma (`class_timetables`, enum `DayOfWeek`). ⚠️ **Aucun `authenticate`** appliqué (routeur public).

#### `schedules.ts` — Emplois du temps & exceptions
- **Source** : `routes/schedules.ts`. Services : `ScheduleService`, `ScheduleExceptionService`.
- **E/S** : `GET /`, `GET /class/:classId/timetable`, `GET /teacher/:teacherId/timetable`, CRUD `/:id` (`ADMIN`), sous-ressource `exceptions` (CRUD, `ADMIN`/`ENSEIGNANT` ⚠️).
- **Fonctionnement** : Prisma (`schedules`, `schedule_exceptions`).

### Domaine — Documents, paramètres, tableau de bord

#### `documents.ts` — Documents joints
- **Source** : `routes/documents.ts`. Service : `DocumentService` (`createDocumentSchema`).
- **E/S** : `GET /`, `GET /:id`, `POST /` (`documentUpload.single('file')` + `handleUploadError`), `DELETE /:id` (`ADMIN`).
- **Fonctionnement** : upload multer + Prisma (métadonnées de document, enum `DocumentType`).

#### `settings.ts` — Paramètres établissement
- **Source** : `routes/settings.ts`. Service : `SettingsService` (`schoolSettingsSchema`).
- **E/S** : `GET /school`, `PUT /school` (`ADMIN`), `GET /config` et quelques listes de référence.
- **Fonctionnement** : `SettingsService` ; certaines listes proviennent des enums Prisma / de `@school/config`.

#### `dashboard.ts` — Tableau de bord *(patron B)*
- **Source** : `routes/dashboard.ts`. **E/S** : `GET /stats`, `GET /activities`.
- **Fonctionnement** : agrégations **Prisma directes** (comptages élèves/classes, activités récentes). Pas de service dédié.

---

## 6. Annexe — Pages du frontend (unités d'interface)

> **Important — distinction entre « accessible dans l'interface » et « route encore présente dans le code ».**
> Deux niveaux différents doivent être distingués :
> - le **menu de navigation** réellement affiché à l'utilisateur est défini dans `apps/web/src/lib/navigation/use-app-navigation.tsx` ;
> - la **table de routage** `apps/web/src/App.tsx` contient encore des routes qui **ne sont plus reliées à aucun menu**.

### 6.1 Pages exposées dans le menu — profil **ADMIN**

Menu construit dans `use-app-navigation.tsx` (branche par défaut) :

| Entrée de menu | Route front | Page | Routeur(s) API |
|----------------|-------------|------|----------------|
| Tableau de bord | `/dashboard` | `DashboardPage` | `dashboard` |
| Gestion des Personnes › Élèves | `/people/students` | `StudentsListPage` | `school-students` |
| Gestion des Personnes › Parents | `/people/parents` | `ParentsPage` | `school-parents` / `parents` |
| Gestion des Personnes › Enseignants | `/people/teachers` | `TeachersPage` | `teachers` |
| Année Académique › Années Scolaires | `/academic/years` | `AcademicYearsPage` | `academic-years` |
| Année Académique › Inscriptions | `/academic/inscriptions` | `InscriptionsPage` | `inscriptions` |
| Année Académique › Salles de Classes | `/people/classrooms` | `ClassroomsPage` | `classrooms` |
| Année Académique › Emploi du Temps | `/academic/timetable` | `TimetablePage` | `timetables`, `schedules` |
| Année Académique › Affectations Enseignants | `/academic/class-assignments` | `ClassAssignmentsPage` | `class-assignments` |
| Pédagogie › Classes | `/academic/classes` | `SchoolClassesPage` | `school-classes` |
| Pédagogie › Matières | `/academic/subjects` | `SchoolSubjectsPage` | `school-subjects` |
| Pédagogie › Affectations | `/academic/assignments` | `SubjectAssignmentPage` | `subject-assignments` |
| Pédagogie › Coefficients | `/academic/coefficients` | `CoefficientsPage` | `coefficients` |
| Pédagogie › Moyennes Complètes | `/academic/complete-averages` | `CompleteAveragesPage` | `grades` |
| Pédagogie › Notes par Matière | `/academic/class-grades` | `ClassGradesPage` | `grades` |
| Utilisateurs | `/users` | `UsersPage` | `users` |

### 6.2 Pages exposées dans le menu — profil **TEACHER**

| Entrée de menu | Route front | Page | Routeur(s) API |
|----------------|-------------|------|----------------|
| Tableau de bord | `/dashboard` | `DashboardPage` | `dashboard` |
| Mon Planning › Mes Classes | `/teacher/my-classes` | `TeacherClassesPage` | `teachers` (`/me/*`), `class-assignments` |
| Mon Planning › Mon Emploi du Temps | `/teacher/my-timetable` | `TeacherTimetablePage` | `teachers` (`/me/timetable`) |
| Mon Planning › Liste de Présence | `/teacher/attendance` | `TeacherAttendancePage` | `student-absences`, `attendances` |
| Évaluations › Types d'Évaluation | `/evaluations/types` | `EvaluationTypesPage` | `evaluation-types` |
| Évaluations › Saisie des Notes | `/evaluations/grades` | `GradesPage` | `grades` |
| Évaluations › Moyennes par Trimestre | `/evaluations/averages` | `GradesAveragesPage` | `grades` |

> Le menu enseignant comporte une entrée supplémentaire relevant du module de paie, **hors périmètre de ce document**.

### 6.3 Routes encore présentes dans `App.tsx` mais **retirées du menu** (dans le périmètre couvert)

Ces routes existent toujours (fichiers `.tsx` présents), mais **aucune entrée de menu n'y mène** dans `use-app-navigation.tsx`. Elles ne sont atteignables qu'en tapant l'URL manuellement.

| Route front | Page | Domaine | État |
|-------------|------|---------|------|
| `/students`, `/students/:id` | `StudentsPage`, `StudentDetailPage` | Élèves (variante legacy) | route orpheline |
| `/classes`, `/subjects` | `ClassesPage`, `SubjectsPage` | Classes/matières (legacy) | route orpheline |
| `/design-system-preview` | `DesignSystemPreviewPage` | Démo UI | route orpheline |

> `App.tsx` contient également des routes relevant des modules financiers et de paie, **hors périmètre de ce document** et donc non listées ici.

### 6.4 Pages présentes dans `apps/web/src/pages/` mais **non montées** dans `App.tsx`

Fichiers de page existants, dans le périmètre couvert, qui ne sont référencés par **aucune route** ni **aucun menu** (donc inaccessibles en l'état) : `SemestersPage.tsx`, `ClassSubjectsPage.tsx`, `TeacherAcademicPage.tsx`. Reportés sans supposer d'usage.

---

## 7. Récapitulatif transverse des grandes fonctionnalités (périmètre couvert)

| Domaine fonctionnel | Routeurs concernés | Points saillants |
|---------------------|--------------------|------------------|
| **Authentification & sécurité** | `auth`, middlewares `auth`/`rbac` | JWT access (1h) + refresh en base (7j, cookie httpOnly), bcrypt (12), audit des connexions |
| **Gestion des personnes** | `students`/`schoolStudents`, `parents`/`schoolParents`, `student-parents`, `teachers` | Doublons legacy/courant pour élèves et parents |
| **Scolarité & pédagogie** | `academic-years`, `school-classes`, `school-subjects`, `class-subjects`, `coefficients`, `subject-assignments`, `class-assignments`, `class-main-teachers`, `classrooms`, `inscriptions` | Structure année → classes → matières → affectations |
| **Évaluations** | `evaluation-types`, `grades`, `semesters` | Notes, moyennes pondérées, bulletins PDF |
| **Présences & discipline** | `attendances`, `student-absences`, `discipline` | Résumés mensuels, incidents & sanctions |
| **Emploi du temps** | `timetables`, `schedules` | Créneaux + exceptions |
| **Documents & paramètres** | `documents`, `settings`, `dashboard` | Upload multer, paramètres établissement, statistiques |

### Points d'attention relevés dans le code (sans interprétation ajoutée)

1. **Rôles FR/EN incohérents** : `'ENSEIGNANT'` (`attendances`, `discipline`, `schedules`) et `'SECRETARY'` (`students`, `parents`, `student-parents`) n'existent pas dans l'énum `UserRole` (`ADMIN/TEACHER/ACCOUNTANT/STUDENT/PARENT`) → ces gardes ne laissent passer, de fait, que les `ADMIN`. (§3.2)
2. **Routeurs sans authentification** : `classrooms.ts` et `timetables.ts` n'appliquent **aucun** middleware d'authentification.
3. **Access token TTL** : codé en dur à `1h` dans `TokenService`, ne reflète pas `config.jwt.expiresIn = '7d'`.
4. **Secrets par défaut en clair** dans `packages/config/src/index.ts` (URL PostgreSQL avec identifiants, `JWT_SECRET` de repli).
5. **Doublons fonctionnels** : élèves (`students`/`schoolStudents`), parents (`parents`/`schoolParents`), classes (`classes`/`schoolClasses`), matières (`subjects`/`schoolSubjects`) — deux implémentations coexistent (legacy vs module courant).
6. **CORS permissif en développement** : toutes origines acceptées si `NODE_ENV === 'development'`.
7. **Décalage menu / routage** : certaines pages du périmètre couvert ont été retirées du menu (`use-app-navigation.tsx`) mais leurs routes subsistent dans `App.tsx` (§6.3).

---

*Inventaire établi par lecture directe de `apps/api/src`, `apps/web/src`, `packages/config` et `packages/database/prisma/schema.prisma`. Périmètre : pédagogique & administratif (modules financiers et de paie exclus à la demande). Les éléments marqués ⚠️ ou listés au §7 correspondent à des constats de code, non à des hypothèses.*
