# HorizonEcole — Refonte UI/UX « Encre & Craie » — Document de passation

Ce document sert à reprendre le chantier de refonte dans une **nouvelle conversation Claude Code**, sans perdre le contexte accumulé. Il contient : ce qui était en cours, ce qui est fait, ce qu'il reste, les documents de référence, et un prompt prêt à copier-coller.

Dernière mise à jour : 2026-07-11.

---

## 1. Contexte général

Refonte **purement visuelle/interactionnelle** de l'application de gestion scolaire HorizonEcole (back-office Administrateur + espace Enseignant). Aucune fonctionnalité, route API ou contrat de données ne doit être modifié sans autorisation explicite — sauf exception déjà validée (voir §5).

Stack : React 18 + Vite + Ant Design 5 + Tailwind (front, `apps/web`), Express + Prisma + PostgreSQL (back, `apps/api`). Monorepo pnpm (`pnpm-workspace.yaml`).

Concept créatif : **« Encre & Craie »** — Bleu-Encre pour l'Administration, Vert-Tableau pour l'Enseignant, Ambre-Craie en accent chaud partagé. Détails complets dans le document de design system (§2 ci-dessous).

---

## 2. Documents de référence (à lire en premier)

1. **[docs/design-system-horizonecole.md](design-system-horizonecole.md)** — spec complète : tokens (couleurs, typo, espacement, rayons, ombres, animations), catalogue de composants avec états, règles responsive à 3 paliers, accessibilité, spécification écran par écran avec mapping exact vers les endpoints API réels, handoff technique Tailwind + Ant Design 5 (section 12). **Document maître : à lire intégralement avant de continuer.**
2. **[docs/horizonecole-prototype.html](horizonecole-prototype.html)** — prototype HTML/CSS/JS autonome (à ouvrir dans un navigateur) implémentant fidèlement tous les tokens et comportements sur les 7 écrans prioritaires. Référence visuelle exacte en cas de doute sur une valeur ou une animation — pas du code à copier.
3. **[docs/inventaire-fonctionnalites.md](inventaire-fonctionnalites.md)** — inventaire des 31 routeurs API et des fonctionnalités existantes, base de la spec design system.
4. **Ce document** (`docs/refonte-handoff.md`) — état d'avancement, décisions prises, dette technique.

---

## 3. Règles impératives (rappel)

- **Une étape à la fois**, avec validation utilisateur avant de passer à la suivante.
- Le menu par rôle (Admin/Enseignant) doit rester **strictement** celui de `apps/web/src/lib/navigation/use-app-navigation.tsx` — source de vérité, ne pas inventer ou omettre d'entrée.
- Pour Élèves/Classes/Matières/Parents : cibler exclusivement les routeurs **« module courant »** (`schoolStudents`, `schoolClasses`, `schoolSubjects`, `schoolParents`, `schedules.ts`) — **jamais** les routeurs legacy homonymes (`students.ts`, `classes.ts`, `subjects.ts`, `timetables.ts`).
- Si un point du design system est ambigu ou entre en conflit avec le code existant → **s'arrêter et demander**, ne pas trancher seul (cf. l'arbitrage Présence en §5).
- Environnement Windows : PowerShell/Bash selon l'outil ; pnpm avec `--store-dir 'D:\.pnpm-store\v3'` obligatoire (voir §7).

---

## 4. Ce qui est fait

