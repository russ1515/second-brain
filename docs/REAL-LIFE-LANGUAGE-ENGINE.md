# Cours de langue et Real Life Language Engine

## Périmètre

Le Real Life Language Engine (`RLLE`) complète le Lot 11. Il transforme l’espace Langues en cours structuré et adaptatif sans créer un second moteur pédagogique.

RLLE orchestre les capacités existantes :

- `LanguageProfile` pour la langue, le niveau déclaré et l’objectif ;
- `Lesson` pour les leçons persistées ;
- Tutor et le Professeur IA pour enseigner, expliquer, simuler et corriger ;
- Speech pour la transcription et la restitution vocale ;
- les cartes et FSRS pour la mémorisation ;
- Review pour la consolidation ;
- `ExperienceSession` pour le contexte, la reprise et les productions ;
- Brain uniquement lorsque des traces réelles peuvent être exposées.

Le moteur ne modifie pas la Landing et ne prépare que des contrats et états réutilisables pour une démonstration future fidèle.

## Sources de vérité

Le registre statique partagé `packages/shared/src/real-life-language.ts` définit :

- les niveaux CECRL A1 à C2 ;
- les onze axes du curriculum ;
- les unités ordonnées ;
- les World Missions ;
- les stratégies de communication de survie ;
- la Can-Do Map ;
- les catégories de gap ;
- les étapes d’une leçon et d’une Repair Loop ;
- les contrats d’évidence et de progression.

Ce registre décrit une ossature pédagogique, pas la progression d’un utilisateur. Les faits individuels sont conservés dans les modèles existants et dans l’état borné d’une `ExperienceSession`.

## 1. Cours depuis zéro

L’action « Apprendre cette langue » démarre un cours avec `startFrom: zero`. Le point de départ effectif est A1, même si le profil contenait auparavant un niveau déclaré supérieur. Le premier bloc comprend :

- contact et présentation ;
- besoins quotidiens ;
- communication de survie ;
- parole et interaction dès A1.

Le démarrage n’attribue aucune compétence validée et ne marque aucune unité terminée.

## 2. Niveau initial

`startFrom: declared-level` reprend au niveau déclaré du profil. Les unités inférieures ne sont pas rejouées automatiquement. Un objectif inférieur au niveau de départ ne crée pas un parcours rétrograde.

Cette reprise reste distincte d’un placement ou d’une évaluation : le niveau initial est déclaré tant qu’une preuve dédiée ne l’a pas estimé ou évalué.

## 3. CECRL

Le contrat distingue quatre informations :

- `declared` : choix de l’utilisateur ou valeur existante du profil ;
- `estimated` : estimation appuyée par des preuves, sinon `null` ;
- `evaluated` : évaluation contrôlée, sinon `null` ;
- `target` : objectif du cours.

Une preuve de niveau contient sa source, sa date et un nombre d’éléments. Le système ne transforme ni une leçon terminée ni un QCM isolé en niveau CECRL certifié.

## 4. Parcours

Le parcours est produit par `curriculumForGoal(startLevel, targetLevel, goalDomain)`. Il conserve toutes les unités du tronc entre les deux niveaux.

La personnalisation par objectif modifie uniquement la priorité :

- `core` pour le tronc universel ;
- `goal` pour une unité réellement spécialisée et pertinente pour voyage, travail, études ou vie sociale.

Une personnalisation ne supprime donc pas les prérequis nécessaires et ne crée pas de trou pédagogique.

## 5. Curriculum

Le curriculum contient trois unités ordonnées pour chacun des niveaux A1, A2, B1, B2, C1 et C2. Sa couverture globale comprend :

- vocabulaire ;
- verbes ;
- conjugaison ;
- grammaire ;
- compréhension orale ;
- compréhension écrite et lecture ;
- conversation ;
- interaction ;
- prononciation ;
- écriture ;
- médiation.

Chaque unité référence des codes i18n stables, des missions existantes et des capacités Can-Do existantes. Les contenus générés doivent rester adaptés à la langue cible et au niveau.

