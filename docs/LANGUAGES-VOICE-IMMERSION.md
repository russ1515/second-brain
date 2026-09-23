# Langues, immersion, oral et voix

L’extension de cours structuré et d’apprentissage en situations réelles est documentée séparément dans [`REAL-LIFE-LANGUAGE-ENGINE.md`](./REAL-LIFE-LANGUAGE-ENGINE.md). Elle reste une extension du Lot 11 et réutilise les contrats voix, Tutor, FSRS et `ExperienceSession` décrits ici.

## Périmètre du Lot 11

Ce lot consolide les moteurs Langues, Tutor, Speech, FSRS et `ExperienceSession` existants. Il ne crée ni second professeur, ni second moteur de révision, ni fournisseur Web externe. Les routes principales restent `/languages`, `/languages/[id]`, `/tutor/[id]` et `/revision`.

## Language Hub

`/languages` répond d’abord à quatre questions : quelle langue est active, où en est l’utilisateur, quelle pratique est prioritaire et quelle session peut être reprise. Les compteurs affichés viennent des profils, cartes FSRS, leçons et sessions réellement persistés. Le niveau CECRL est explicitement marqué comme déclaré tant qu’aucune évaluation dédiée ne l’a mesuré.

La langue active est une préférence locale isolée par identifiant utilisateur. Elle ne modifie pas la langue de l’interface.

## Language Selector et registre des 27 langues

Le registre partagé `packages/shared/src/languages.ts` est la source de vérité des 27 langues. Le sélecteur affiche toujours :

- le nom natif, qui porte le sens ;
- le nom de la langue dans la langue de l’interface via `Intl.DisplayNames` ;
- le code interne ;
- un drapeau décoratif seulement lorsqu’il est raisonnablement représentatif.

L’anglais, le portugais, le chinois et l’arabe utilisent une icône neutre. Les codes BCP-47 comme `en-GB` ou `pt-BR` sont ramenés à leur langue de base ; les variantes ne sont pas créées tant que le backend ne les modèle pas.

## Langue UI et langue apprise

La langue UI est stockée sous `sb.locale` et synchronisée avec le profil d’interface. La langue apprise appartient à `LanguageProfile`. Une interface française peut donc piloter un Professeur anglais sans ambiguïté. Le nom de la langue cible, le niveau, l’objectif et la langue d’explication sont transmis au prompt pédagogique.

## Espace d’une langue et modes

`/languages/[id]` présente une activité principale à la fois. Les formats disponibles sont conversation, vocabulaire, grammaire, conjugaison, compréhension, lecture, écriture, prononciation, oral et quiz. Ils réutilisent les services existants :

- `ConversationService` et Tutor pour les échanges ;
- `VocabularyService` et les cartes FSRS pour le vocabulaire ;
- `LanguageSkillsService` pour grammaire, conjugaison et compréhension ;
- Reading et Writing comme historiques/espaces spécialisés existants ;
- `PronunciationService` et Speech pour l’intelligibilité et, si disponible, l’analyse audio-native.

La prochaine action est déterministe : vocabulaire dû, première conversation, première leçon, puis pratique régulière. Aucun LLM n’est nécessaire à cette décision et aucun gain de niveau n’est inventé.

## Immersion et correction

Chaque nouvelle conversation accepte une intensité d’immersion `guided`, `mixed` ou `full`, ainsi qu’une correction `light`, `balanced` ou `detailed`. Ces valeurs sont persistées dans `ExperienceSession.currentStep.metadata` et relues par Tutor à chaque tour. Elles modifient le comportement du Professeur, pas son identité.

Le Professeur reçoit aussi les derniers mots réellement enregistrés dans le deck de la langue. Les conversations libres conservent leurs erreurs dans l’historique et les corrections. L’extension RLLE ajoute une Mistake Memory bornée uniquement pour les erreurs structurées réellement observées dans ses missions ; elle ne requalifie pas rétroactivement l’historique libre. Aucune affirmation « erreur fréquente » ou Learning DNA n’est produite sans données suffisantes.

## ExperienceSession et reprise

Une conversation linguistique crée une `ExperienceSession` de type `language`, liée au `TutorSession` et au `LanguageProfile`. Elle conserve langue, niveau, objectif, mode, immersion, correction, modalité d’entrée, contextes, cible de reprise et prochaine action. Tutor recherche désormais les wrappers `tutor` et `language`, ce qui évite de dupliquer la session.

Le texte, les corrections et l’historique restent dans `TutorMessage`. Les productions de vocabulaire ajoutées depuis une session sont référencées dans ses productions bornées. Une session active ou en pause réapparaît dans le hub et peut reprendre sur son écran Tutor.

## Machine d’états voix

Le composant transversal `VoiceState` expose exactement :

1. `READY` : microphone disponible, aucune capture en cours ;
2. `LISTENING` : capture réelle, durée réelle, arrêt/pause/annulation ;
3. `TRANSCRIPTION` : upload unique et STT en cours, sans faux pourcentage ;
4. `THINKING` : le même tour Tutor traite la transcription envoyée ;
5. `RESPONSE` : réponse texte disponible, TTS manuel si disponible ;
6. `PAUSED` : capture suspendue et reprenable ;
7. `ERROR` : erreur exploitable, enregistrement ou texte conservé lorsque disponible.