### Étape 1 — Fondations ✅
- Tokens Tailwind (`apps/web/tailwind.config.js`) : palettes ink/green/amber/success/danger/info/slate, `fontFamily` display (Space Grotesk) / body (Inter) / mono (IBM Plex Mono), `borderRadius` sm8/md14/lg20/full, `boxShadow` sm/md/lg (via CSS vars), `transitionDuration` fast/base/slow.
- Mécanisme `data-theme="light|dark"` / `data-role="admin|teacher"` sur `<html>`, tokens CSS complets dans `apps/web/src/index.css` (additifs — n'écrasent aucun token legacy `--role-primary`, `.dark`, etc.).
- `ConfigProvider` Ant Design 5 avec `colorPrimary` dynamique par rôle (`apps/web/src/theme/tokens.ts`, fonction `getAntdTheme(mode, role)`).
- Polices installées : `@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono` (imports `latin-<weight>.css` — le paquet ibm-plex-mono n'a pas de fichiers de poids simples).

### Étape 2 — Composants de base ✅
Dans `apps/web/src/components/ds/` : `Button`, `Card`/`CardHeader`/`CardTitle`, `StatusBadge`, `Input`/`Field`/`SearchInput`, `Skeleton`, `Tabs`, `Drawer`, `Modal`, `toast` (singleton), `index.ts` (barrel). Classes CSS préfixées `ds-` dans `index.css` (`@layer components`) — aucune collision avec les classes legacy `.btn`/`.card`/`.badge`.

Galerie de vérification dev-only : **`/ds`** (route ajoutée dans `App.tsx` sous garde `import.meta.env.DEV`).

**Bugs réels trouvés et corrigés (réutilisables partout) :**
1. Chromium ne repeint pas une propriété `transition` quand la valeur d'une `var()` CSS change (ex. `background:var(--role-accent)` figé au changement de thème/rôle). Fix : `withTransitionsSuppressed()` dans `apps/web/src/lib/utils.ts` — neutralise les transitions le temps d'un frame via la classe `.ds-theme-switching`. **Toujours utiliser cette fonction pour toute mutation `data-theme`/`data-role` sur `<html>`.**
2. Le volet navigateur de prévisualisation exécute la page en `document.hidden` → `requestAnimationFrame` ne se déclenche jamais. Les overlays (Drawer/Modal) et `withTransitionsSuppressed` utilisent `setTimeout`, pas rAF.
3. Les captures d'écran du volet navigateur (`computer screenshot`) échouent systématiquement (timeout) dans cet environnement — vérifier via `javascript_tool` (styles calculés) plutôt que des screenshots.

### Étape 3 — Navigation ✅
Dans `apps/web/src/components/ds/nav/` : `AppShell`, `AppSidebar`, `AppTopbar`, `MobileTabbar`, `navModel.tsx` (`adaptMenu` convertit le menu Ant réel → sections DS ; `getTabbarItems` par rôle). CSS `ds-`-préfixé avec les 3 vrais paliers responsive :
- **Desktop (>1024px)** : sidebar complète 264px, groupes toujours dépliés (pas d'accordéons).
- **Tablette (641-1024px)** : rail d'icônes 78px, labels masqués.
- **Mobile (≤640px)** : sidebar en tiroir hors-champ + tabbar basse (4 raccourcis + Menu).

**Branché dans le vrai `apps/web/src/components/layout/Layout.tsx`** (remplace l'ancien `Sidebar.tsx`/`AppHeader.tsx`, désormais morts mais conservés pour revert facile). Logout, changement de mot de passe, ThemeToggle, notifications, menu profil préservés.

Preview dev-only : **`/ds-nav`** (bascules rôle/thème locales, injecte un utilisateur fictif pour exercer le vrai menu).

Décisions prises (non contestées jusqu'ici, à confirmer si besoin) :
- Groupes de menu toujours dépliés (fidèle au prototype), pas d'accordéons repliables comme l'ancien Ant Menu.
- Raccourcis tabbar : Admin = Accueil/Élèves/Planning/Inscriptions ; Enseignant = Accueil/Présence/Notes/Planning.
- Pas de titre de page dans la topbar pour l'instant (chaque page garde son propre en-tête) — prévu à traiter écran par écran en étape 4.
- Libellés de rôle affichés en français (mapping présentation uniquement, valeurs internes restent l'enum canonique EN).

### Étape 4 — Écrans prioritaires : 7/7 fait ✅ (terminée)

**1. Présence (§9.6) ✅** — décision validée par l'utilisateur (délégation du choix technique) :
- Construit sur l'API **`/attendances`** existante (roster présent/retard/absent, `GET /attendances/class/:classId`, `POST /attendances/batch`, `GET /attendances/stats`) — **et non** sur `/student-absences` (modèle heures d'absence par matière) qu'utilisait l'ancien écran. Raison : le routeur `attendances.ts` + `attendance.service.ts` existaient déjà côté back sans aucune UI, et correspondent exactement à l'interaction §9.6/§5.12 (grille de vignettes + 3 boutons + envoi groupé).
- **Correctif back-end appliqué** (nécessaire, §13) : `apps/api/src/routes/attendances.ts`, garde de rôle sur `POST /batch` changé de `['ADMIN','ENSEIGNANT']` → `['ADMIN','TEACHER']` (l'enum réelle ne contient pas `ENSEIGNANT`).
- Ancien écran **préservé** : `apps/web/src/pages/TeacherAttendancePage.legacy.tsx.bak` (extension `.bak`, exclu de la compilation, revertible).
- Fichiers créés : `apps/web/src/pages/TeacherAttendancePage.tsx` (conteneur données react-query) + `apps/web/src/components/attendance/AttendanceBoard.tsx` (vue présentation pure).
- Flux : classes ← `/teachers/me/assignments` · roster ← `/schoolStudents?classId=` · statuts existants ← `/attendances/class/:id?date=&period=` · sauvegarde ← `POST /attendances/batch {classId,date,period,attendances:[{studentId,status}]}`.
- CSS ajouté dans `index.css` : `.ds-chip`, `.ds-segment`, `.ds-att-summary`, `.ds-att-card`, `.ds-att-btn`, `.ds-sticky-save` (cibles tactiles ≥44px mobile confirmées).
- Preview dev-only : **`/ds-attendance`** (données fictives).
- **Vérifié (UI)** : rendu desktop/mobile, interactions (bascule statut + compteurs live), couleurs sémantiques (amber/danger), cibles tactiles 44px, mode sombre (un bug de contraste texte trouvé et corrigé), `tsc` web+api sans erreur.
- **Smoke-test API réel (2026-07-11, base locale `school_db` via `.env`, compte ADMIN `admin@souverainlarabia.edu.ci`)** : login OK, enveloppes `{success,data}` conformes, routes de lecture (`/academic-years`, `/school-classes`, `/school-students`, `/attendances/class/:id`) OK. **Deux bugs réels trouvés et corrigés** :
  - **Bug A (back, critique) — SIGNALÉ, NON corrigé (décision utilisateur 2026-07-11 : back-end hors périmètre refonte, à traiter séparément)** : `POST /attendances/batch` lit `req.user.userId` — inexistant, le middleware `authenticate`/`authenticateToken` ne pose que `req.user.id` — passé comme `recordedBy` → `connect:{ id: undefined }` → Prisma rejette chaque **création** → le *premier* appel d'une classe enregistre **0 élève en silence** (les updates suivants passent, masquant le bug). Correctif attendu côté back : `userId`→`id` dans `apps/api/src/routes/attendances.ts` (lignes 52 et 80) — un patch appliqué puis **reverté** à la demande de l'utilisateur pour rester strictement visuel. ⚠️ Pattern **systémique** (~40 sites : finance/paie, `discipline`, `schedules`, `documents`, `settings`). `grades.ts` n'est **pas** concerné (écran Notes tranquille) ; `schedules.ts` **l'est** (à corriger côté back avant/pendant l'écran 6).
  - **Bug B (front, critique)** : le roster appelait `/schoolStudents` (camelCase) → **404** (routeur monté en kebab `/api/school-students`) → roster toujours vide. Corrigé `apps/web/src/pages/TeacherAttendancePage.tsx:51` → `/school-students`.
- **NON encore vérifié en E2E live** : le roster qui se remplit et la sauvegarde qui persiste, car la base locale n'a **aucun élève** rattaché à une classe (`_count.students = 0` sur l'unique classe « 6ème 1 ») ni **compte enseignant** (le seed `teachers.ts` crée des lignes `teachers` mais aucun `User` login). Les deux correctifs sont corrects par construction mais restent à **prouver avec des données réelles** : seeder quelques élèves dans une classe + créer un login TEACHER lié à une affectation, puis rejouer login enseignant → `/teachers/me/assignments` → roster → `POST /batch` → relecture.

**2. Saisie des notes / bulletin (§9.5) ✅** — re-skin **fidèle** (option « garde tout » validée par l'utilisateur) de l'ancien `GradesPage`, **aucune fonctionnalité changée** :
- Logique métier conservée à l'identique (colonnes Note 1..N, **un type d'évaluation par colonne** + contraintes d'unicité, verrou par trimestre actif/terminé, CRUD note par note). Seule la présentation change.
- Roster basculé sur le module courant **`/school-students?classId=`** (au lieu du legacy `/students`) — vérifié : renvoie bien `gender` (colonne Sexe préservée).
- Ajout §9.5 : **moyenne matière live en police mono**, calculée avec la formule **EXACTE du bulletin PDF** (`pdf.service.ts` : note /20, coeff 0.5 si /10 sinon 1, moyenne pondérée arrondie 2 décimales) — vérifiée numériquement (8.00, 11.33).
- Fichiers : `apps/web/src/pages/GradesPage.tsx` (conteneur données) + `apps/web/src/components/grades/GradesBoard.tsx` (présentation pure). Ancien préservé : `GradesPage.legacy.tsx.bak`. CSS `ds-grades-*` ajouté dans `index.css`. Modale ajout/édition DS (champ note mono, sélecteur type **contraint par colonne**, /10|/20, suppression).
- Preview dev-only : **`/ds-grades`** (données fictives).
- **Vérifié** sur serveur Vite réel (mock) : grille/colonnes/chips/Sexe, styles DS (mono, accent vert enseignant, seuil moyenne 10/20 vert/rouge), modale (contrainte type par colonne OK — n'offre que les types non utilisés), **mode sombre** (contraste OK), `tsc` web **0 erreur**.
- **NON vérifié** : appel réel à l'API (même blocage E2E que Présence : base locale sans élève ni compte enseignant). Correct par construction, à smoke-tester avec un vrai compte.
- ⚠️ L'écran ENTRÉE de notes **ne porte pas les 3 exports PDF** (ils sont sur des pages Admin séparées `CompleteAveragesPage`/`ClassGradesPage`) — non ajoutés ici pour ne pas changer le périmètre ; le « Aperçu du bulletin » du §9.5 reste une **option à valider**.

**3. Tableau de bord (§9.1) ✅** — re-skin « Encre & Craie », **recentré sur le pédagogique** :
- **Décision utilisateur 2026-07-11 : le module paiement a été supprimé / n'est plus utilisé.** Les cartes finance de l'ancien dashboard (Revenus Totaux, Revenus du Mois, Paiements en Attente, Paiements Récents) sont donc **retirées** (pas une perte : fonctionnalité déjà morte). L'API `/dashboard/stats` renvoie encore ces champs finance — simplement **ignorés** côté front (aucune modif back).
- Contenu : 4 stat-cards pédagogiques (Élèves actifs, Total élèves, Enseignants, Classes) en style §5.4 (grand chiffre `font-display`, médaillon d'icône teinté accent), activité récente (Nouveaux élèves + Notes récentes), et **raccourcis §9.1** (navigation pure, **admin uniquement**, zéro nouvel appel API).
- **Bug front corrigé** (dans le fichier de la refonte) : « Notes récentes » lisait `grade.value`/`maxValue`/`subject` inexistants → remplacé par les vrais champs `note`/`max_note`/`subject.name` (affichait « undefined/undefined » avant). Idem la carte Paiements retirée lisait `payment.fee.name` inexistant.
- Endpoints inchangés : `/dashboard/stats`, `/dashboard/activities`. Roster N/A ici.
- Fichiers : `apps/web/src/pages/DashboardPage.tsx` (conteneur) + `apps/web/src/components/dashboard/DashboardBoard.tsx` (présentation). Ancien préservé : `DashboardPage.legacy.tsx.bak`. CSS `ds-stat-*`/`ds-dash-*`/`ds-activity-*` dans `index.css`.
- Preview dev-only : **`/ds-dashboard`** (bascule Admin/Enseignant + clair/sombre, données fictives).
- **Vérifié** sur serveur Vite réel (mock) : 4 stat-cards (valeurs + `font-display` + médaillon accent), activité récente, note pass/fail vert/rouge, **accent de rôle qui bascule bleu-encre↔vert** + **raccourcis masqués pour l'enseignant**, mode sombre OK, `tsc` web **0 erreur**.
- **NON vérifié** : appel réel à l'API (base locale). L'écran reste **commun aux deux rôles** ; la version enseignant dédiée (§9.2, écran 4) affinera le contenu par rôle.

**4. Tableau de bord Enseignant (§9.2) ✅** — le `DashboardPage` **branche désormais par rôle** : TEACHER → tableau de bord orienté « action rapide », sinon la vue admin (§9.1).
- Contenu enseignant : en-tête « Bonjour {nom} », **Mes cours du jour** (créneaux du jour filtrés par `day_of_week`, heure en mono + matière/classe/salle + accès direct **Appel**/**Notes**), **Raccourcis** (Faire l'appel, Saisir des notes, Mon emploi du temps, Mes classes), **Mes classes** (depuis les affectations, avec chips de matières).
- Le bloc « à traiter » du §9.2 (notes manquantes / absences non justifiées) **n'a pas de source de données fiable** → remplacé par « Mes classes » (données réelles). À enrichir si un endpoint dédié apparaît.
- Endpoints : `/academic-years` (année courante), `/teachers/me/info`, `/teachers/me/timetable`, `/teachers/me/assignments`. `day_of_week` enum MONDAY..SATURDAY ; `start_time`/`end_time` = chaînes "HH:MM".
- Fichiers : `DashboardPage.tsx` (branche + 2 conteneurs) + `components/dashboard/TeacherDashboardBoard.tsx`. CSS `ds-course-*`/`ds-class-*`/`ds-chip-mini`. Preview partagée **`/ds-dashboard`** (bascule Admin/Enseignant montre les 2 dashboards).
- **Vérifié** sur serveur Vite réel (mock) : cours du jour (heure mono + accent vert, actions Appel/Notes), raccourcis, classes + chips matières, mode sombre OK, `tsc` web **0 erreur**.
- **NON vérifié** : appel réel à l'API (base locale).

**5. Liste élèves + fiche détail (§9.3) ✅** — décisions utilisateur : **garder le routeur legacy `/students`** (garde tout : pièces jointes + « Affecté État », absents de `/school-students`) et **fiche complète 4 onglets** d'emblée.
- Liste DS : recherche (debounce 300ms) + filtres **classe** + **statut**, bascule **grille/liste**, cartes élève (avatar, matricule mono, badge classe, badge statut sémantique) cliquables → tiroir. Pagination DS.
- Tiroir de détail (§5.8) à onglets **Profil** (11 champs + pièces jointes) / **Parents** (liste + rattacher/retirer, relation PERE/MERE/TUTEUR/AUTRE) / **Notes** (`/grades?studentId`, note mono pass/fail) / **Présences** (`/attendances/summaries?studentId`, relevé mensuel P/R/A + taux).
- Formulaire création/édition **conservé en Ant Design** (§12.2) — multipart `/students` avec pièces jointes + validation date JJ/MM/AAAA + « Affecté État » intacts. Suppression via modale de confirmation DS.
- Fichiers : `pages/StudentsListPage.tsx` (conteneur) + `components/students/StudentsBoard.tsx` (liste) + `components/students/StudentDetailDrawer.tsx` (tiroir). CSS `ds-students-*`/`ds-student-*`/`ds-detail-*`/`ds-parent-*`. Preview **`/ds-students`**.
- **Vérifié** sur serveur Vite réel (mock) : cartes + filtres + badges statut, tiroir 4 onglets (Profil/Parents add-form/Notes pass-fail/Présences), mode sombre OK, `tsc` web **0 erreur**.
- **NON vérifié** : appel réel à l'API (base locale). Doublon legacy/module-courant : cet écran reste sur `/students` par nécessité fonctionnelle (documenté).

**6. Emploi du temps (§9.4) ✅** — re-skin de la grille existante. **Décision utilisateur : reste sur `/timetables`** (table `class_timetables` — la donnée réelle, cohérente avec la vue enseignant §9.2) plutôt que `/schedules` (table séparée, vide/désynchronisée).
- Grille DS jours × créneaux (`components/timetable/TimetableGrid.tsx`) : cellule = carte compacte (matière `font-display`, salle en accent, enseignant en ambre), créneau vide « + Ajouter », bande « APRÈS-MIDI », créneaux en mono. Cas **EPS** (pas de salle) préservé.
- **Logique d'édition inline conservée à l'identique** (matière → enseignants filtrés par affectation, salle, validation) via l'éditeur Ant Design (§12.2) passé en `renderEditor`. Suppression via modale de confirmation DS. Endpoints inchangés (`/timetables`, `/academic-years`, `/school-classes`, `/subjects`, `/classrooms`, `/class-assignments/teachers`).
- **Exceptions §9.4 omises** : elles vivent sur le routeur `schedules.ts` (table `schedule_exceptions`), système parallèle **non utilisé** par la donnée réelle. À traiter si migration vers `schedules`.
- ⚠️ **Dette sécurité** : `/timetables` reste **sans authentification** côté back (§13) — à corriger côté back-end (hors périmètre refonte).
- Fichiers : `pages/TimetablePage.tsx` (conteneur) + `components/timetable/TimetableGrid.tsx`. Ancien préservé `TimetablePage.legacy.tsx.bak`. CSS `ds-tt-*`. Preview **`/ds-timetable`**.
- **Vérifié** sur serveur Vite réel (mock) : grille + cellules (matière/salle/prof), EPS sans salle, bande après-midi, cellules vides, mono créneaux, accent de rôle, mode sombre OK, `tsc` web **0 erreur**.

**7. Inscriptions (§9.7) ✅** — **kanban par classe** (décision utilisateur). Le modèle `inscriptions` **n'a aucun statut/pipeline** (juste élève↔classe↔année, `getStatistics` renvoie `{total}`) → le kanban « par statut » du §9.7 est impossible ; réalisé **par classe**.
- Colonnes = classes (même vides, état vide compact §5.10), cartes = élèves inscrits (avatar, matricule mono, badge année, languette accent), compteur par colonne, recherche par nom/matricule, bannière année en cours.
- **Fiche inscription (modale DS)** au clic sur une carte : **déplacer l'élève vers une autre classe** = `PATCH /inscriptions/:id { classId }` (l'équivalent réel du « changement de statut » §9.7) + suppression. **Nouvelle inscription** en modale Ant Design (§12.2, sélecteur d'élève recherchable). Endpoints inchangés.
- Fichiers : `pages/InscriptionsPage.tsx` (conteneur) + `components/inscriptions/InscriptionsBoard.tsx`. Ancien préservé `InscriptionsPage.legacy.tsx.bak`. CSS `ds-kanban-*`. Preview **`/ds-inscriptions`**.
- **Vérifié** sur serveur Vite réel (mock) : colonnes/compteurs, colonne vide, cartes (avatar/nom/matricule/année), languette accent, mode sombre OK, `tsc` web **0 erreur**.

---

### ✅ Étape 4 terminée (2026-07-11) — les 7 écrans prioritaires sont faits.

Tous re-skinnés « Encre & Craie », vérifiés sur serveur Vite réel (données fictives) + `tsc` 0 erreur, mode sombre OK. **Reste (voir §5/§6) : le smoke-test API réel de chacun (base locale sans données/compte enseignant), et l'étape 5 (extension aux modules restants).** Points back signalés non corrigés (règle : refonte front seulement) : `recordedBy` (attendances), `req.user.userId` systémique, `/timetables` & `/classrooms` sans auth.

---

## 5. Décisions/arbitrages déjà tranchés (ne pas re-débattre sans raison)

| Sujet | Décision | Où |
|---|---|---|
| Modèle Présence | API `/attendances` (roster) plutôt que `/student-absences` (heures) | étape 4, écran 1 |
| Garde de rôle attendances batch | `ENSEIGNANT`→`TEACHER` corrigé | `apps/api/src/routes/attendances.ts` |
| Groupes menu | Toujours dépliés, pas d'accordéons | étape 3 |
| Valeurs sémantiques couleur | Table §3.4 / prototype retenue (pas les hex de §12.2 qui diffèrent légèrement) | étape 1 |
| Libellés rôle FR | Mapping présentation uniquement (`Layout.tsx`), enum interne reste EN | étape 3 |
| Bug Présence `recordedBy` (back) | **Signalé, non corrigé** (revert — back hors périmètre, à traiter séparément) : `req.user.userId`→`req.user.id` | `apps/api/src/routes/attendances.ts` (smoke-test 2026-07-11) |
| Bug Présence roster (front) | **Corrigé** `/schoolStudents`→`/school-students` (route kebab) | `TeacherAttendancePage.tsx:51` (smoke-test 2026-07-11) |
| Périmètre back-end | La refonte reste **strictement front/visuel** ; tout bug back trouvé est **signalé, jamais corrigé** par la refonte | décision utilisateur 2026-07-11 |

---

## 6. Ce qu'il reste à faire

### Étape 4 — Écrans prioritaires (0 restant — ✅ terminée)
2. ~~**Saisie des notes / bulletin** (§9.5)~~ ✅ **fait** (voir §4).
3. ~~**Tableau de bord Admin** (§9.1)~~ ✅ **fait** (voir §4). Module paiement retiré (finance morte).
4. ~~**Tableau de bord Enseignant** (§9.2)~~ ✅ **fait** (voir §4). `DashboardPage` branche par rôle.
5. ~~**Liste élèves + fiche détail** (§9.3)~~ ✅ **fait** (voir §4). Sur legacy `/students` (garde tout : pièces jointes + Affecté État).
6. ~~**Emploi du temps** (§9.4)~~ ✅ **fait** (voir §4). Décision : reste sur `/timetables` (donnée réelle) ; exceptions omises ; dette sécurité no-auth signalée.
7. ~~**Inscriptions** (§9.7)~~ ✅ **fait** (voir §4). Kanban **par classe** (le modèle n'a pas de statut).

### Étape 5 (§10) — Extension aux modules restants — **EN COURS**

**Scaffold générique réutilisable créé (2026-07-11)** pour accélérer et uniformiser :
- `apps/web/src/components/shared/EntityBoard.tsx` — liste d'entités générique : en-tête + action primaire, recherche + filtres optionnels (slot), grille de cartes (`cardOf(item)` → titre/sous-titre/badges/onClick), pagination interne, **confirmation de suppression intégrée**, état vide. CSS `ds-entity-*`.
- `apps/web/src/components/shared/EntityFormModal.tsx` — modale de formulaire générique pilotée par `fields` (`text`/`number`/`select`/`textarea`, `required`, `min`, `colSpan`), validation minimale intégrée.
- Preview du scaffold : **`/ds-entity`** (bascule rôle/thème, CRUD local). Vérifié : cartes/badges, formulaire + validation requise, mode sombre, `tsc` 0.
- **Patron par module** : conteneur mince (~60 lignes) = queries react-query + 3 mutations + `<EntityBoard cardOf=…>` + `<EntityFormModal fields=…>`. Voir `SchoolClassesPage.tsx` / `SchoolSubjectsPage.tsx` comme modèles.

**Modules faits (10) :** ✅ Classes · ✅ Matières · ✅ Salles (`classrooms`) · ✅ Types d'évaluation (enseignant, coefficient) · ✅ Utilisateurs (`users`, lecture seule) · ✅ **Années scolaires** (`academic-years` + `semesters` : liste + « définir en cours » + trimestres imbriqués, via `cardActions` + form type `date`) · ✅ **Mes Classes** (enseignant, `/teachers/me/assignments`, lecture) · ✅ **Mon Emploi du Temps** (enseignant, `/teachers/me/timetable`, `TimetableGrid` en mode `readOnly`) · ✅ **Parents** (`/parents` CRUD ; association élève déléguée à la fiche Élève §9.3) · ✅ **Enseignants** (`/teachers` CRUD ; spécialités/qualifications simplifiées en champs « séparés par virgules » = même donnée). *(Tous `tsc` 0 ; UI validée par le scaffold `/ds-entity` ; **non smoke-testés API réelle**.)*

**Extensions du scaffold ajoutées :** `EntityBoard` → `primaryLabel`/`onPrimary` optionnels + `cardActions(item)` (actions custom par carte) ; `EntityFormModal` → type `date` ; `TimetableGrid` → prop `readOnly`.

**Écrans complexes — finalisés au niveau chrome DS :**
- ✅ **Moyennes Complètes** (`/academic/complete-averages`) : **réécrit entièrement en DS** (en-tête, filtres `ds-select`, bannière, boutons DS, moyennes en mono) ; le tableau dense reste un Ant Table (§12.2) ; calcul + exports PDF conservés.
- ✅ **Chrome DS partagé (2026-07-11)** : `components/ui/page-header.tsx` (typographie DS) et `components/ui/glass-card.tsx` (surfaces DS : `rounded-[20px]` + `border-ds-border` + `shadow-sm`, le fond suit le thème via l'algorithme Ant Design) ont été **re-ciblés vers les tokens DS**. → **Toutes les pages encore en Ant** (Notes par Matière, Moyennes par Trimestre, Affectations Enseignants, Affectations matières, Coefficients, + pages hors périmètre finance) héritent automatiquement de l'**en-tête + surfaces « Encre & Craie »**, en gardant leurs tableaux/sélecteurs/modales Ant (§12.2). Vérifié : app démarre sans erreur, `/ds-entity` + `/login` OK, `tsc` 0.
- ⚠️ **Effet de bord assumé** : le re-ciblage de `GlassCard`/`PageHeader` touche AUSSI les pages hors périmètre (finance) — changement purement visuel (surfaces plus propres), aucune modif fonctionnelle.
- ✅ **Écrans relationnels refaits en FULL DS (2026-07-11, demande explicite utilisateur)** :
  - **Coefficients** (`/academic/coefficients`) : grille éditable matière×coefficient en DS (inputs mono), enregistrement en lot conservé. CSS `ds-coeff-*`.
  - **Affectations matières** (`/academic/assignments`) : cases à cocher DS des matières (`ds-check-*`), tout/aucune, save en lot.
  - **Affectations Enseignants** (`/academic/class-assignments`) : vue principale full DS (cartes enseignant : spécialités, affectations classe×matière en chips, badge prof. principal, actions) ; **les 2 modales complexes** (éditeur d'affectations dynamique `Form.List` + prof. principal) **restent en Ant Design** (§12.2), logique conservée.
  - Vérifiés sur serveur Vite réel (preview **`/ds-relational`**, données fictives) : grille coeff mono, cases à cocher (état sélectionné accent), cartes enseignant + badge, mode sombre OK, `tsc` 0.
- ✅ **Notes par Matière** (`/academic/class-grades`) et **Moyennes par Trimestre** (`/evaluations/averages`) refaits en **FULL DS (2026-07-11)** : sélecteurs `ds-select` + **tableau DS** (`ds-grades-table` : notes en mono, moyenne pass/fail vert/rouge, en-têtes groupés matière→N1..N+Moy pour Notes par Matière ; classement/rang pour Moyennes par Trimestre). Formules conservées ; export PDF conservé (Notes par Matière). `tsc` 0 ; styles réutilisés (déjà vérifiés navigateur sur `/ds-grades`).
- ✅ **Moyennes Complètes** (`/academic/complete-averages`) : tableau Ant **converti en tableau DS** (`ds-grades-table` : en-têtes groupés matière→Moy/Rang via colspan/rowspan, colonne MG, bouton Bulletin PDF par ligne, moyennes mono pass/fail). `tsc` 0. **Plus AUCUN Ant Table dans l'app.**
- ↳ **Seul reste en Ant** (autorisé §12.2, non bloquant) : les **2 modales d'édition** d'Affectations Enseignants (éditeur `Form.List` dynamique + prof. principal). **Refonte visuelle : 100 % « Encre & Craie ».**

**Bespoke restants (ne rentrent PAS dans le scaffold carte-liste) :** `ClassAssignmentsPage` (~800 lignes : affectations enseignant×classe×matière + professeurs principaux, 2 modales) et `SubjectAssignmentPage` (classe → multi-sélection de matières) sont des **éditeurs relationnels** ; **Coefficients** = grille éditable classe×matière. À traiter au cas par cas.

**Périmètre réel (menu = source de vérité `use-app-navigation.tsx`)** — Discipline / Paramètres / Documents / Trimestres (standalone) / Classe↔matière / Profs principaux **ne sont PAS dans le menu** → hors périmètre accessible. Pages de menu restantes : Parents, Enseignants, Années Scolaires (medium : set-current + trimestres imbriqués), Affectations Enseignants (`class-assignments`), Affectations matières (`subject-assignments`), Coefficients (grille), Moyennes Complètes / Notes par Matière / Moyennes par Trimestre (rapports PDF `grades`), Utilisateurs (liste + édition seulement), Mes Classes, Mon Emploi du Temps (enseignant, lecture — réutiliser `TimetableGrid`).

**Modules restants** (même patron scaffold sauf cas particuliers) : Parents *(liste + fiche — plus riche, cf. §9.3)*, Enseignants *(fiche & gestion — plus riche)*, Années scolaires *(+ action « définir en cours »)*, Salles de classe, Classe↔matière, Coefficients *(cas particulier)*, Affectations matières/enseignants, Professeurs principaux, Types d'évaluation, Trimestres, Discipline *(incidents/sanctions — plus riche)*, Documents *(upload)*, Paramètres établissement *(cas particulier)*, Utilisateurs, + pages enseignant restantes (Mes Classes, Mon Emploi du Temps).

Cas particuliers notés dans le design system :
- **Coefficients** : grille éditable classe×matière plutôt que cartes individuelles, action de mise à jour en lot (`POST /coefficients/class/:classId/batch` existe déjà).
- **Paramètres établissement** : formulaire unique en sections repliables, pas une liste.

### Dette et points transverses
1. **Vérification API réelle** (priorité) : aucun écran connecté aux données n'a été smoke-testé avec un vrai compte contre une API démarrée. À faire dès que possible, en commençant par Présence (comptes ADMIN et TEACHER).
2. **Cohérence transitoire** : tant que les écrans legacy ne sont pas migrés, l'app mélange le nouveau style DS (coquille, Présence) et l'ancien habillage vert/orange à l'intérieur des pages non encore traitées.
3. **Routes de préview dev** à retirer avant mise en production : `/ds`, `/ds-nav`, `/ds-attendance`, `/ds-grades`, `/ds-dashboard`, `/ds-students`, `/ds-timetable`, `/ds-inscriptions`, `/ds-entity`, `/ds-relational`, et leurs pages `DesignSystem*PreviewPage.tsx`. Config dev **`web-preview` (port 5174)** ajoutée dans `.claude/launch.json` (nécessaire pour vérifier quand un autre chat occupe 5173) — à retirer aussi.
4. **Code mort à nettoyer en fin de refonte** : `apps/web/src/components/layout/Sidebar.tsx` et `AppHeader.tsx` (remplacés par la coquille DS), + tous les `*.legacy.tsx.bak` (`TeacherAttendancePage`, `GradesPage`, `DashboardPage`, `StudentsListPage`, `TimetablePage`, `InscriptionsPage`, `SchoolClassesPage`, `SchoolSubjectsPage`, `ClassroomsPage`, `EvaluationTypesPage`, `UsersPage`, `AcademicYearsPage`, `TeacherClassesPage`, `TeacherTimetablePage`, `ParentsPage`, `TeachersPage`, `CompleteAveragesPage`, `CoefficientsPage`, `SubjectAssignmentPage`, `ClassAssignmentsPage`, `ClassGradesPage`, `GradesAveragesPage`).
5. **Points backend §13 non corrigés** (signalés, pas traités sauf le correctif Présence) :
   - `classrooms.ts` et `timetables.ts` sans middleware d'authentification.
   - Autres gardes de rôle référençant `'ENSEIGNANT'`/`'SECRETARY'` (absents de l'enum réelle `ADMIN/TEACHER/ACCOUNTANT/STUDENT/PARENT`) dans `analytics.ts`, `discipline.ts`, `schedules.ts` (exceptions), `parents.ts`, `students.ts`, `student-parents.ts`.
   - **`req.user.userId` systémique (undefined)** : le middleware `authenticate` pose `req.user.id`, mais ~40 handlers lisent `req.user.userId` (budgets, expenses, revenues, staff, `discipline`, `schedules`, `documents`, `settings`, …). Corrigé uniquement dans `attendances.ts` (écran Présence). Là où `userId` alimente un `connect:{id}` sur une relation, l'écriture échoue ou pose `null` ; là où il ne sert qu'à l'audit, le log est `undefined`. **À corriger dans `schedules.ts` avant/pendant l'écran 6.**
   - Upload avatar élève uniquement sur le routeur legacy `students.ts`, absent de `schoolStudents.ts`.
6. **Hors périmètre du design actuel** (à clarifier si besoin) : page de login, écrans spécifiques Comptable/Élève/Parent (le design system ne couvre qu'Admin + Enseignant).

---

## 7. Rappels d'environnement utiles

- pnpm : toujours utiliser `--store-dir 'D:\.pnpm-store\v3'` pour tout install (`ERR_PNPM_UNEXPECTED_STORE` sinon). **Ne jamais lancer deux installs en parallèle** (un conflit a déjà corrompu `node_modules/@fontsource` une fois).
- Serveur dev web : `pnpm --filter web dev` (port 5173) ou via `.claude/launch.json` (config `"web"`). Serveur API : config `"api"` (port 4001).
- Le volet navigateur de prévisualisation (Browser pane) tourne en `document.hidden` : `requestAnimationFrame` ne se déclenche jamais, les captures d'écran échouent en timeout. Vérifier visuellement via des sondes `javascript_tool` sur les styles calculés (`getComputedStyle`), pas des screenshots.

---

## 8. Prompt à utiliser dans une nouvelle conversation

Copier-coller le bloc ci-dessous tel quel pour reprendre le chantier :

````
Nous continuons la refonte UI/UX « Encre & Craie » d'HorizonEcole (back-office
Admin + espace Enseignant). Un chantier substantiel a déjà été réalisé dans une
conversation précédente — lis D'ABORD entièrement docs/refonte-handoff.md qui
résume tout : ce qui est fait (étapes 1-3 + écran Présence de l'étape 4), les
décisions déjà tranchées à ne pas re-débattre, la dette technique connue, et
les rappels d'environnement (pnpm, volet navigateur).

Documents de référence à connaître :
1. docs/design-system-horizonecole.md — spec complète du design system
   (tokens, composants, responsive, accessibilité, mapping écran→endpoints).
2. docs/horizonecole-prototype.html — prototype HTML/CSS/JS de référence
   visuelle exacte (pas du code à copier).
3. docs/inventaire-fonctionnalites.md — inventaire des routeurs API réels.
4. docs/refonte-handoff.md — état d'avancement détaillé (ce document).

Règles impératives (rappel) :
- Une étape/écran à la fois, j'attends ta validation avant de continuer.
- Le menu par rôle reste strictement celui de
  apps/web/src/lib/navigation/use-app-navigation.tsx.
- Pour Élèves/Classes/Matières/Parents/Emploi du temps : cibler uniquement les
  routeurs "module courant" (schoolStudents, schoolClasses, schoolSubjects,
  schoolParents, schedules.ts) — jamais les doublons legacy (students.ts,
  classes.ts, subjects.ts, timetables.ts).
- Si un point du design system est ambigu ou en conflit avec le code existant,
  arrête-toi et demande — ne tranche pas seul (comme pour l'écran Présence,
  voir §5 du handoff).
- Ne change aucune fonctionnalité, route API ou contrat de données sans mon
  accord explicite.

Priorité immédiate avant de continuer sur un nouvel écran : je veux qu'on
fasse un smoke-test réel de l'écran Présence déjà construit (comptes ADMIN et
TEACHER, API+DB démarrées) — il n'a été vérifié qu'avec des données fictives
jusqu'ici. [Adapte cette phrase si tu veux plutôt enchaîner directement sur
l'écran Saisie des notes / bulletin (§9.5), le prochain de la liste.]

Commence par confirmer que tu as bien lu docs/refonte-handoff.md et les
documents de référence, résume-moi en 5 lignes ce que tu as compris de l'état
actuel, puis propose la marche à suivre pour la suite.
````