## 6. Vocabulaire

Le vocabulaire suit le flux mot → phrase → contexte → utilisation → réutilisation → révision. Les nouveaux éléments peuvent inclure vocabulaire fondamental, expressions, collocations, idiomes, verbes fréquents et vocabulaire personnel.

Les items réellement retenus utilisent le deck du `LanguageProfile` et les cartes FSRS existantes. Quand le support l’enseigne explicitement, un item peut aussi être une forme verbale, une construction, une conjugaison ou un pattern grammatical compact, toujours avec une phrase d’usage réelle. La source de session, de leçon, de mission ou de document est conservée lorsqu’elle existe. RLLE ne crée pas une seconde base de vocabulaire.

## 7. Verbes

L’axe `verbs` permet au curriculum de planifier progressivement verbes fréquents, auxiliaires, modaux, réguliers, irréguliers et constructions propres à la langue. La sélection concrète appartient aux contenus de leçon et au Professeur existant.

Une simple mention d’un verbe dans une conversation ne constitue ni une maîtrise ni une preuve Can-Do.

## 8. Conjugaison

L’axe `conjugation` reste relié à une situation communicative. Le déroulé attendu est situation → forme ou temps → règle → exemple → utilisation → feedback → réutilisation.

Les progressions propres au français, à l’anglais ou à une autre langue sont générées dans le contexte de la langue cible ; elles ne sont pas codées comme si toutes les langues partageaient le même système verbal.

## 9. Grammaire

La grammaire est présentée comme moyen d’accomplir une intention réelle. Elle peut couvrir articles, accords, genres, pluriels, pronoms, prépositions, négation, questions, temps, subordination, condition et structures avancées selon la langue et le niveau.

Le service de compétences linguistiques existant reste responsable des ressources de grammaire. RLLE choisit le moment et le contexte.

## 10. Compréhension

Les activités de compréhension sont représentées par `listening`, `reading` et l’étape de leçon `comprehension`. Une leçon peut omettre une étape qui n’est pas pertinente, mais son état doit alors être `skipped` plutôt que faussement `completed`.

Le serveur dérive ces omissions des axes déclarés par l’unité. La progression saute les étapes `skipped` et refuse de terminer les autres dans le désordre.

Une progression de compréhension n’est affichée que si une activité a réellement produit une preuve exploitable.

## 11. Lecture

La lecture réutilise l’expérience Reading existante. RLLE peut la proposer dans une unité ou une leçon et conserver sa référence de session. Le simple fait d’ouvrir un texte ne démontre pas une capacité de lecture.

## 12. Écriture

L’écriture réutilise l’espace Writing et la correction de rédaction existants. Les productions écrites peuvent contribuer à une évaluation contrôlée ou à une mission si un résultat observé est enregistré.

Le texte utilisateur reste une production traçable ; une réécriture du Professeur ne doit pas être confondue avec la production originale.

## 13. Oral

Le cours autorise la modalité texte, voix ou mixte. Le principe `Speak First` rend la conversation et la prononciation disponibles dès A1.

Le flux voix reste celui du Lot 11 : enregistrement, pause éventuelle, transcription, brouillon modifiable, envoi volontaire au Professeur. Une transcription n’est jamais envoyée automatiquement.

## 14. Prononciation

La métrique STT existante mesure l’intelligibilité par reconnaissance de mots. Elle ne constitue pas une analyse phonétique ou une mesure d’accent. Une mission texte ou une transcription ne peut donc alimenter ni la dimension écoute ni la dimension prononciation.

L’analyse accent, rythme, fluidité et intonation n’est disponible que lorsqu’un fournisseur audio-native annonce réellement cette capacité. Sinon, le texte et les exercices de prononciation restent disponibles sans score inventé.

## 15. Professeur IA

Le Professeur existant reçoit le contexte pédagogique utile : langue cible, langue d’explication, niveau, objectif, unité, leçon ou mission active, immersion, correction et vocabulaire récent borné.

