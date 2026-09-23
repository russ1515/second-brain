# Recherche et Academic Workspace

Ce document décrit les contrats du Lot 10. Les deux expériences partagent les sources, les citations et la continuité, mais gardent des missions différentes : Recherche trouve et synthétise des preuves ; Academic Workspace organise et produit un travail.

## Niveaux de recherche

- `quick` récupère au plus 5 sources et produit une réponse concise.
- `sourced` récupère au plus 10 sources et produit analyse, sections et citations.
- `deep` récupère au plus 16 sources et peut produire comparaison et synthèse structurée. L’interface montre un plan avant tout lancement.

Ces limites sont des bornes de sources, pas des estimations de progression. L’API ne retourne que les étapes réellement terminées : sources trouvées, sources lues, comparaison présente et synthèse produite.

## Périmètres et fournisseurs

Les périmètres internes disponibles sont Mon Cerveau, toute la Bibliothèque, une sélection de documents et une collection. Les identifiants de documents et de collections sont toujours résolus avec le `userId` authentifié. Une sélection est limitée à 20 documents et une recherche à quatre périmètres.

Les périmètres `external` et `web` passent exclusivement par `ResearchProvider`. Le déploiement actuel enregistre `DisabledResearchProvider` : l’interface affiche donc « Recherche Web non disponible » et l’API ne simule aucune source externe. Brancher un fournisseur ultérieur exige une décision de configuration et une implémentation de l’interface existante.

## Sources et citations

`UnifiedResearchCitation.kind` distingue `document`, `brain`, `external` et `web`. Les extraits sont bornés et une citation générée n’est conservée que si son identifiant existe dans les preuves collectées. Les composants `SourceCitation` et `SourcePreview` assurent la même interaction dans Recherche et Workspace. Aucune page ou section n’est créée si la source ne la fournit pas.

Si aucune preuve n’est trouvée, la synthèse est vide et l’interface explique qu’aucune réponse sourcée n’a été générée. Un fournisseur indisponible dans une recherche combinée produit un résultat `partial`, sans masquer les sources internes réussies.

## Sessions et reprise

Chaque lancement crée une `ExperienceSession` de type `research` avant l’appel coûteux. La question, la profondeur et les périmètres sont conservés dans `currentStep.metadata`; le résultat borné et les citations sont conservés dans une production `research-result`. `resumeTarget` revient vers `/research?experienceSessionId=…`.

À la reprise, l’écran restaure les données enregistrées et ne relance pas automatiquement la collecte. Une session interrompue sans résultat restaure sa question et laisse l’utilisateur décider de reprendre.

## Transformations

Une recherche terminée propose au maximum trois suites : apprendre avec le Professeur, ajouter au Workspace, ou approfondir. Le transfert vers Workspace conserve la question, la synthèse et les citations dans une source `research-source`. Depuis un Workspace existant, la source est ajoutée au travail courant ; sinon un nouveau Workspace de type `academic-research` est créé.

## Persistance Workspace

`AcademicWorkspace` est un modèle additif distinct de l’ancien évaluateur de rédaction. Il conserve :

- titre, template, objectif et échéance ;
- plan ordonné et état réel des étapes ;
- contenu Markdown ;
- sources avec provenance ;
- historique assistant borné ;
- état, progression, révision d’autosauvegarde et cible de reprise ;
- identifiant de l’`ExperienceSession` associée.

Les templates sont mémoire, TFC, dissertation, rapport, article, devoir, recherche académique et autre. Ils initialisent un environnement commun ; ils ne créent pas huit produits.

## Autosauvegarde et conflits

Le client attend 1,2 seconde après une modification de contenu avant `PATCH /workspaces/:id/autosave`. Il envoie `expectedRevision`. L’API n’écrit que si cette révision correspond à `autosaveRevision`, puis incrémente la révision. Un éditeur obsolète reçoit `409 workspace_revision_conflict` au lieu d’écraser un contenu plus récent.

Les états visibles sont : modification non sauvegardée, sauvegarde en cours, sauvegardé après confirmation serveur, erreur et hors ligne. En cas d’échec, le texte reste dans l’état React de l’écran et l’utilisateur peut réessayer manuellement.

## Éditeur, plan et progression

L’éditeur existant dans le projet était un évaluateur de texte final et non une brique éditoriale persistante ; il n’a donc pas été détourné. Le nouvel éditeur conserve du Markdown et expose texte, titres, listes, citations et références. Une sélection peut être remise à l’assistant contextuel.

Le plan est modifiable, renommable, réordonnable, supprimable et extensible. Le seul pourcentage affiché est `sections terminées / sections totales`. La longueur du texte n’est jamais interprétée comme une progression.

## Assistant et intégrité académique

`WorkspaceAssistant` propose expliquer, challenger, suggérer, structurer, comparer les sources, vérifier la cohérence et reformuler. Son contexte est limité au Workspace, aux extraits des documents détenus par l’utilisateur et aux synthèses de recherche transférées. L’historique persistant est borné à 30 entrées et seuls les huit derniers messages alimentent un tour IA.

Le prompt interdit de remplacer l’apprenant ou de générer un travail académique complet. L’assistant encourage raisonnement, attribution et vérification, et le brouillon reste la surface principale.

## Raccords

- Document → Workspace ouvre la création avec le document déjà sélectionné.
- Research → Workspace transfère la provenance complète.
- Workspace → Research conserve l’identifiant du travail et rattache le résultat au même Workspace.
- Workspace → Professeur transmet un contexte `workspace`.
- Research → Professeur transmet la session de recherche.
- Les ressources documentaires existantes continuent de mener à Réviser ; ce lot ne refond pas Review.

## Responsive et accessibilité

Recherche place les résultats au centre et les sources dans un rail sur desktop. Sur mobile, le choix des périmètres s’ouvre dans une sheet, les sources suivent le résultat et l’aperçu reste dans le flux. Workspace utilise plan/sources, contenu et assistant sur grand écran ; en tablette paysage il utilise un split ; sur mobile une seule zone Plan, Travail, Sources ou Assistant est active.

Les sélecteurs exposent leurs états radio/checkbox, les contrôles gardent une cible de 44 points, la sauvegarde utilise une région live et les citations sont des liens accessibles. Aucune animation permanente ni faux pourcentage n’a été ajouté.

## Quotas, erreurs et performance

Une recherche approfondie annonce son coût relatif et exige une confirmation. Un `QuotaError` ou HTTP 429 préserve la session et propose Usage sans redirection automatique vers le paiement.

La recherche borne périmètres, documents, sources et extraits. Elle accepte une annulation client. Workspace ne recharge pas les sources à chaque frappe, applique un debounce d’autosauvegarde, charge la Bibliothèque à la demande et borne les contextes et historiques IA. Les erreurs partielles ne suppriment ni résultat de recherche réussi ni contenu Workspace.

## Migration

La migration `20260910120000_academic_workspaces` est additive. Elle crée uniquement `academic_workspaces`, ses index et sa clé étrangère utilisateur. Elle n’est pas exécutée automatiquement par ce lot : le déploiement reste responsable de `prisma migrate deploy` dans sa procédure habituelle.