Aucune waveform n’est affichée car les seams actuels ne fournissent pas d’amplitude fiable. `prefers-reduced-motion` n’est donc pas contourné par une animation artificielle.

## STT, transcription et TTS

`POST /speech/stt` transcrit une capture sans persister ni envoyer silencieusement le texte au Professeur. Le client place le résultat dans le composer : l’utilisateur peut le relire et le corriger, puis l’envoie par le chemin Tutor normal avec `viaVoice: true`. Cela évite le double upload et conserve le même contexte pédagogique.

`GET /speech/capabilities` indique les capacités réelles du provider actif. `POST /speech/tts` reste le seam de synthèse. La lecture est manuelle, chaque audio possède son texte visible, et un échec TTS ne retire jamais la réponse écrite. Le provider `fake` reste réservé au développement/test ; Gemini est le provider réel déjà câblé. Aucun nouveau provider Web n’est ajouté.

## Prononciation et feedback

L’exercice « dire une phrase » compare le texte réellement reconnu à la phrase cible. La métrique est une intelligibilité par reconnaissance de mots, pas une note d’accent ou de prononciation phonétique. Les mots non reconnus sont affichés comme tels.

Le coach accent/rythme/aisance/intonation n’est montré que lorsque `audioAnalysis` est réellement disponible. Il ne repose jamais sur un transcript présenté comme analyse acoustique. L’intensité de correction de conversation évite de corriger systématiquement chaque phrase.

## Vocabulaire, provenance et FSRS

Les mots extraits créent toujours des `Card` dans le deck du `LanguageProfile`. Le document source est lié par `sourceDocumentId` lorsqu’il existe. Une session source valide peut enregistrer une production bornée avec langue, termes, document et phrase/titre de provenance. La validation a lieu avant la création des cartes et vérifie utilisateur, type et profil de langue.

`/revision?languageProfileId=…` filtre le moteur Review existant sur le deck de cette langue. Chaque item renvoie `languageProfileId` et le nom de langue. Depuis un cours RLLE, `returnTo=course` permet le retour vers `/languages/[id]/course` ; ailleurs, le retour historique vers `/languages/[id]` est conservé. FSRS demeure l’unique ordonnanceur.

## CECRL et progression

Les niveaux A1 à C2 sont conservés. Les réponses distinguent `cefrLevelSource: declared` et `evaluatedCefrLevel: null`. RLLE ajoute un parcours A1–C2 et une progression fonctionnelle fondée sur des preuves, mais ne déduit toujours pas de passage A2 → B1 et n’alimente pas Learning DNA sans données comparatives suffisantes.

## RTL

Le registre marque l’arabe `rtl`. Les noms natifs et textes bilingues peuvent utiliser `writingDirection: rtl` et un alignement à droite, tandis que la navigation et la langue UI conservent leur propre direction. Les drapeaux restent décoratifs et l’icône arabe est neutre.

## Permissions, erreurs et offline

Les seams natif et Web traduisent le refus micro en message utilisable et ne redemandent pas en boucle dans une même action. Les cas capture vide, micro indisponible, pause/reprise, annulation, réseau/STT et TTS sont séparés. Le brouillon Tutor est stocké localement par utilisateur et session. L’état offline annonce que transcription et IA nécessitent une reconnexion au lieu de simuler une conversation.

## Quotas voix

Le catalogue commercial possède bien la métrique `voice_minutes`, mais aucune mesure serveur fiable de la durée audio ni aucun appel global à `UsageService.consume('voice_minutes')` n’existe encore. Le Lot 11 n’affiche donc ni restant, ni limite, ni reset pour la voix et n’enregistre pas une durée fournie par le client comme vérité de facturation.

Dépendance restante : mesurer côté serveur la durée décodée, choisir la granularité/règle de consommation, réserver puis libérer la consommation sur erreur provider, et exposer ce compteur dans le contrat Usage. Ce raccord commercial devra être validé séparément.

## Performance

- un seul upload STT par capture, avec retry du buffer en mémoire en cas d’échec ;
- taille multipart limitée à 10 Mio ;
- historique Tutor déjà borné côté API ;
- TTS manuel, caché et dédupliqué côté service ;
- derniers mots du prompt bornés à 12 ;
- productions de session bornées ;
- aucun historique audio persistant ni chargement audio massif ;
- sélecteur virtualisé par `FlatList`.

## Tests et limites connues

Les tests partagés couvrent le registre, les noms natifs, les codes/variantes, le RTL, les sept états, CECRL déclaré et la NBA. Les tests API couvrent prompt d’immersion, capacités/STT, session Langues, provenance FSRS, flux mobile éditable et isolation utilisateur. Le typecheck mobile vérifie les compositions responsive et les contrats FR/EN.

Limites connues : absence d’appareil iOS/Android dans l’environnement de CI, absence de métrique audio temps réel pour une waveform, pas d’évaluation CECRL normalisée, pas d’agrégat d’erreurs fréquentes, pas de quota voix serveur, et Reading général qui conserve son historique propre sans lien `LanguageProfile` persistant. Ces dépendances ne sont pas simulées.
