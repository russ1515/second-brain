# Landing publique — Lot 12

## Périmètre

La Landing publique présente fidèlement les capacités issues des Lots 0 à 11 bis. Elle ne remplace aucun moteur métier et ne dépend d’aucune donnée utilisateur. Toutes les scènes visibles sont des démonstrations statiques, explicitement signalées comme telles.

Le récit central est :

`intention → action → contexte → expérience → résultat → prochaine action`.

La page expose ensuite le même produit sous une forme concrète :

`Documents → Mon Cerveau → Professeur IA → Oral & Voix → Réviser → Academic Workspace`.

## Architecture

`components/landing/landing-page.tsx` ne contient plus la totalité de la page. Il orchestre le document public, les ancres, les CTA d’authentification et le header responsive. Les responsabilités sont séparées comme suit :

- `landing-content.ts` : registres publics, étapes narratives, plateformes, présentation des plans, langues et contact configuré ;
- `landing-foundation.tsx` : primitives visuelles et transition sémantique partagées ;
- `hero-section.tsx` : promesse, CTA et première démonstration produit ;
- `product-story.tsx` : parcours interactif entre les six expériences principales ;
- `feature-experience.tsx` : hiérarchie des capacités et intelligence personnelle ;
- `language-experience.tsx` : démonstration RLLE et registre réel des 27 langues ;
- `supporting-sections.tsx` : fonctionnement, Next Best Action, appareils, confidentialité, offres, FAQ, contact, conclusion et footer ;
- `brain-viz.tsx` : représentation légère, sans moteur graphique ni dépendance d’animation.

La Landing continue d’être rendue par la route `/` existante lorsqu’aucune session n’est authentifiée et que `EXPO_PUBLIC_FEATURE_NEW_LANDING=true`. Si le flag est désactivé ou invalide, le visiteur revient vers l’authentification existante : le rollback n’altère ni les routes applicatives ni les données.

## Rollout et rollback

`newLanding` reste un flag de déploiement, distinct des offres commerciales. Il est désactivé par défaut dans `.env.example`, conformément au contrat des Lots 0–2. Une prévisualisation ou un futur déploiement contrôlé doit donc définir explicitement `EXPO_PUBLIC_FEATURE_NEW_LANDING=true` au moment du build Expo. Revenir à `false` restaure le point d’entrée d’authentification sans migration et sans suppression.

## Sources de vérité

La page n’entretient pas de copies commerciales ou linguistiques indépendantes :

- les langues et leurs symboles proviennent de `packages/shared/src/languages.ts` ;
- la démonstration de langue provient de `RLLE_LANDING_DEMO_BLUEPRINT` ;
- les offres publiques sont mappées vers les slugs backend `free`, `pro` et `pro_max` ;
- l’adresse de support est facultative et provient de `EXPO_PUBLIC_SUPPORT_EMAIL` ;
- les chaînes FR/EN passent par le catalogue i18n existant.

Les données du scénario de biologie et du scénario anglais B1 sont des exemples publics. Elles ne sont ni calculées, ni présentées comme des résultats réels.

## Vérité des promesses

| Promesse publique | Capacité correspondante |
| --- | --- |
| Comprendre ses documents | Bibliothèque et Document Intelligence |
| Relier ses connaissances | Mon Cerveau et graphe de connaissances |
| Apprendre avec un professeur personnel | Tutor, contexte et Experience Session |
| Parler et recevoir une correction lisible | couche Speech, transcription et fallback écrit |
| Consolider ce qui risque d’être oublié | Review, cartes et planification FSRS |
| Produire à partir de sources | Academic Workspace et citations |
| Savoir quoi faire ensuite | contrat Next Best Action |
| Apprendre une langue dans des situations réelles | cours structurés RLLE, World Missions, Repair Loop et Can-Do |

La Recherche est décrite comme une recherche dans Mon Cerveau et la Bibliothèque, avec citations lorsque les sources le permettent. Le provider Web externe étant désactivé dans l’état audité, la Landing ne le présente pas comme disponible.

## Démonstrations

Les démonstrations sont contrôlées par l’utilisateur au moyen d’étapes ou d’onglets. Elles n’utilisent aucun faux délai, aucun pourcentage et aucune boucle décorative :

- le Hero montre une intention, le contexte détecté, l’intervention pédagogique et une prochaine action ;
- Product Story montre le document, ses concepts, le Brain, le Professeur, la transcription orale, la révision et la réutilisation dans Workspace ;
- Language Experience rejoue les dix étapes du blueprint RLLE : objectif, cours, mission, conversation, difficulté persistable dans Mistake Memory, micro-leçon/Repair Loop, nouvelle tentative, vocabulaire, révision et progression fonctionnelle.

`StageTransition` n’est déclenché que par une action réelle du visiteur. Avec reduced motion, le contenu change sans animation.

## Plateformes et téléchargement