Lorsqu’une pratique est ouverte depuis une leçon, l’API valide la propriété de la `courseSessionId`, de l’unité et de la leçon avant de les recopier dans la session Tutor. L’objectif communicatif et le niveau de l’unité proviennent alors de l’état serveur, pas de paramètres client libres. Tutor enrichit ensuite ce contexte avec le Learning DNA réellement disponible.

Il peut enseigner, expliquer, interroger, corriger, converser ou simuler une situation. RLLE ne crée ni un chatbot parallèle ni un historique parallèle.

Les modes de correction correspondent à :

- conversation naturelle : correction légère ;
- coach : correction équilibrée après les échanges utiles ;
- entraînement intensif : feedback détaillé.

L’immersion guidée, mixte ou complète reste contrôlable par l’utilisateur et indépendante de la langue UI.

Les préférences d’immersion et de correction peuvent être choisies au démarrage puis modifiées sur un cours actif via `PATCH /languages/:id/course/preferences`. Cette mutation met à jour l’état de la même `ExperienceSession` et ne remet pas la progression à zéro.

## 16. World Missions

Les World Missions couvrent voyage, travail, études et vie sociale. Chaque template définit un niveau minimal, un objectif communicatif, les axes mobilisés, les stratégies de survie et les Can-Do concernés.

Une mission est exécutée avec le Professeur afin que le personnage réagisse au tour réel de l’utilisateur. Le template n’est pas un dialogue rigide et la réussite ne dépend pas d’un simple score de QCM.

Les états sont `active`, `paused`, `needs-retry` et `succeeded`. Le dernier état requiert une preuve enregistrée.

Une mission interrompue ou en remédiation reprend la même session Tutor. Le catalogue expose l’essai courant ; il ne crée donc pas une seconde conversation lorsqu’une Repair Loop est déjà active.

## 17. Functional Gap Engine

Un gap représente un obstacle observé : vocabulaire, grammaire, conjugaison, compréhension orale, fluidité, formulation, interaction ou prononciation.

Un gap n’est créé que lorsqu’une demande d’évidence contient une observation réelle. Ses états permettent de distinguer observation, répétition, confirmation, réparation et consolidation. Le moteur ne déduit pas une faiblesse depuis le niveau déclaré.

## 18. Mistake Memory

Une entrée de Mistake Memory conserve un pattern, un exemple utilisateur borné, une correction, un nombre d’occurrences, les sessions sources et la dernière date observée.

Elle n’est créée que si l’observation contient suffisamment d’éléments pour identifier une erreur pédagogique. Sans exemple et correction, le système peut conserver un gap, mais ne fabrique pas une erreur détaillée.

## 19. Repair Loop

La boucle part d’une erreur réellement observée et suit :

1. explication ;
2. pratique guidée ;
3. nouvelle tentative immédiate ;
4. réutilisation future ;
5. consolidation.

Elle peut référencer une micro-leçon, une preuve de nouvelle tentative et des cartes de révision. Une nouvelle tentative démontrée fait passer la boucle à la réutilisation future. Pour une erreur répétée, la carte FSRS liée ferme ensuite la boucle uniquement après une note Review `Good` ou `Easy` réellement persistée : le gap devient `consolidated`, la Mistake Memory et la Repair Loop passent à `consolidate`. `Again` et `Hard` ne valident pas cette consolidation.

Cette projection est idempotente et intervient après l’écriture FSRS. Une indisponibilité ponctuelle du cours ne peut donc jamais annuler une révision déjà enregistrée.

Un parcours dont toutes les unités sont terminées reste actif tant qu’une Repair Loop ou une mission est encore ouverte. La dernière consolidation peut alors fermer proprement la même `ExperienceSession` de cours au lieu de laisser un état terminal impossible à mettre à jour.

## 20. Communication Survival Skills

Le registre couvre : demander de répéter, demander de ralentir, demander une définition, reformuler, vérifier la compréhension, expliquer un mot inconnu et gagner du temps pour répondre.

