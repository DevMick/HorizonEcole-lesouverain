# HorizonEcole — Design System & guide de handoff UI/UX

**Périmètre couvert :** back-office Administrateur + espace Enseignant, sur la base stricte de `inventaire-fonctionnalites.md` (31 routeurs, pages `apps/web/src/pages`, menu `use-app-navigation.tsx`).
**Stack cible inchangée :** React 18 + Vite + Ant Design 5 + Tailwind (front), Express + Prisma + PostgreSQL (back). Cette refonte ne change **aucune fonctionnalité** — uniquement l'habillage visuel, les interactions et l'organisation de l'information.
**Livrable compagnon :** `horizonecole-prototype.html` — maquette HTML/CSS/JS interactive et autonome (ouvrable dans n'importe quel navigateur, sans build), couvrant les 7 écrans prioritaires + mode clair/sombre + bascule Admin/Enseignant à but de démonstration.

---

## 1. Principes directeurs

1. **Cohérence avant décoration.** Un seul système de composants sert les deux profils ; seule une teinte d'accent change entre Administration et Enseignant.
2. **La carte comme unité d'affichage par défaut**, conformément à votre préférence exprimée sur la page *Années Scolaires* : listes d'élèves, d'inscriptions, d'activités et de cours du jour utilisent toutes le même patron de carte (`entity-card` / `card-accent`), plutôt que des tableaux Ant Design bruts.
3. **Réduire les clics sur les parcours fréquents.** L'appel et la saisie de notes sont conçus pour un usage clavier/tactile en rafale (valeurs par défaut intelligentes, tabulation, sauvegarde perçue comme continue).
4. **Adaptation réelle, pas du reflow.** Chaque breakpoint change la structure (barre latérale → rail d'icônes → tiroir + barre d'onglets ; grille d'emploi du temps → agenda journalier), pas seulement la largeur des colonnes.
5. **Clair et sombre comme citoyens de première classe.** Chaque token de couleur a une valeur définie dans les deux thèmes ; rien n'est calculé par simple inversion.

---

## 2. Concept créatif — « Encre & Craie »

Un système de gestion scolaire vit entre deux objets : le stylo à encre de l'administration (dossiers, bulletins, inscriptions) et la craie du tableau noir de l'enseignant. Le design en tire :

- **Couleur de marque (Administration) : bleu-encre.** Sobre, autoritaire, proche d'un stylo-plume plutôt que du bleu SaaS générique.
- **Couleur de rôle (Enseignant) : vert-tableau.** Un clin d'œil littéral au tableau noir de la salle de classe.
- **Accent chaud partagé : ambre-craie.** Utilisé pour les alertes, les mises en avant et les badges, dans les deux espaces.
- **Élément signature : la « languette de dossier ».** Chaque carte porte une languette colorée de 4 px en haut à gauche — une référence discrète à l'onglet coloré d'un dossier scolaire papier. C'est le seul geste décoratif récurrent du système ; tout le reste reste sobre.
- **Chiffres en police tabulaire (mono).** Notes, moyennes, matricules et statistiques sont composés en `IBM Plex Mono` à chasse fixe — l'esprit « registre » d'un cahier de notes, et un vrai bénéfice de lisibilité pour comparer des nombres en colonne.

### Typographie

| Rôle | Police | Usage |
|---|---|---|
| Titres (`--font-display`) | **Space Grotesk** (secours : Poppins, system-ui) | Titres de page, noms de sections, grandeurs de tableau de bord |
| Texte courant (`--font-body`) | **Inter** (secours : system-ui) | Corps de texte, libellés de formulaire, contenu de carte |
| Données (`--font-mono`) | **IBM Plex Mono** (secours : Consolas) | Notes, moyennes, matricules, coefficients, compteurs |

Échelle type (rem, base 16px = 15px pour le corps, densité admin) :

| Style | Taille / interligne | Poids | Usage |
|---|---|---|---|
| `display` | 1.5rem / 1.2 | 700 | Titre de page (`<h1>`) |
| `heading-lg` | 1.1rem / 1.3 | 700 | Titres de section (`<h2>`) |
| `heading` | 0.96rem / 1.4 | 700 | Titres de carte |
| `body` | 0.9375rem / 1.5 | 400–500 | Texte courant |
| `body-sm` | 0.82rem / 1.5 | 400 | Texte secondaire, méta-données |
| `caption` | 0.72–0.76rem / 1.4 | 600–700 | Badges, étiquettes, éléments de navigation |
| `stat` | 1.7–1.9rem / 1 | 600, mono | Chiffres clés (KPI, moyennes) |


---

## 3. Design tokens — couleurs

### 3.1 Couleur de marque — Bleu-Encre (Administration)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `ink-50` | `#EEF1FA` | `#1A2340` (teinte) | Fond doux, badge de rôle |
| `ink-100` | `#DCE3F5` | — | Survol léger |
| `ink-400` | `#647DC5` | Utilisé comme accent principal en mode sombre | — |
| `ink-600` | `#34478F` | — | **Couleur d'accent principale (boutons, liens, focus)** |
| `ink-700` | `#293770` | Utilisé comme accent en mode sombre | Survol / état actif |
| `ink-900` | `#171F3F` | — | Texte sur fond clair coloré |

### 3.2 Couleur de rôle — Vert-Tableau (Enseignant)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `green-50` | `#EAF5F0` | `#122A22` (teinte) | Fond doux |
| `green-400` | `#4FAE85` | Accent principal en mode sombre | — |
| `green-600` | `#217A54` | — | **Couleur d'accent principale (espace enseignant)** |
| `green-700` | `#1A6144` | Accent en mode sombre | Survol / état actif |

### 3.3 Accent chaud partagé — Ambre-Craie

| Token | Valeur | Usage |
|---|---|---|
| `amber-50` | `#FDF3E4` (`#2A2013` en sombre) | Fond de badge d'avertissement |
| `amber-500` | `#E8A33D` | Icônes de mise en avant, jauges |
| `amber-600` | `#CC8722` | — |
| `amber-700` | `#A66C1B` | Texte sur fond `amber-50` |

### 3.4 Couleurs sémantiques

| Rôle | 50 (fond) | 500/600 (icône/texte) | 700 |
|---|---|---|---|
| Succès (présent, validé) | `#E4F8F0` / `#0F2C22` | `#16A672` / `#0E8B5E` | `#0B6E4A` |
| Danger (absent, erreur, rejeté) | `#FBEAEC` / `#301419` | `#D93B4C` / `#B92C3C` | — |
| Avertissement (retard, en attente) | *(alias ambre)* | `#E8A33D` / `#CC8722` | `#A66C1B` |
| Information (à venir, neutre) | `#E9F2FB` / `#132534` | `#3C82C4` / `#2C689F` | `#204F79` |

### 3.5 Neutres — mode clair (« Papier »)

| Token | Valeur | Usage |
|---|---|---|
| `slate-0` | `#F5F6FA` | Fond de page |
| `slate-50` | `#FFFFFF` | Fond des cartes / surfaces élevées |
| `slate-100` | `#ECEEF4` | Fond des champs, survol, chips |
| `slate-200` | `#DEE1EA` | Bordures |
| `slate-300` | `#C7CBD9` | Bordures accentuées, séparateurs actifs |
| `slate-500` | `#8A8FA3` | Texte tertiaire, placeholders |
| `slate-600` | `#5C6178` | Texte secondaire |
| `slate-900` | `#1B1E2B` | Texte principal |

### 3.6 Neutres — mode sombre (« Ardoise »)

| Token | Valeur | Usage |
|---|---|---|
| `bg-page` | `#10121B` | Fond de page |
| `bg-elevated` | `#181B28` | Fond des cartes |
| `bg-subtle` | `#20243A` | Fond des champs, survol |
| `border` | `#2B2F42` | Bordures |
| `border-strong` | `#3A3F58` | Bordures accentuées |
| `text-primary` | `#F1F2F7` | Texte principal |
| `text-secondary` | `#A6ABC2` | Texte secondaire |
| `text-tertiary` | `#6E738C` | Texte tertiaire |

> **Règle d'implémentation :** tous les tokens sont exposés en variables CSS (`--bg-page`, `--text-primary`, `--role-accent`, etc.) recalculées par deux attributs sur `<html>` : `data-theme="light|dark"` et `data-role="admin|teacher"`. Aucune couleur n'est codée en dur dans les composants — voir §11 pour la transposition en thème Ant Design / configuration Tailwind.

---

## 4. Espacement, rayons, élévation, mouvement

**Échelle d'espacement** (base 4px) : `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Les cartes utilisent un padding de 16–20px ; les sections de page un intervalle de 18–24px.

**Rayons de bordure**

| Token | Valeur | Usage |
|---|---|---|
| `radius-sm` | 8px | Champs, badges rectangulaires |
| `radius-md` | 14px | Boutons, chips de filtre |
| `radius-lg` | 20px | Cartes, modales, tiroirs |
| `radius-full` | 999px | Avatars, pastilles, barre de recherche |

**Élévation** — ombres subtiles en mode clair, quasi absentes en mode sombre (compensées par un fond légèrement plus clair `bg-elevated` + bordure `1px`) :

| Token | Clair | Sombre |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(23,31,63,.06)` | `0 1px 2px rgba(0,0,0,.4)` |
| `shadow-md` (carte au survol) | `0 4px 16px -4px rgba(23,31,63,.10)` | `0 6px 20px -4px rgba(0,0,0,.5)` |
| `shadow-lg` (modale, tiroir, toast) | `0 16px 40px -12px rgba(23,31,63,.20)` | `0 24px 48px -12px rgba(0,0,0,.65)` |

**Mouvement** — trois durées, deux courbes :

| Token | Valeur | Utilisation |
|---|---|---|
| `dur-fast` | 120ms | Survol de bouton, bascule de chip |
| `dur-base` | 200ms | Ouverture de menu, changement de thème |
| `dur-slow` | 320ms | Transition de vue, apparition de tiroir/modale |
| `ease-out` | `cubic-bezier(.16,1,.3,1)` | Toute entrée d'élément (carte, vue, toast) |
| `ease-in-out` | `cubic-bezier(.4,0,.2,1)` | Bascules d'état (thème, ouverture de panneau) |

Micro-interactions retenues : légère élévation + translation `-2px` au survol des cartes cliquables ; apparition en cascade (délai croissant de 30ms) des grilles de cartes ; shimmer sur les squelettes de chargement ; toasts qui glissent depuis le bas-droit et se dissolvent après ~2,8s ; `prefers-reduced-motion` respecté (durées ramenées à ~0).


---

## 5. Catalogue de composants

Chaque composant hérite des tokens ci-dessus. Les états sont systématiques : `default → hover → active/pressed → focus-visible → disabled`.

### 5.1 Boutons

| Variante | Usage | Défaut | Survol | Actif | Désactivé |
|---|---|---|---|---|---|
| `btn-primary` | Action principale de l'écran (1 par vue) | fond `ink-600`/`green-600` selon rôle, texte blanc | assombrit 8%, élévation `shadow-sm` | assombrit 14%, translation 0 | fond `slate-200`/`bg-elevated`, texte `text-tertiary`, curseur non autorisé |
| `btn-secondary` | Action alternative | fond `slate-100`/`bg-elevated`, texte `text-primary`, bordure 1px | fond légèrement plus soutenu | idem + bordure accent | opacité 45% |
| `btn-ghost` | Action tertiaire, dans les toolbars | transparent, texte `text-secondary` | fond `slate-100`/`bg-elevated` à 60% | fond à 100% | texte `text-tertiary`, pas de fond au survol |
| `btn-outline` | Filtre actif/inactif, bascules | bordure accent, texte accent, fond transparent | fond accent à 8% | fond accent à 14% | bordure `slate-200` |
| `btn-danger` | Suppression, refus | fond `danger-600`, texte blanc | assombrit 8% | assombrit 14% | opacité 45% |

Focus clavier : anneau `2px` couleur accent du rôle, décalé de `2px` (`outline-offset`), visible uniquement en navigation clavier (`:focus-visible`, jamais au clic souris).

Tailles : `sm` (32px, listes/toolbars denses), `md` (40px, défaut), `lg` (48px, actions pleine largeur mobile — ex. « Enregistrer l'appel »).

### 5.2 Champs de formulaire

- **Texte / nombre / recherche** : hauteur 40px (48px sur mobile), bordure 1px `slate-300`/`border-subtle`, radius `radius-sm`. Focus : bordure accent + halo `0 0 0 3px` accent à 12% d'opacité. Erreur : bordure `danger-600` + message sous le champ en `danger-700`/`danger-400`, icône d'alerte.
- **Select / Date picker** : même habillage que les champs texte ; le menu déroulant reprend `shadow-lg`, `radius-md`, apparition `dur-base` + léger `translateY(-4px)→0`.
- **Recherche globale** : forme pilule (`radius-full`), icône loupe à gauche, raccourci clavier affiché à droite (`/` ou `⌘K`) sur desktop uniquement.
- **Saisie de note (grades)** : champ compact `64px` de large, alignement à droite, police `font-mono`, validation en direct (rouge si hors barème, vert bref au blur si valide) — voir §9.5.

### 5.3 Badges de statut

Forme pilule, texte en majuscule légère, fond teinté à 12% de la couleur sémantique, texte à la couleur pleine (700 en clair, 400 en sombre) :

| Statut | Couleur | Exemples d'usage |
|---|---|---|
| Succès / Actif / Présent | `success` | Inscription validée, élève présent, année en cours |
| Attention / En attente | `warning` (Ambre-Craie) | Inscription en attente, retard, note manquante |
| Danger / Absent / Annulé | `danger` | Absence non justifiée, créneau annulé, sanction |
| Information / Neutre | `info` | Nouveau, brouillon, non assigné |
| Neutre gris | `slate-500`/`text-tertiary` | Archivé, inactif |

### 5.4 Cartes

- **Carte standard** (`.card`) : fond `bg-surface`, radius `radius-lg`, `shadow-sm`, padding 20px (16px mobile).
- **Carte à languette** (`.card-accent`) : ajoute la languette signature de 4px en haut à gauche, couleur = accent du rôle par défaut, ou couleur sémantique pour signaler un état (ex. languette ambre = action requise).
- **Carte interactive** (`.card-hover`) : au survol, `shadow-md` + `translateY(-2px)`, transition `dur-fast ease-out`. Curseur pointer. Utilisée pour toute carte cliquable (fiche élève, classe, créneau).
- **Stat-card** (tableau de bord) : grand chiffre en `font-display` ou `font-mono` selon nature (effectif = display, moyenne = mono), libellé en `text-secondary`, variation (▲/▼) en couleur sémantique, icône de contexte en haut à droite dans un médaillon `radius-full` teinté.

### 5.5 États vides

Icône ou illustration simple (trait fin, une seule couleur `text-tertiary`), titre court en `font-display`, phrase d'aide en `text-secondary`, un seul bouton d'action primaire. Jamais de mur de texte. Exemple : liste d'élèves filtrée sans résultat → « Aucun élève ne correspond à ces filtres » + bouton « Réinitialiser les filtres ».

### 5.6 Squelettes de chargement (skeletons)

Blocs `radius-sm`/`radius-lg` selon le composant remplacé, fond `slate-200`/`bg-elevated`, animation shimmer diagonale continue (`dur-slow` en boucle), amplitude discrète pour ne pas distraire. Toujours calqués sur la forme exacte du contenu final (pas de placeholder générique) pour éviter le saut de mise en page.

### 5.7 Onglets (tabs)

Soulignement animé (`translateX` + largeur, `dur-base ease-in-out`) plutôt que fond plein, pour rester léger visuellement dans les tiroirs de détail (fiche élève : Profil / Parents / Notes / Présences).

### 5.8 Tiroir (drawer) & modale

- **Tiroir** : glisse depuis la droite (desktop/tablette) ou occupe l'écran entier (mobile), `shadow-lg`, fermeture par croix, clic en dehors, ou touche `Échap`. Utilisé pour les fiches de détail (élève, enseignant) — évite de quitter le contexte de la liste.
- **Modale** : centrée, largeur contrainte (480–640px), utilisée pour les actions courtes et bloquantes (confirmation de suppression, aperçu de bulletin, création d'inscription multi-étapes).
- Fond assombri (`scrim`) commun aux deux : noir à 40% (clair) / à 60% (sombre), apparition en fondu `dur-base`.

### 5.9 Notifications (toasts)

Ancrées en bas à droite (desktop/tablette) ou pleine largeur en bas au-dessus de la tabbar (mobile). Icône + message court + action optionnelle (« Annuler »). Auto-dismiss ~2,8s sauf variante erreur (reste jusqu'à fermeture manuelle). Une seule notification visible à la fois ; empilement discret si plusieurs (max 3, les plus anciennes s'estompent en arrière-plan).

### 5.10 Kanban (inscriptions)

Colonnes = statuts du pipeline d'inscription, en-tête de colonne avec compteur, cartes candidates avec languette colorée = statut. Colonne vide : état vide compact (icône + « Aucune candidature ici »), jamais un simple espace blanc. Glisser-déposer optionnel en v2 ; en v1, changement de statut via menu contextuel sur la carte (plus robuste sur tablette tactile).

### 5.11 Grille d'emploi du temps & agenda mobile

- **Desktop/tablette** : grille jours × créneaux horaires, cellule = carte compacte (matière, enseignant ou classe selon le point de vue, salle). Créneau annulé/exception : remplissage hachuré rouge translucide + badge « Annulé »/« Modifié », sans faire disparaître l'information d'origine (barrée plutôt que masquée).
- **Mobile** : grille remplacée par une liste chronologique du jour sélectionné (sélecteur de date en haut, type « chips » des 7 jours), chaque créneau = une carte pleine largeur.

### 5.12 Présence (attendance)

Grille de vignettes élève (photo/initiales + nom), trois boutons tactiles par ligne — Présent / Retard / Absent — cible ≥44px, sélection = remplissage couleur sémantique immédiat (pas de confirmation intermédiaire). Compteurs live en haut de l'écran (Présents/Retards/Absents). Bouton d'action flottant persistant « Enregistrer l'appel », toujours visible même en défilement.

### 5.13 Saisie de notes

Une ligne par élève (et non un tableau dense type tableur) : nom, champ de note en `font-mono`, moyenne de la matière recalculée en direct dans l'en-tête de colonne, indicateur de sauvegarde discret (icône qui passe de « en cours » à « coché ») à côté de chaque ligne modifiée. Navigation clavier : `Tab`/`Entrée` passe au champ suivant sans quitter le clavier, `Échap` annule la valeur en cours de saisie.


---

## 6. Iconographie

Le prototype utilise un jeu d'une trentaine d'icônes dessinées à la main (trait fin `1.7px`, angles arrondis, grille de base 24×24) pour rester dans l'esprit « dessin à l'encre » du concept plutôt que d'importer une librairie générique.

**Recommandation pour l'implémentation (Claude Code)** : ne pas redessiner les icônes à la main en production — reprendre une librairie en ligne (trait fin, coins arrondis, cohérente avec l'esprit du prototype) et l'intégrer telle quelle. Elle offre un jeu large, un poids visuel proche de ce qui a été prototypé, et s'intègre nativement à React. Vérifier le nom exact du paquet et la version compatible avec la stack au moment de l'implémentation plutôt que de se fier à une version mémorisée.

Règles d'usage :
- Taille par défaut `20px` dans les listes/formulaires, `24px` dans la navigation, `16px` dans les badges/chips.
- Épaisseur de trait constante, jamais de remplissage plein sauf pour les icônes d'état critique (alerte, erreur) où un léger remplissage améliore la reconnaissance rapide.
- Couleur héritée du texte environnant par défaut (`currentColor`) ; teintée uniquement dans les médaillons de stat-card ou les badges.

---

## 7. Grille responsive & adaptations par breakpoint

Le principe directeur : **pas de reflow simple**. Chaque palier change la structure de navigation et, pour les écrans denses (emploi du temps, présence), la représentation même de la donnée.

| Breakpoint | Plage | Navigation | Contenu |
|---|---|---|---|
| **Desktop** | > 1024px | Sidebar fixe complète (240px, libellés + icônes), barre supérieure avec recherche globale, sélecteur d'année, profil | Grilles multi-colonnes (2 à 4 colonnes de cartes selon densité), emploi du temps en grille complète, tiroirs de détail en panneau latéral |
| **Tablette** | 641–1024px | Sidebar réduite à un rail d'icônes seules (78px, tooltip au survol/appui long) | Grilles à 1–2 colonnes, emploi du temps en grille compressée (créneaux du jour visibles, défilement horizontal pour la semaine), présence en grille 2 colonnes de vignettes |
| **Mobile** | ≤ 640px | Sidebar transformée en tiroir plein-écran (accessible via icône burger) + barre d'onglets fixe en bas (4–5 raccourcis les plus fréquents par rôle) | Cartes en 1 colonne, emploi du temps en liste agenda journalière avec sélecteur de date, présence en liste verticale à vignette large, saisie de notes en cartes empilées (une par élève) plutôt qu'en lignes de tableau |

Règles transverses :
- Cibles tactiles ≥ 44×44px sur tablette et mobile, quel que soit le composant.
- Les actions principales (« Enregistrer l'appel », « Nouvelle inscription ») deviennent des boutons pleine largeur ancrés en bas d'écran sur mobile plutôt que des boutons en haut de page (zone de pouce).
- Les tableaux denses (liste d'élèves en vue « liste ») se transforment en cartes à partir de la tablette portrait ; la bascule grille/liste reste disponible sur desktop uniquement.
- Le sélecteur de rôle et de thème (convenances de démonstration du prototype) ne font pas partie de la navigation de production — voir §13.

---

## 8. Accessibilité

- **Contraste** : toutes les paires texte/fond du design system respectent un ratio minimum de 4.5:1 pour le texte courant et 3:1 pour le texte large/les icônes porteuses de sens, en clair comme en sombre — à vérifier composant par composant lors de l'implémentation, en particulier pour le texte sur fond `amber-500` (accent chaud) qui demande un texte foncé plutôt que blanc.
- **Focus visible** : anneau `2px` systématique en navigation clavier (`:focus-visible`), jamais supprimé (pas de `outline: none` sans remplacement).
- **Cibles tactiles** : ≥ 44×44px sur tous les éléments interactifs en tablette/mobile ; ≥ 32px acceptable sur desktop pour les actions secondaires denses (icônes de toolbar).
- **Présence & notes (parcours à haute fréquence)** : entièrement opérables au clavier — `Tab` pour circuler entre les champs/boutons, `Entrée`/`Espace` pour valider un statut de présence, flèches haut/bas pour naviguer entre les lignes de notes sans sortir du champ.
- **Lecteurs d'écran** : badges de statut et icônes seules toujours doublés d'un texte accessible (`aria-label` ou texte visible caché), les toasts annoncés en zone live polie (`aria-live="polite"`), les erreurs de formulaire associées au champ via `aria-describedby`.
- **Mouvement réduit** : `prefers-reduced-motion: reduce` ramène toutes les transitions à ~0ms (pas de désactivation totale des retours visuels, seulement de leur animation).
- **Mode sombre** : n'est pas qu'une inversion de couleurs — les ombres sont réduites au profit de bordures et d'un fond légèrement surélevé (`bg-elevated`), pour conserver la lisibilité de la hiérarchie de profondeur sans halos lumineux disproportionnés.


---

## 9. Spécification détaillée des 7 écrans prioritaires

Pour chaque écran : composition visuelle, interactions clés, et **mapping vers les endpoints réels** identifiés dans l'inventaire fonctionnel (routeurs « module courant » privilégiés quand un doublon legacy existe).

### 9.1 Tableau de bord Administrateur

- **Composition** : rangée de stat-cards (effectif élèves, enseignants, classes, taux de présence du jour), bloc « Activité récente » (flux chronologique), bloc « Répartition des effectifs » (par classe ou par niveau), raccourcis d'actions fréquentes (nouvelle inscription, nouvel élève, nouvelle affectation).
- **Interactions** : chaque stat-card est cliquable et renvoie vers le module correspondant ; le flux d'activité se rafraîchit sans rechargement de page (placeholder de polling/WebSocket à confirmer côté implémentation).
- **Endpoints** : `GET /dashboard/stats` (chiffres des stat-cards), `GET /dashboard/activities` (flux d'activité récente).

### 9.2 Tableau de bord Enseignant

- **Composition** : bloc « Mes cours du jour » (créneaux issus de l'emploi du temps personnel), raccourcis d'action (Faire l'appel, Saisir des notes), bloc « À traiter » (notes manquantes, absences non justifiées à traiter).
- **Interactions** : chaque carte de cours du jour propose deux actions directes (Présence / Notes) sans passer par un menu.
- **Endpoints** : `GET /teachers/me/info` (identité), `GET /teachers/me/timetable` (cours du jour), `GET /teachers/me/assignments` (classes/matières affectées), `GET /dashboard/activities` filtré sur l'enseignant si le back-end le permet (à confirmer — sinon calcul côté front à partir des affectations).

### 9.3 Liste des élèves + fiche détail

- **Composition** : barre de recherche + filtres (classe, statut), bascule affichage grille/liste, cartes élève (photo/initiales, nom, classe, badge de statut) ; clic → tiroir de fiche détail à onglets **Profil / Parents / Notes / Présences**.
- **Interactions** : recherche instantanée (debounce ~300ms), squelettes de cartes pendant le chargement, état vide soigné si aucun résultat.
- **Endpoints** : `GET /schoolStudents` (liste + filtres), `GET /schoolStudents/:id` (fiche), `POST` / `PUT /schoolStudents/:id` (création/édition), `DELETE /schoolStudents/:id` (réservé `ADMIN`), `POST /schoolStudents/:id/parents` et `DELETE /schoolStudents/:id/parents/:parentId` (onglet Parents), `GET /schoolStudents/stats/overview` (compteurs de la liste).
- **Point d'attention** : l'upload d'avatar (`POST /:id/avatar`) n'existe aujourd'hui que sur le routeur legacy `students.ts`, pas sur `schoolStudents.ts`. Si l'upload de photo est conservé dans la nouvelle UI, le clarifier côté back-end avant l'implémentation (ajouter la route au module courant plutôt que de rebrancher l'UI sur le routeur legacy).

### 9.4 Emploi du temps (vue grille + exceptions)

- **Composition** : grille jours × créneaux (desktop/tablette) ou agenda journalier (mobile), bascule de point de vue **par classe** / **par enseignant** (admin), exceptions (annulation, déplacement) visuellement distinctes (hachure rouge translucide + badge), panneau de détail au clic sur un créneau.
- **Interactions** : création/édition d'une exception via modale courte (motif, nouveau créneau éventuel).
- **Endpoints** : `GET /schedules/class/:classId/timetable` et `GET /schedules/teacher/:teacherId/timetable` (grille selon le point de vue), CRUD `exceptions` du routeur `schedules.ts` (création/édition/suppression d'une exception).
- **Point d'attention** : ne pas utiliser `timetables.ts` — ce routeur est aujourd'hui **public (aucun middleware d'authentification)** et fait doublon avec `schedules.ts`, qui porte la logique d'exceptions attendue par cet écran.

### 9.5 Saisie des notes / bulletin

- **Composition** : sélection classe + matière + type d'évaluation en en-tête, liste d'élèves en lignes-cartes avec champ de note (`font-mono`), moyenne de la matière recalculée en direct, indicateur de sauvegarde par ligne, bouton « Aperçu du bulletin » ouvrant une modale de prévisualisation avant export PDF.
- **Interactions** : navigation clavier `Tab`/`Entrée` entre les champs (parcours le plus fréquent de l'enseignant, doit se faire sans souris), sauvegarde individuelle par ligne (pas de bouton « Enregistrer » global qui bloquerait tout le formulaire en cas d'erreur sur une seule ligne).
- **Endpoints** : `GET /grades/teacher/:teacherId/assignments` (classes/matières de l'enseignant, pour peupler les sélecteurs), `GET /grades` (notes existantes, filtrées), `POST` / `PATCH /grades/:id` (saisie/édition d'une note), `GET /grades/complete-averages/pdf`, `GET /grades/class-grades-by-subject/pdf`, `GET /grades/student-bulletin/pdf` (les trois exports PDF proposés depuis la modale d'aperçu selon le contexte : classe entière, par matière, ou bulletin individuel).

### 9.6 Prise de présence (mobile/tablette en priorité)

- **Composition** : en-tête compact (classe, date, compteurs live Présents/Retards/Absents), grille de vignettes élève avec trois boutons tactiles Présent/Retard/Absent, bouton flottant persistant « Enregistrer l'appel ».
- **Interactions** : un seul appui suffit par élève (pas de confirmation intermédiaire), retour visuel immédiat (remplissage coloré + micro-animation de coche), sauvegarde groupée en un seul envoi au clic sur le bouton flottant.
- **Endpoints** : `GET /attendances/class/:classId` (roster + statuts existants du jour), `POST /attendances/batch` (envoi groupé de l'appel), `GET /attendances/stats` (indicateurs éventuels du tableau de bord).
- **Point d'attention** : la garde de rôle actuelle sur `POST /attendances/batch` référence un rôle `'ENSEIGNANT'` qui **n'existe pas** dans l'énumération réelle (`TEACHER`) — en l'état, seul `ADMIN` peut réellement valider un appel. À signaler côté back-end ; la conception UI part du principe que ce sera corrigé (le bouton « Enregistrer l'appel » doit être actif pour un compte enseignant en production).

### 9.7 Gestion des inscriptions

- **Composition** : vue kanban par statut du pipeline, en-tête de colonne avec compteur, cartes candidature (nom, classe visée, badge de statut), bouton « Nouvelle inscription » ouvrant une modale de création multi-étapes.
- **Interactions** : changement de statut via menu contextuel sur la carte (plus fiable que le glisser-déposer sur tablette tactile en environnement scolaire), colonnes vides avec état vide compact plutôt qu'un espace blanc.
- **Endpoints** : `GET /inscriptions` (cartes par colonne), `GET /inscriptions/statistics` (compteurs d'en-tête de colonne, indicateurs de tableau de bord), `GET /inscriptions/:id` (détail au clic), `POST /inscriptions` (création), `PATCH /inscriptions/:id` (changement de statut), `DELETE /inscriptions/:id` — écritures réservées `ADMIN` selon l'inventaire.


---

## 10. Extension aux modules non détaillés

Tous les modules listés dans l'inventaire mais non couverts par les 7 écrans prioritaires (Parents, Enseignants — fiche & gestion, Années scolaires, Salles de classe, Classes, Matières, Classe↔matière, Coefficients, Affectations matières/enseignants, Professeurs principaux, Types d'évaluation, Trimestres, Discipline, Documents, Paramètres établissement, Utilisateurs) réutilisent le même patron sans exception :

- Liste en cartes (grille responsive identique à §9.3), jamais de tableau HTML brut par défaut — l'affichage en tableau dense reste une bascule optionnelle sur desktop pour les modules très tabulaires (ex. Coefficients, qui croise classes × matières).
- Recherche + filtres visibles en en-tête, squelettes de chargement calqués sur la forme des cartes.
- Détail/édition en tiroir latéral (desktop/tablette) ou plein écran (mobile), jamais de navigation vers une page séparée pour une simple édition.
- Badges de statut sémantiques partout où une notion d'état existe (actif/inactif, validé/en attente).
- Un seul bouton d'action primaire par écran, actions secondaires en `btn-ghost` dans une toolbar.

Cas particuliers à noter pour l'implémentation :
- **Coefficients** bénéficie d'une vue croisée classe/matière — envisager une grille éditable plutôt que des cartes individuelles, avec le même style de champ que la saisie de notes (`font-mono`, validation en direct), et une action de mise à jour en lot (`POST /coefficients/class/:classId/batch` existe déjà côté API).
- **Paramètres établissement** est un formulaire unique plutôt qu'une liste — conserver la structure en sections repliables (cartes) plutôt qu'un long formulaire continu.

---

## 11. Différenciation Admin / Enseignant — résumé

La différenciation reste **légère et cohérente**, jamais une interface parallèle :

- **Accent de rôle** : Bleu-Encre pour tout ce qui est piloté par `data-role="admin"`, Vert-Tableau pour `data-role="teacher"` — appliqué à la languette des cartes, aux boutons primaires, au logo/badge de la sidebar, à l'anneau de focus.
- **Navigation** : structure identique (sidebar + topbar desktop, rail d'icônes tablette, tiroir + tabbar mobile), contenu du menu strictement aligné sur §6.1/6.2 de l'inventaire — pas de fonctionnalité inventée, pas de fonctionnalité omise.
- **Densité** : l'espace Enseignant est volontairement plus orienté « action rapide » (moins de tableaux de gestion, plus de raccourcis vers Présence/Notes), l'espace Admin plus orienté « supervision et configuration ».
- **Composants partagés à 100%** : boutons, cartes, badges, modales, toasts, skeletons — aucun composant dupliqué ou restylé par rôle, seule la teinte d'accent change via les variables CSS.

---

## 12. Handoff technique pour Claude Code

### 12.1 Vers Tailwind (`tailwind.config.js`)

Faire correspondre chaque token du design system à `theme.extend` plutôt que d'utiliser les classes de couleur par défaut de Tailwind :

```js
theme: {
  extend: {
    colors: {
      ink:   { 50: '...', 400: '#647DC5', 600: '#34478F', 700: '...' },
      green: { 50: '...', 400: '#4FAE85', 600: '#217A54', 700: '...' },
      amber: { 50: '...', 500: '#E8A33D', 600: '...', 700: '...' },
      success: { /* échelle complète */ },
      danger:  { /* échelle complète */ },
      info:    { /* échelle complète */ },
      slate:   { /* neutres « Papier » clair */ },
      // neutres « Ardoise » sombre exposés séparément ou via data-theme + CSS vars
    },
    fontFamily: {
      display: ['"Space Grotesk"', 'sans-serif'],
      body: ['Inter', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'monospace'],
    },
    borderRadius: { sm: '8px', md: '14px', lg: '20px', full: '999px' },
    boxShadow: {
      sm: '0 1px 2px rgba(23,31,63,.06)',
      md: '0 4px 16px -4px rgba(23,31,63,.10)',
      lg: '0 16px 40px -12px rgba(23,31,63,.20)',
    },
    transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },
  },
}
```

Le mode sombre et la bascule de rôle restent pilotés par les attributs `data-theme`/`data-role` sur `<html>` avec des variables CSS recalculées (voir prototype), pas par la variante `dark:` de Tailwind seule — car la teinte d'accent doit aussi varier par rôle, ce que Tailwind ne gère pas nativement en une seule classe.

### 12.2 Vers Ant Design 5 (`ConfigProvider`)

```js
import { ConfigProvider, theme as antdTheme } from 'antd';

<ConfigProvider
  theme={{
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: role === 'admin' ? '#34478F' : '#217A54',
      colorSuccess: '#1E8E5A', // valeur success-600 de l'échelle
      colorWarning: '#E8A33D',
      colorError: '#C4433D',   // valeur danger-600 de l'échelle
      colorInfo: '#3E7CB1',    // valeur info-600 de l'échelle
      borderRadius: 14,
      fontFamily: 'Inter, sans-serif',
    },
  }}
