# Internationalisation — checkpoint de reprise

Dernière consolidation : 2026-09-24.

## Statut du chantier

La traduction a été interrompue proprement à la demande de l’utilisateur. Aucun
processus de traduction n’est actif et le verrou devenu obsolète a été retiré.
Le travail déjà écrit dans les catalogues est conservé.

Le catalogue anglais de référence contient **3 654 clés**. L’état actuel est le
suivant :

| Locale | Clés effectives | Couverture | Manquantes | Intégrité structurelle |
| --- | ---: | ---: | ---: | ---: |
| `en`, `fr`, `es`, `de`, `it`, `pt`, `nl`, `pl`, `ru`, `zh`, `ko`, `ar`, `hi` | 3 654 / 3 654 | 100 % | 0 | 0 erreur |
| `ja` | 2 592 / 3 654 | 70,9 % | 1 062 | 0 erreur hors clés manquantes |
| `tr` | 3 492 / 3 654 | 95,6 % | 162 | 0 erreur hors clés manquantes |
| `sv`, `vi`, `th`, `el`, `cs`, `ro`, `hu`, `da`, `fi`, `id`, `no`, `uk` | 1 992 / 3 654 par locale | 54,5 % | 1 662 par locale | 0 erreur hors clés manquantes |

Ainsi, **13 langues sur 27** disposent d’un catalogue structurellement complet.
Il reste **21 168 traductions** à produire. Le gate final de complétude reste
donc **NO** : l’application ne doit pas encore être annoncée comme traduite à
100 % dans les 27 langues.

Les clés manquantes retombent de manière déterministe sur l’anglais. Ce fallback
maintient l’application exploitable et évite d’afficher des clés techniques, mais
ne constitue pas une traduction complète.

## Contrat des langues

- Le registre learner expose 27 langues : `fr`, `en`, `es`, `de`, `it`, `pt`,
  `nl`, `pl`, `ru`, `zh`, `ja`, `ko`, `ar`, `hi`, `tr`, `sv`, `vi`, `th`,
  `el`, `cs`, `ro`, `hu`, `da`, `fi`, `id`, `no`, `uk`.
- La langue d’interface et la langue d’apprentissage sont deux préférences
  distinctes. Changer l’interface ne modifie ni `preferredLanguage`, ni un
  parcours ou une langue étudiée, et ne déclenche pas de PATCH `/auth/locale`.
- Les noms de fichiers, titres et contenus saisis par l’utilisateur, citations
  et extraits de sources ne sont pas traduits automatiquement.
- Les catalogues complets sont contrôlés contre les 3 654 clés source. Les
  placeholders, nombres normalisés, URL, marqueurs Markdown, marques et emojis
  font l’objet de vérifications structurelles.

## Détection automatique dès la Landing

La résolution de la langue UI suit cet ordre déterministe :

1. préférence enregistrée dans `sb.locale` ;
2. locale BCP 47 du navigateur ou de l’appareil, région comprise ;
3. anglais si aucune langue supportée ne correspond.

Une variante régionale compatible est conservée pour le formatage. Par exemple,
`fr-CA`, `pt-BR`, `es-419` ou `ar-MA` sélectionnent le catalogue de leur langue
de base tout en alimentant `formatLocale` pour les dates, heures et nombres.
Cette résolution s’applique avant le premier rendu de la Landing Web lorsque la
locale navigateur est disponible.

Sur le Web, `<html lang>` et `<html dir>` sont synchronisés globalement. L’arabe
active le sens RTL ; les autres langues actuellement déclarées utilisent LTR.
La sélection ne repose ni sur la géolocalisation GPS, ni sur l’adresse IP : une
localisation physique n’est pas une preuve fiable de la langue souhaitée et
n’est pas requise pour ce fonctionnement.

## Surfaces internationalisées dans ce lot

- Le formatage régional a été propagé aux principales surfaces learner :
  Accueil, Mon Cerveau, Réviser, calendrier, examens, Bibliothèque et document,
  langues/cours/leçon/progression, abonnement, synchronisation, Professeur et
  utilisation.
- Les derniers libellés learner détectés dans Recherche, expression écrite,
  écoute, posture et avatar ont été raccordés aux catalogues.
