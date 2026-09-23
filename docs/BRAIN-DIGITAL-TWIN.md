# Mon Cerveau — jumeau numérique cognitif

## Mission

`/brain` est la représentation visible, explicable et actionnable du jumeau cognitif de l’utilisateur. Il compose les moteurs existants sans les remplacer : concepts, relations, maîtrise FSRS, Learning DNA, profil comportemental, mémoire, parcours et prédictions.

La vue ne crée aucune donnée cognitive. Une information inconnue reste inconnue ; en particulier, une maîtrise absente n’est jamais affichée comme `0 %`.

## Architecture de l’expérience

Les vues internes sont :

- **Vue globale** : état actuel, prochaine action, forces/fragilités, mémoire et tendances utiles ;
- **Connaissances** : liste accessible, carte bornée, recherche et inspecteur de concept ;
- **Comment j’apprends** : préférences déclarées, comportements observés et Learning DNA clairement séparés ;
- **Mémoire** : activité de révision, concepts fragiles et transition vers Réviser ;
- **Historique** : timeline paginée d’événements réellement persistés.

Les anciennes routes restent compatibles et redirigent vers ces vues :

| Route historique | Vue Brain |
| --- | --- |
| `/twin-profile`, `/learning-dna` | Comment j’apprends |
| `/memory` | Mémoire |
| `/mastery`, `/graph` | Connaissances |
| `/strengths`, `/insights`, `/insights-center`, `/foresight`, `/predictions` | Vue globale |

## Contrats API

- `GET /api/brain/overview` : agrégat partiellement dégradable ;
- `GET /api/brain/graph?limit&cursor&q&documentId` : projection bornée et filtrable ;
- `GET /api/brain/concepts/:id` : inspecteur d’un concept appartenant à l’utilisateur ;
- `GET /api/brain/search?q&limit&cursor` : recherche bornée dans concepts, documents et objectifs ;
- `POST /api/brain/ask` : réponse déterministe fondée uniquement sur les données personnelles persistées ;
- `GET /api/memory/page?limit&cursor` : timeline bornée, plus ancienne à chaque curseur.

Chaque requête de domaine porte le `userId` authentifié. Les résultats de recherche et l’inspecteur ne peuvent pas retourner un objet appartenant à un autre utilisateur.

## Maturité des données

La maturité change la composition, jamais les données :

- `SPARSE` : moins de 10 concepts, moins de 5 relations et moins de 10 événements ;
- `MEDIUM` : au moins 10 concepts, 5 relations ou 10 événements ;
- `DENSE` : au moins 100 concepts et au moins 50 relations ou 100 événements.

En `SPARSE`, l’écran montre les premiers concepts, les sources et activités récentes, puis propose Apprendre, Importer et définir un objectif. Il ne rend ni graphe vide, ni moyenne artificielle, ni prévision prématurée.

## Statuts et maîtrise

Le helper partagé `classifyLearningStatus` centralise la règle déjà utilisée par le parcours :

- `mastered` : maîtrise FSRS supérieure ou égale à `0,8` ;
- `at_risk` : concept déjà révisé avec une carte due ou une maîtrise inférieure à `0,5` ;
- `in_progress` : concept déjà révisé, sans signal de risque ;
- `blocked` : concept non commencé avec un prérequis non maîtrisé ;
- `ready` : concept non commencé sans prérequis bloquant.

La maîtrise elle-même reste calculée par `MasteryService` à partir de la récupérabilité FSRS. Aucun score n’est recalculé dans l’interface.

## Inspecteur de concept

`BrainConceptPanel` affiche, lorsqu’elles existent :

- description, statut et maîtrise ;
- nombre de cartes, révisions dues, stabilité FSRS moyenne mesurée et prochaine échéance ;
- documents sources via `SourceCitation` et `SourcePreview` ;
- relations persistées, avec direction et type ;
- interactions récentes bornées ;
- actions vers Professeur, Pratiquer et Réviser.

Les sources et relations sont limitées à 20 par réponse. Les flags `sourcesTruncated` et `relationsTruncated` empêchent de laisser croire que la liste est exhaustive.

## Préférences, observations et Learning DNA

- **Déclaré** vient exclusivement de l’onboarding (`preferences`, réglages du Professeur, matières et objectifs).
- **Observé** vient de `LearnerProfileService` et reste absent sous les seuils d’évidence propres au moteur.
- **Learning DNA** conserve ses niveaux de confiance et ses textes localisés par le backend. Il reste présenté comme une observation évolutive, jamais comme un diagnostic.

## Mémoire et évolution

La timeline agrège les leçons, exercices, révisions, conversations, devoirs, sessions terminées, documents importés, concepts créés et connexions persistées. Chaque source est lue avec `take = limit + 1`, triée, fusionnée puis paginée. La synthèse utilise des comptages SQL séparés au lieu de charger tout l’historique.

Les deltas après une session ne sont affichés que lorsque l’`ExperienceSession` contient un `twinImpact` réel. `ProgressNarrative` n’invente aucun avant/après : la notation `before → after` exige les deux valeurs.

## Foresight

Une prévision n’apparaît que si :