>
  {/* app */}
</ConfigProvider>
```

Les composants Ant Design restent la base fonctionnelle (Table, DatePicker, Upload, Form) mais sont systématiquement enrobés des styles du design system (cartes, badges, boutons) plutôt qu'utilisés avec leur apparence par défaut — c'est précisément ce que le design cherche à corriger (§ objectif 1 de la demande initiale : éviter les patterns Ant Design non personnalisés).

### 12.3 Priorité d'implémentation suggérée

1. Tokens globaux (couleurs, typographie, espacements) + bascule thème/rôle.
2. Composants de base (bouton, carte, badge, input, skeleton).
3. Navigation (sidebar desktop → rail tablette → tiroir+tabbar mobile).
4. Écran Présence (le plus contraint mobile, valide les cibles tactiles et le flux hors-ligne éventuel).
5. Écran Notes (le plus fréquent, valide la navigation clavier).
6. Reste des écrans prioritaires, puis extension aux modules restants (§10).

---

## 13. Points d'attention techniques à garder en tête côté UX

Ces éléments viennent de l'inventaire fonctionnel et n'affectent pas directement le visuel, mais conditionnent des choix d'interaction ou méritent d'être signalés avant l'implémentation :

- **Routeurs sans authentification** (`classrooms.ts`, `timetables.ts`) : l'UI ne doit pas laisser supposer que ces données sont protégées ; à corriger côté API en parallèle de l'implémentation front plutôt que de concevoir l'UI autour d'un contournement.
- **Incohérence de rôles FR/EN** : plusieurs gardes de rôle référencent `'ENSEIGNANT'` ou `'SECRETARY'`, absents de l'énumération réelle (`ADMIN`, `TEACHER`, `ACCOUNTANT`, `STUDENT`, `PARENT`). L'UI utilise partout les libellés canoniques anglais en interne (mapping vers un libellé affiché « Enseignant », « Comptable », etc. en français côté présentation uniquement) pour ne pas reproduire la confusion dans le nouveau front.
- **Doublons legacy / module courant** : pour Élèves, Classes, Matières et Parents, l'UI cible exclusivement les routeurs « module courant » (`schoolStudents`, `schoolClasses`, `schoolSubjects`, `schoolParents`) déjà utilisés par le front actuel — ne pas rebrancher par erreur sur les routeurs legacy homonymes.
- **Sélecteur de rôle / thème dans le prototype** : le bouton de bascule rôle et le bouton de bascule thème visibles dans `horizonecole-prototype.html` sont des **convenances de démonstration** pour naviguer les deux univers dans un seul fichier. En production, le rôle vient de la session authentifiée (pas de sélecteur), seul le bouton thème clair/sombre est conservé.

---

## 14. Fichiers livrés

- **`horizonecole-prototype.html`** — prototype interactif autonome (HTML/CSS/JS vanilla, sans build), à ouvrir directement dans un navigateur. Couvre les 7 écrans prioritaires, la navigation complète par rôle, les 3 paliers responsive, le clair/sombre et le switch de rôle de démonstration. Sert de référence visuelle et comportementale — pas de code à réutiliser tel quel, mais chaque valeur de token, chaque timing d'animation et chaque structure de navigation y est fidèlement implémenté et peut être inspecté directement (survoler, redimensionner la fenêtre, changer de thème/rôle).
- **`design-system-horizonecole.md`** (ce document) — référence écrite complète : tokens, composants, responsive, accessibilité, spécification écran par écran avec mapping vers les endpoints réels, et handoff technique Tailwind/Ant Design pour Claude Code.