La présentation publique distingue explicitement trois statuts :

| Plateforme | Statut public du Lot 12 | Lien |
| --- | --- | --- |
| Web | disponible | authentification existante |
| Android | techniquement préparée avec Expo | aucun lien de store configuré |
| iOS | techniquement préparée avec Expo | aucun lien de store configuré |
| Windows | bientôt disponible | aucun lien |
| macOS | bientôt disponible | aucun lien |

Aucun bouton de téléchargement non fonctionnel n’est rendu comme un lien. La continuité multi-appareil est une représentation de l’expérience synchronisée, pas une promesse de présence actuelle dans un store.

## Free, Pro et Max

Le backend connaît les slugs `free`, `pro` et `pro_max`. La Landing les présente sous les libellés Free, Pro et Max via un registre unique.

- Free est présenté comme une offre gratuite existante ;
- Pro et Max sont présentés comme des offres dont la configuration commerciale finale reste à publier après la bêta ;
- seul Free expose un CTA de création de compte ; les cartes Pro et Max restent non transactionnelles tant que leur disponibilité publique n’est pas configurée ;
- aucun prix, quota, avantage, réduction ou période de facturation n’est inventé ;
- l’endpoint authentifié des plans reste la source de vérité pour les données configurées.

La configuration commerciale post-bêta devra alimenter prix, quotas réels, avantages et disponibilité sans dupliquer ces valeurs dans plusieurs sections.

## Contact

La Landing n’embarque pas de faux formulaire. Lorsque `EXPO_PUBLIC_SUPPORT_EMAIL` contient une adresse publique supervisée, le CTA ouvre le client de messagerie avec un sujet localisé. Sans cette variable, la page le signale et propose uniquement de se connecter à son compte, sans prétendre ouvrir un support, ni simuler un envoi ou un succès.

## Confidentialité, analytics et cookies

Le bloc de contrôle ne promet que les capacités inspectées : réglages de mémoire, gestion des documents, export et suppression avec confirmation. Il ne formule aucune garantie juridique supplémentaire.

Aucun analytics, tracker ou mécanisme de cookie n’est ajouté par le Lot 12. En conséquence, aucune bannière de consentement cosmétique n’est créée. Ce point devra être réévalué avant toute introduction future d’un outil de mesure.

## Responsive et accessibilité

- desktop : header complet, compositions en deux colonnes et chronologies horizontales ;
- tablette : sections recomposées, navigation dans un menu et démonstrations à largeur disponible ;
- mobile : Hero empilé, menu modal accessible, étapes scrollables horizontalement seulement dans leurs contrôles dédiés, cartes et flux en une colonne ;
- les interactions utilisent des rôles, labels, états `selected`/`expanded`, cibles tactiles et régions live pertinentes ;
- les contenus démonstratifs restent lisibles sans couleur, mouvement ou symboles décoratifs ;
- les noms de langue utilisent toujours le nom natif et, si utile, le nom localisé. Les drapeaux ne sont jamais l’unique information.

## SEO

`public/index.html` et la configuration Expo Web fournissent au shell SPA statique un titre, une description, les métadonnées Open Graph/Twitter, le viewport, l’indexabilité et le thème. `LandingPage` remplace les métadonnées textuelles avec leur version localisée après le démarrage de l’application et synchronise `lang`/`dir` sur le document.

Aucune URL canonique, image sociale ou identité d’entreprise n’est inventée en l’absence de domaine/asset public configuré.

## Performance

La Landing n’ajoute aucune dépendance, image distante, vidéo, canvas ou bibliothèque d’animation. Ses visuels sont composés avec React Native Web et les tokens existants. Les registres partagés empêchent de charger des données privées et le contenu interactif reste local.

Le poids de l’export Web doit être mesuré avant et après chaque évolution importante. Le point de référence avant Lot 12 est consigné dans le rapport du lot ; l’export généré reste un artefact de validation et non un déploiement.

## Validation attendue

- typecheck mobile et monorepo ;
- build et tests Shared/API ;
- export Expo Web ;
- navigation, ancres, CTA register/login, offres, FAQ, contact et footer ;
- rendu mobile étroit, mobile large, tablette, desktop et grand desktop ;
- catalogue FR/EN sans clés visibles ;
- contrôle clavier et reduced motion ;
- vérification `git diff --check` ;
- validation Prisma uniquement si un contrat de données est modifié (ce lot n’en ajoute aucun).

## Configuration restant après la bêta

- prix et périodicités publics de Pro et Max ;
- quotas et avantages définitifs des trois offres ;
- disponibilité commerciale des offres ;
- URLs vérifiées des stores Android/iOS ;
- stratégie et builds desktop Windows/macOS ;
- adresse de support publique supervisée ;
- domaine canonique et éventuel asset Open Graph ;
- pages légales publiques si elles sont validées et publiées ;
- analytics/consentement seulement si une solution réelle est retenue.