Ces stratégies apparaissent dans des missions concrètes, y compris au niveau débutant. Elles ne sont pas présentées comme maîtrisées tant qu’aucune preuve n’existe.

## 21. Médiation

La médiation est un axe à part entière du curriculum et de la progression. Les missions peuvent demander de résumer, reformuler ou expliquer une information à une autre personne.

Une traduction automatique seule ne suffit pas à démontrer cette capacité : l’évidence doit porter sur une production ou interaction observée.

## 22. Can-Do Map

La Can-Do Map expose des capacités fonctionnelles par domaine. Chaque capacité commence à `not-evaluated`, passe à `in-progress` après une preuve non démontrée, et devient `validated` lorsqu’au moins une preuve `demonstrated` existe.

Les seules sources admissibles sont :

- mission ;
- évaluation ;
- activité contrôlée.

Finir une leçon ne valide donc jamais automatiquement un Can-Do.

## 23. Progression

La progression du cours utilise uniquement `completedUnits / totalUnits`. Sans total valide, le pourcentage reste `null`. La valeur est bornée de 0 à 100.

Les dimensions vocabulaire, grammaire, conversation, compréhension orale, lecture, écriture, interaction, prononciation et médiation ont chacune un statut et un nombre de preuves. Chaque preuve énumère précisément les dimensions que son activité pouvait observer ; le moteur ne propage pas automatiquement tous les axes théoriques de la mission. Lorsqu’aucune preuve n’existe, l’interface affiche « Pas encore évalué ».

## 24. Évaluation

Une évaluation réaliste peut combiner écoute, lecture, parole, interaction, écriture et médiation. `RlleLevelEvidence` permet de conserver la source, la date et le nombre de preuves.

Cette extension ne prétend pas fournir une certification CECRL normalisée. Tant qu’un protocole contrôlé et des données suffisantes n’existent pas, `estimated` et `evaluated` restent `null`.

## 25. Review et FSRS

Les éléments réellement sélectionnés depuis une leçon, une mission ou une Repair Loop circulent vers les cartes et le moteur FSRS existants. Review reste l’unique expérience de consolidation. Lorsqu’une carte correspond exactement à une Repair Loop, une note positive persistée est répercutée dans le même état de cours, sans créer de second moteur de répétition espacée. Depuis la file globale, ce raccord n’est fait que si le deck désigne sans ambiguïté un unique profil de langue appartenant au même utilisateur.

Le départ depuis le cours ajoute `returnTo=course` et la session source à `/revision?languageProfileId=…`. À la fin, Review peut ainsi revenir au cours exact. Un lien plus précis vers une mission n’est affiché que si cette provenance a été persistée.

## 26. Brain

RLLE produit des traces de progression ou de compétence pour Brain, mais n’invente aucun concept, aucune maîtrise et aucun score. Une capacité `not-evaluated` n’apparaît pas comme faiblesse à zéro pour cent.

Depuis le cours, le CTA Brain n’est visible que lorsqu’au moins une preuve existe. `/brain?languageProfileId=…` charge alors le cours possédé et affiche uniquement les dimensions et Can-Do réellement observés. L’intégration sémantique plus profonde au graphe reste hors de cette extension.

## 27. Reprise

Le cours utilise `ExperienceSession` de type `language`. L’état reprend au minimum :

- le profil et la langue ;
- les niveaux déclaré et cible ;
- le domaine d’objectif ;
- l’unité et la leçon ou mission active ;
- la progression mesurée ;
- l’immersion et la correction ;
- les productions bornées ;
- la cible de reprise et la prochaine action.

Le hub privilégie cette cible exacte avant de proposer une nouvelle activité. Les identifiants de leçon, Tutor et langue restent reliés via les liens standards de `ExperienceSession`.

## 28. Préparation de la Landing

Aucune route ni composant de la Landing n’est modifié. Les contrats permettent cependant de restituer ultérieurement, avec des données de démonstration explicitement identifiées, le scénario :

objectif professionnel → English B1 → mission réunion → échange Professeur → gap observé → micro-leçon → nouvelle tentative → vocabulaire sélectionné → révision FSRS → capacité fonctionnelle démontrée.

