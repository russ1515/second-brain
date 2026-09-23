# Réviser — consolidation de la mémoire

## Rôle produit

`/study` est l’accueil de Réviser. Il répond à « qu’est-ce que ma mémoire doit consolider maintenant ? » avec une priorité du jour, une explication vérifiable, un lancement de session et un aperçu temporel léger. `/revision` est l’expérience de travail focalisée.

Brain explique l’état de la mémoire. Réviser agit sur cet état. Les écrans ne dupliquent ni la mémoire ni l’algorithme de planification.

## Sources métier et priorisation

L’agrégat `GET /api/review/home` compose les deux moteurs existants :

- les cartes via `Card`, `ReviewLog`, `SessionService` et `FsrsService` ;
- les autres activités via `Reviewable`, `RevisionEngineService` et `FsrsEngine`.

Le classement ne requiert aucun LLM. Il conserve la priorité produite par FSRS, puis applique uniquement des signaux déterministes et vérifiables : contexte concept ou document explicite, examen lié proche, état `relearning`, nombre réel de jours de retard et date d’échéance. Les identifiants de concept, document, objectif, examen et session source sont toujours résolus avec `userId`.

L’interface ne présente pas `stability`, `difficulty`, `retrievability`, les formules ou l’intervalle algorithmique au premier niveau. Une échéance future est affichée seulement quand elle existe en base.

## Review Home

La surface « À réviser maintenant » affiche les comptes réels des cartes et activités dues. Pour une file importante, elle propose un lot borné sans formulation culpabilisante. Si rien n’est dû, elle indique que l’utilisateur est à jour et montre la prochaine date réelle si elle existe.

Le plan reste volontairement léger : aujourd’hui, demain et le prochain examen connu. L’historique montre seulement le nombre de reviews persistées aujourd’hui. Les cartes suivantes sont un aperçu borné, pas une exposition de toute la base.

## Mapping FSRS

Les labels produits sont mappés sans modifier les moteurs :

| Libellé UI | Rating FSRS |
| --- | ---: |
| À revoir | 1 |
| Difficile | 2 |
| Bien / Correct | 3 |
| Facile | 4 |

Le feedback court est déduit du rating effectivement persisté : `review-soon`, `still-fragile`, `good-recall` ou `easy-recall`. Il ne prétend pas mesurer une nouvelle maîtrise.

## Session et reprise

`POST /api/review/sessions` sélectionne un lot de 5, 10 ou au plus 50 éléments dus. Le serveur crée une `ExperienceSession` de type `review`, avec :

- les références exactes du lot dans `sourceReferences` (`review-item`) ;
- le contexte actif ;
- l’étape courante ;
- une progression `completed / total` ;
- une `resumeTarget` vers `/revision?sessionId=...` ;
- les liens document et objectif lorsqu’ils sont valides.

Chaque rating est envoyé à `POST /api/review/sessions/:id/review`. Le serveur vérifie l’appartenance de l’élément à la session, écrit d’abord un marqueur intermédiaire, appelle le moteur FSRS concerné, puis remplace le marqueur par une production finale. La progression n’avance qu’après cette persistance. Si le réseau coupe entre le commit FSRS et le commit de session, un retry réconcilie le `ReviewLog` ou `lastReview` depuis l’horodatage du marqueur au lieu de noter l’élément deux fois.

`GET /api/review/sessions/:id` reconstruit le lot dans son ordre initial, inclut les éléments déjà traités et reprend une session en pause. Une carte devenue indisponible est comptée explicitement ; les autres réponses restent intactes.

## Formats d’activité

Les cartes utilisent le flux question, révélation, correction et auto-évaluation. Les `Reviewable` génériques ne possèdent pas forcément de correction : ils sont présentés comme rappel libre, avec une auto-évaluation explicite et sans réponse inventée. Le Lot 9 ne crée pas de nouveau générateur de quiz, d’exercice ou de contenu oral.

## Fin de session et progression

Le résumé dérive exclusivement des productions enregistrées : nombre traité, ratings 1–4, nombre difficile (ratings 1 ou 2), concepts liés et première échéance future reconstruite depuis les éléments. `ProgressNarrative` réutilise la progression réelle de l’`ExperienceSession`. Les actions suivantes sont bornées à trois : Professeur si une difficulté a été signalée, Mon Cerveau et arrêt pour aujourd’hui.

## Transitions de contexte

- Brain → Review transmet `conceptId`.
- Document → Review transmet `documentId` lorsqu’une ressource flashcards existe.
- Examen → Review transmet `examId`.
- Objectif → Review transmet `goalId`.
- Review → Professeur transmet le concept, la question, le document, l’objectif et la session source disponibles.
- Review → Brain transmet le concept ou ouvre la vue Mémoire, ainsi que la session source.

Le contexte document filtre les cartes par `sourceDocumentId`. Le contexte concept filtre par `ConceptCard` et les `Reviewable` de type `concept`. Un examen ne priorise un élément que si le lien concept est connu ; aucun rapprochement sémantique n’est inventé.

## Offline et erreurs

L’accueil et chaque session chargée sont mis en cache par utilisateur. En cas de coupure, le dernier état est rendu avec sa date de synchronisation. Le contenu déjà chargé reste lisible, mais les ratings sont désactivés en état stale : aucune réponse n’est présentée comme persistée avant confirmation serveur.

Une erreur de rating conserve l’élément courant, sa révélation et la position. Mettre en pause tente une transition serveur ; si le réseau est déjà coupé, la session active reste néanmoins récupérable côté serveur au prochain accès.

Les quotas IA n’interviennent pas dans la révision FSRS. Ils restent gérés par le contrat quota existant au moment où l’utilisateur ouvre le Professeur ; Réviser ne redirige jamais automatiquement vers le paiement.

## Responsive et accessibilité

Sur mobile, une question est affichée à la fois et les quatre ratings ont une cible tactile minimale. Sur desktop, la zone de travail reste dominante avec un contexte latéral optionnel. Les compteurs exposent un rôle `progressbar`, la taille de session un `radiogroup`, et tous les contrôles ont un rôle et un libellé. Aucune priorité n’est indiquée uniquement par couleur.

Le Lot 9 n’ajoute aucune animation permanente. Les primitives partagées respectent le réglage reduced-motion du design system.

## Performance

- Lot de session borné à 50 éléments.
- Aperçu Home borné à 8 éléments.
- Chargement des seules cartes sélectionnées et de leurs relations utiles.
- Pas de polling, pas d’appel LLM automatique, pas de recalcul global de mémoire après chaque réponse.
- Mise à jour séquentielle : FSRS, `ReviewLog`/`Reviewable`, puis `ExperienceSession`.

## Limites backend connues

- Les `Reviewable` génériques ne stockent pas de prompt/correction structurés ; ils utilisent donc le rappel libre.
- `ExperienceSession` persiste le rating et la progression, pas une réponse textuelle inexistante dans le moteur actuel.
- Il n’existe pas de relation générique objectif → concept/carte ; l’objectif reste un contexte visible mais ne modifie pas silencieusement le classement.
- Le mode oral n’est pas activé dans cette expérience tant que le moteur de review ne fournit pas un contrat oral compatible.
- Les dates de review utilisent la journée UTC, conformément aux services de flashcards existants.
