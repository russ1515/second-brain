# Home et Next Best Action

## Rôle

L’Accueil est une surface de décision, pas un rapport. Il répond à « qu’est-ce que je devrais faire maintenant ? » avec une seule action dominante, puis affiche la continuité utile : sessions à reprendre, prochains événements, objectif principal et résumé de progression.

La priorité est calculée côté API à partir de signaux métier. Elle ne dépend d’aucun appel LLM et continue donc de fonctionner si le fournisseur d’IA est indisponible.

## Contrat et endpoint

`GET /api/home/overview` est authentifié et retourne un `HomeOverview` :

- contexte bref de la salutation ;
- une `NextBestAction` ou `null` ;
- zéro à trois sessions reprenables ;
- au plus un objectif principal ;
- au plus trois éléments à venir ;
- un résumé de progression lorsqu’il est disponible ;
- l’état `available` ou `unavailable` de chaque source ;
- le marqueur `partial`.

Le contrôleur transmet exclusivement l’identifiant issu du JWT. Les services métier conservent leurs contrôles de propriété.

## Sources

L’agrégateur compose les services existants sans recopier leur logique :

- examens et objectifs ;
- file de révision et signaux FSRS ;
- sessions d’expérience reprenables ;
- recommandations persistées, elles-mêmes alimentées par le parcours, la maîtrise et les documents ;
- Coach ;
- initiatives contextuelles du Mentor ;
- Foresight ;
- calendrier d’apprentissage ;
- aperçu de progression du Mentor.

Chaque source échoue indépendamment. Une erreur produit un payload partiel tant qu’une autre source fournit une information vérifiable. Si aucune source fiable ne permet de décider, l’action vaut `null` : l’API n’invente pas de recommandation.

## Priorité déterministe

Les scores sont des règles produit relatives. Ils ne sont pas affichés à l’utilisateur.

| Signal | Priorité indicative | Règle |
| --- | ---: | --- |
| Examen dans 0–1 jour | 970 + importance + préparation faible | Passe avant toute autre activité. |
| Révision urgente ou en retard | 950 | Protège une mémoire déjà en dégradation. |
| Examen dans 2–7 jours | 900 + importance + préparation faible | Devance une révision normale. |
| Révision réellement due | 880 | Devance une session simplement active. |
| Initiative Mentor « révisions dues » | 850 | Fusionnée avec la révision réelle si elles visent la même intention. |
| Session interrompue | 820 | Préserve le travail et le contexte déjà engagés. |
| Examen dans 8–14 jours | 760 + importance + préparation faible | Peut dépasser une session selon les données. |
| Session active | 760 | Continuité récente. |
| Foresight à risque élevé | 740 | Reste explicitement une estimation. |
| Coach | 720 et moins | Durée affichée seulement si le Coach l’a calculée/configurée. |
| Recommandation exercice | 700 | Fragilité ou pratique issue du moteur existant. |
| Recommandation de révision | 680 | Ne remplace pas une file FSRS réellement due. |
| Retour conseillé par le Mentor | 650 | Réentrée après interruption prolongée. |
| Foresight à risque modéré | 620 | Ne supplante pas les urgences factuelles. |
| Leçon / examen plus lointain | 600 / 500+ | Progression sans urgence immédiate. |
| Lecture, pratique, document | 450 / 400 / 350 | Opportunités utiles mais non urgentes. |
| Objectif actif | 300 | Aperçu de direction, sans fausse urgence. |
| Compte neuf / tout à jour | 100 | Fallback seulement si les sources critiques sont connues. |

À score égal, le signal vérifiable le plus récent gagne. Les entrées expirées ou dont la date est invalide sont ignorées.

## Déduplication

Les candidats convergent par clé d’intention : concept, révision due, examen, langue, session, objectif ou destination canonique avec ses paramètres triés.

Le candidat le mieux classé fournit le titre, la raison et la destination. Les doublons peuvent compléter :

- les signaux visibles dans « Pourquoi ? » ;
- une durée réellement connue ;
- un impact réellement connu.

Les signaux identiques sont supprimés et la liste est bornée à cinq. Jusqu’à trois alternatives restent dans le contrat, mais Home ne leur donne pas de CTA concurrent.

## « Pourquoi ? »

Le panneau est fermé par défaut et expose seulement :

- le libellé stable du signal ;
- son évidence métier en langage clair ;
- pour Foresight, la confiance estimée disponible.

Il n’expose ni prompt, ni raisonnement interne, ni chaîne de pensée. Le bouton communique son état ouvert/fermé aux technologies d’assistance.

## Foresight

Seuls les risques modérés ou élevés deviennent candidats. Le texte les présente comme des estimations (« à ton rythme actuel », probabilité et confiance) et jamais comme des faits. Le niveau élevé reste sous un examen imminent, une révision urgente et une session interrompue.

## États sans données

### Compte neuf

Lorsque les sources critiques sont disponibles et ne contiennent aucun historique, Home affiche « Construisons ton Second Brain » et propose réellement `/learn`. Aucune durée, progression ou métrique n’est fabriquée.

### Tout est à jour

Lorsque l’historique existe mais qu’aucune priorité n’est active, Home indique qu’il n’y a pas d’urgence et propose d’explorer `/learn`. Une indisponibilité de source ne peut pas être confondue avec cet état.

### Indisponibilité

Si les sources ne permettent pas de conclure, `nextBestAction` reste `null`. Le client montre un état honnête et conserve, si disponible, la dernière donnée en cache pendant la tentative de rafraîchissement.

## Sessions reprenables

Home demande au service d’expérience trois sessions au maximum. Une carte montre le titre, le type, les contextes visibles, la dernière activité, la progression seulement si elle est connue, le principal artefact et la destination de reprise existante.

Une session sans destination fiable n’est pas exposée. Les identifiants d’expérience et du domaine associé sont conservés dans l’URL.

## Destinations

- révision : `/revision` ;
- examen : `/exams?examId=…` ;
- objectif : `/goals?goalId=…` ;
- concept : `/lesson/new?conceptId=…` ;
- document : `/library/:id` ;
- leçon : `/lesson/:id` ;
- langue : `/languages/:id` ;
- workspace : `/library/workspace/:id` ;
- session : route métier précise avec `experienceSessionId` ;
- planification : `/calendar`.

Les paramètres sont encodés côté client par le résolveur commun de destinations.

## Performance et dégradation

Le client remplace les anciens appels Home concurrents par une seule requête agrégée. Les sources serveur sont interrogées en parallèle. TanStack Query :

- considère la vue fraîche pendant 30 secondes ;
- la conserve cinq minutes en cache ;
- réutilise la dernière vue pendant la revalidation ;
- annule la requête cliente devenue obsolète via `AbortSignal` ;
- limite le retry automatique à une tentative.

Le premier chargement utilise un squelette fidèle à la hiérarchie au lieu d’un spinner plein écran. Le pull-to-refresh ne retire pas les données déjà visibles.

## Responsive et accessibilité

Sur mobile, l’ordre reste strict : NBA, reprise, à venir, objectif, progression, raccourcis. La tablette et le desktop conservent une NBA pleine largeur puis utilisent des paires adaptatives. Aucun contrôle essentiel ne dépend du survol.

L’arrivée de la NBA utilise une transition d’opacité de 180 ms, supprimée lorsque la réduction des animations est activée. Les actions utilisent les boutons du design system, les titres ont un rôle sémantique et « Pourquoi ? » expose son état étendu au lecteur d’écran.