- Réviser dispose de ses libellés dédiés dans les 27 langues et conserve le fond
  sombre sur toute la surface de son shell, y compris en chargement et erreur.
- La langue UI et la langue d’apprentissage restent indépendantes sur toutes
  ces transitions.

## Pipeline de traduction et contrôles

Le pipeline `scripts/translate-locale.mjs` est conçu pour être repris sans
réécrire les traductions déjà validées :

- analyse AST des 3 654 clés et prise en compte des surcouches existantes ;
- mode sec par défaut, écriture seulement avec une option explicite ;
- modèle épinglé, lots bornés, concurrence maximale de 8, retries et backoff ;
- réponses JSON structurées et validation stricte avant écriture atomique ;
- vérification des checksums source/catalogue pour éviter une écriture sur un
  état concurrent ;
- journal local de maintenance avec réservation avant appel, puis finalisation
  ou libération exactement une fois lorsque l’état de l’appel est connu ;
- aucun secret, prompt complet ni réponse brute conservé dans le manifeste.

Le mode synchrone a utilisé Gemini 3.5 Flash-Lite. Le mode Batch a été préparé,
mais l’API l’a refusé avec `FAILED_PRECONDITION` au palier fournisseur actuel ;
aucun résultat Batch n’a donc été appliqué.

Le manifeste local
`apps/mobile/lib/locales/.translation-progress/rest-final-sync-parallel1-20260924.json`
contient une tentative `FINALIZATION_PENDING` laissée par l’interruption
`Ctrl+C`. C’est une trace d’audit uniquement : **elle ne doit pas être réutilisée
pour reprendre**. La future reprise devra reconstruire le plan depuis les
catalogues présents sur disque.

Ordre de reprise retenu :

1. terminer le japonais (`ja`) ;
2. terminer le turc (`tr`) ;
3. traiter `sv`, `vi`, `th`, `el`, `cs`, `ro`, `hu`, `da`, `fi`, `id`, `no`,
   puis `uk` ;
4. exécuter le gate final strict sur les 27 catalogues ;
5. réaliser une revue linguistique native et une recette visuelle responsive.

## Gates et limites

Les audits disponibles distinguent volontairement deux usages :

- audit progressif : suit la couverture et les défauts sans prétendre que le
  chantier est terminé ;
- audit final strict : exige 3 654 / 3 654 pour chacune des 27 langues et zéro
  défaut d’intégrité.

À ce checkpoint, l’audit structurel signale **0 défaut non lié à une clé
manquante**, mais l’audit final reste en échec en raison des 21 168 traductions
restantes.

La dernière exécution ciblée des tests i18n compte **41 succès sur 48**. Les
sept échecs sont tous confinés à `translate-locales-batch.test.mjs` : ses
fixtures prennent encore `es` comme exemple de catalogue incomplet alors que
l’espagnol est désormais complet. Le moteur refuse donc correctement de créer
un job Batch vide. Cette dette de fixture doit être rendue indépendante de
l’état réel des catalogues avant le gate final ; elle ne correspond pas à une
erreur d’intégrité des traductions déjà écrites.

Même après un futur 100 % structurel, une promesse commerciale de localisation
complète exigera encore :

- une relecture par des locuteurs natifs (ton, terminologie pédagogique et
  cohérence culturelle) ;
- une stratégie CLDR/ICU pour les pluriels et variantes grammaticales ;
- une recette visuelle desktop, tablette, mobile, Android et iOS ;
- une validation d’accessibilité, de saisie et de lecture d’écran, notamment en
  RTL.

## Commandes de vérification

```text
pnpm --filter @second-brain/mobile i18n:audit
pnpm --filter @second-brain/mobile i18n:audit:final
pnpm --filter @second-brain/mobile test
pnpm --filter @second-brain/mobile typecheck
```

La recette Web Réviser réalisée avant cette interruption avait chargé `/study`
dans les 27 locales : 27/27 PASS pour la disponibilité de la surface, les
attributs `lang/dir`, l’absence de clés brutes et les libellés Review critiques.
Cette preuve de surface ne signifie pas que l’ensemble des 3 654 textes était
déjà traduit dans chaque langue.