La future démonstration ne devra pas marquer un Can-Do validé ou une progression sans preuve correspondante.

## I18n

Les titres et objectifs statiques utilisent des codes `rlle.*`. Le contenu utilisateur, les noms propres et les productions ne sont pas traduits automatiquement. Les scénarios minimums à vérifier sont :

- interface française et cours d’anglais ;
- interface anglaise et cours de français.

La locale du client détermine les libellés de l’interface. La langue d’appui pédagogique conservée par le `LanguageProfile` guide les explications, tandis que ce même profil identifie séparément la langue étudiée. Ces responsabilités ne sont jamais fusionnées.

## Isolation, bornes et performance

Toutes les lectures et mutations de cours doivent combiner l’identifiant de ressource avec `userId`. Les références de profil, Lesson, TutorSession et ExperienceSession doivent être contrôlées avant écriture.

Les tableaux conservés dans `ExperienceSession` restent soumis aux bornes du contrat transversal. Les exemples utilisateur et observations sont tronqués côté API. Le curriculum statique est partagé et n’entraîne aucune requête LLM. Les listes de missions et Can-Do sont de taille bornée.

## Routes RLLE

- `GET /languages/:id/course` : état projeté du cours ;
- `POST /languages/:id/course/start` : démarrage depuis zéro ou niveau déclaré ;
- `PATCH /languages/:id/course/preferences` : immersion et correction ;
- `POST /languages/:id/course/lessons/start` : création ou reprise de leçon ;
- `POST /languages/:id/course/advance` : validation ordonnée d’une étape réelle ;
- `GET /languages/:id/missions` : catalogue et essai courant ;
- `POST /languages/:id/missions/:missionId/start` : démarrage ou reprise ;
- `POST /languages/:id/missions/:missionId/turn` : tour Tutor et évaluation fonctionnelle ;
- `POST /languages/:id/evidence` : rattachement contrôlé d’une preuve existante ;
- `GET /languages/:id/can-do` : carte de capacités fondée sur les preuves.

Les quatre écrans `/languages/[id]/course`, `/lesson`, `/missions` et `/can-do` restent dans l’AppShell sous l’espace Apprendre.

## Limites honnêtes

- Aucun examen CECRL externe ou certifié n’est intégré.
- Une preuve applicative ne constitue pas une certification officielle.
- Aucun score phonétique n’est produit sans analyse audio-native.
- La mémoire d’erreurs dépend d’observations structurées ; elle n’analyse pas rétroactivement tout l’historique.
- Une mission utilise le Tutor existant pour son interaction dynamique ; le catalogue seul ne simule aucun dialogue.
- L’ajout des compétences linguistiques au graphe sémantique Brain reste un raccord futur ; le panneau de preuves contextualisé est déjà disponible.
- Le quota vocal serveur reste une dépendance déjà documentée dans `LANGUAGES-VOICE-IMMERSION.md`.
- La Landing relève du Lot 12 et n’a pas été modifiée.

## Validation automatisée

Les tests partagés vérifient le parcours A1–C2, le démarrage débutant, la reprise avancée, l’absence de trous après personnalisation, les onze axes, l’accessibilité de chaque mission depuis le curriculum, les références mission/Can-Do, les quatre catégories de mission, les sept stratégies de survie, la médiation, les preuves Can-Do, les étapes de leçon et de réparation, ainsi que les pourcentages réels.

Les tests API valident notamment le démarrage débutant/avancé, l’isolation utilisateur, les préférences modifiables, les étapes pertinentes et ordonnées, la reprise de la même World Mission, le refus des preuves inventées, les gaps réellement fournis, Mistake Memory, Repair Loop, la consolidation idempotente après une vraie révision FSRS, les routes de contexte et l’orchestration Lesson/Tutor/ExperienceSession/FSRS. Ils ne remplacent pas les tests manuels voix, RTL et appareils réels décrits dans la documentation du Lot 11.