- le profil observé possède au moins 5 interactions ;
- le moteur fournit un risque modéré ou élevé ;
- une probabilité et au moins une raison existent.

L’interface l’étiquette explicitement « Prévision » et rappelle qu’il s’agit d’une estimation, non d’un fait.

## Interroger son cerveau

`POST /brain/ask` n’est pas un chatbot générique. Il reconnaît quelques intentions utiles (fragilités, connaissances délaissées, documents, sujet) et retourne uniquement des concepts/documents issus des services personnels. Sans preuve, la réponse est `no-results`. Le contrat contient `grounded: true` pour rendre cette garantie testable.

## Contextes et transitions

- Document → Brain : `documentId` filtre la projection aux concepts reliés et sélectionne le premier résultat réel ;
- Brain → Professeur : `conceptId`, `conceptName` et, le cas échéant, `documentId` sont conservés ;
- Professeur → Brain : le CTA n’existe que lorsqu’un impact réel est présent et transmet `sessionId`, `conceptId`, `documentId` et `goalId` disponibles ;
- Brain → Réviser : `conceptId` est conservé, sans refonte de Réviser ;
- source → Document Intelligence : le document est rouvert par son identifiant ;
- objectif : la recherche renvoie vers `/goals` avec `goalId`.

## Responsive et accessibilité

- mobile : liste/timeline en premier, carte opt-in, inspecteur dans un panneau modal sans animation imposée ;
- tablette : composition en une colonne, navigation interne horizontale ;
- desktop : carte ou liste à gauche, inspecteur contextuel à droite ;
- la liste textuelle est toujours disponible comme alternative au graphe ;
- chaque nœud et chaque résultat est actionnable au clavier et possède un libellé comprenant nom et statut ;
- statut = icône + texte + couleur ;
- la navigation interne expose `tablist`/`tab` et l’état sélectionné ;
- les mises à jour de réponse utilisent une région live ;
- aucune animation permanente ; le panneau mobile utilise `animationType="none"`.

## Cache, états partiels et erreurs

L’aperçu et la première projection sont mis en cache par utilisateur dans AsyncStorage. Si l’API est indisponible, `/brain` peut afficher la dernière version avec un badge stale et sa date. Une source d’agrégat en erreur marque seulement la section concernée comme indisponible ; les autres restent utilisables.

Le cache ne mélange jamais deux utilisateurs : sa clé contient l’identifiant de l’utilisateur authentifié.

## Performance et seuils

- projection API : défaut 40, maximum 100 nœuds ;
- recherche : défaut 12, maximum 20 résultats, curseur plafonné à 200 ;
- sources/relations d’un concept : maximum 20 ;
- historique : maximum 50 événements par page et par source ;
- aperçu : 8 événements récents, 4 documents récents, 5 étapes de parcours ;
- les arêtes du graphe sont uniquement celles dont les deux extrémités figurent dans la projection chargée ; aucune relation fictive n’est ajoutée.

Mesure locale du calcul de placement, 100 itérations, le 10 septembre 2026 :

| Nœuds | Arêtes synthétiques | Temps CPU moyen du placement |
| ---: | ---: | ---: |
| 0 | 0 | 0,005 ms |
| 1 | 0 | 0,024 ms |
| 10 | 18 | 0,088 ms |
| 100 | 198 | 0,316 ms |
| 500 | 998 | 2,700 ms |
| 1 000 | 1 998 | 3,367 ms |

Cette mesure couvre le calcul pur, pas le rendu React Native. Le moteur actuel dessine chaque nœud et chaque segment avec une `View`; son coût principal est donc le nombre d’éléments natifs. Le plafond de 100 protège le rendu actuel. Au-delà, la liste/recherche paginée est le parcours principal et le remplacement éventuel du moteur graphique reste une évolution indépendante.

## Dépendances backend identifiées

À très grande échelle, `MasteryService.strengthsWeaknesses`, `LearningPathService.next` et `LearnerProfileService.profile` lisent encore des ensembles complets pour calculer des signaux exacts. Le Lot 8 borne ce qui est envoyé et rendu, mais une volumétrie de plusieurs milliers de concepts nécessitera des agrégats matérialisés ou incrémentaux côté backend. Cette optimisation ne doit pas être simulée dans le client.

Les liens concept-document n’enregistrent pas encore de page ou d’extrait précis. `SourcePreview` peut donc afficher le document et sa matière, mais pas inventer un passage. Une future provenance fine exige un contrat backend reliant concept, chunk et localisation.

## Tests

Les tests Lot 8 couvrent :

- maturité à 0, 1, 10 et 100 concepts ;
- statut avec maîtrise inconnue ;
- seuils de maîtrise/risque existants ;
- dégradation partielle des sources ;
- isolation utilisateur et limite du graphe ;
- réponse Brain déterministe et fondée ;
- cache, alternative accessible, routes historiques et transition Tutor ;
- présence des chaînes FR/EN.

Le test manuel avec données réelles nécessite l’API, PostgreSQL, Redis et Qdrant. Aucun jeu de données n’est supprimé ou migré pour ce lot.
