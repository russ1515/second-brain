# SECOND BRAIN ADMIN — SPRINT 2 REPORT

Date de validation : 15 septembre 2026
Périmètre : **Global Control Dashboard** uniquement. Aucune capacité de Sprint 3 n’a été commencée.

## 1. Executive Summary

Le Sprint 2 livre un tableau de bord de contrôle global réservé aux administrateurs habilités. Il lit des agrégats réels depuis les services existants, sans identité, contenu utilisateur, paiement détaillé ni valeur simulée. Les vérifications établies couvrent une base PostgreSQL de test dédiée, les 53 migrations, les routes RBAC/MFA, les agrégats, les tests d’intégration HTTP et le parcours navigateur MFA.

Les données qui ne disposent pas encore d’une instrumentation durable sont explicitement signalées `NOT_INSTRUMENTED`; elles ne sont ni estimées ni remplacées par des données fictives. Le statut `DOWN` de Qdrant observé pendant la validation est intentionnel dans l’environnement local de staging et confirme le comportement de dégradation attendu.

## 2. Dashboard Architecture

Le dashboard est servi par un module API d’administration dédié, protégé par authentification JWT, MFA administrateur et capacités RBAC. Une seule lecture `GET /api/admin/dashboard` retourne une enveloppe de sections indépendantes, afin qu’une dépendance indisponible ou une section interdite ne rende pas tout le dashboard inutilisable.

Chaque section expose un statut `available`, `unavailable` ou `error`, des données agrégées lorsque cela est autorisé, et une raison non sensible lorsque les données ne peuvent pas être affichées. Le cache applicatif est limité à 30 secondes et est porté par le contexte de capacité.

## 3. APIs Created

Les routes suivantes ont été ajoutées dans l’API admin :

- `GET /api/admin/dashboard?range=today|7d|30d`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/health`
- `GET /api/admin/dashboard/alerts`
- `GET /api/admin/dashboard/activity`

Les bornes de périodes sont calculées en UTC. Les routes appliquent `JwtAccessGuard`, le contrôle MFA administrateur et le contrôle de capacité avant de retourner toute donnée.

## 4. Queries/Aggregations

Les requêtes utilisent des comptes, distributions, tendances et états provenant des tables opérationnelles existantes. Elles ne réalisent pas d’export de lignes nominatives. Les sections à dépendances partielles isolent leurs erreurs afin de maintenir les sections indépendantes disponibles.

## 5. Global KPIs

Les KPI globaux exposent le nombre total d’utilisateurs, les utilisateurs actifs aujourd’hui, sur 7 jours et sur 30 jours, ainsi que les nouveaux utilisateurs du jour et du mois. Les calculs sont fondés sur les dates persistées et les fenêtres UTC, sans approximation de données manquantes.

## 6. User Metrics

Les métriques utilisateurs sont présentées sous forme de volumes et de tendances agrégés. Aucune adresse e-mail, identifiant utilisateur, donnée de profil, document ou autre contenu personnel n’est renvoyé par l’API du dashboard.

## 7. Plan Metrics

Les plans FREE, PRO et PRO MAX sont regroupés par agrégat. Les comptes historiques non assignés ou associés à un plan non reconnu restent comptabilisés sans être artificiellement reclassés.

## 8. Subscription States

La distribution des états d’abonnement est agrégée par état. La logique de dashboard n’altère ni les abonnements, ni les prix, ni les quotas et ne déclenche aucune écriture métier.

## 9. Quota Metrics

Les cycles de quota actifs et les états PRIMARY, FALLBACK et BLOCKED sont agrégés depuis les cycles réels. Les seuils d’alerte 70 %, 85 % et 95 % sont calculés au niveau agrégé; aucune réservation ou consommation n’est effectuée par le dashboard.

## 10. Usage Metrics

Les compteurs d’usage disponibles s’appuient sur les traces de consommation durables. Les ressources sans instrumentation exploitable sont signalées comme non instrumentées au lieu d’être affichées comme zéro ou comme une estimation.

## 11. Languages Metrics

Les métriques de langues ne sont exposées que lorsqu’une source durable permet leur calcul. Les répartitions pédagogiques ou niveaux non persistés de manière suffisante restent marqués `NOT_INSTRUMENTED`.

## 12. Learning Engine Metrics

L’activité des moteurs d’apprentissage est retournée sous forme d’agrégats par moteur. Les libellés affichés sont localisés et ne divulguent pas les contenus d’apprentissage, les réponses ou les identifiants des apprenants.

## 13. AI Metrics

Les métriques IA reposent uniquement sur l’usage fournisseur durable disponible. Les mesures de coût, qualité, réemploi de jetons ou autres indicateurs non instrumentés restent explicitement indisponibles.

## 14. Voice Metrics

Les métriques voix sont limitées aux compteurs agrégés réellement persistés. Aucun audio, transcript, identifiant d’utilisateur ou donnée de session n’est présent dans la réponse.

## 15. Document Metrics

Les métriques documents n’exposent que des volumes agrégés issus de l’usage durable. Les noms de documents, contenus, extraits, propriétaires et chemins restent exclus du dashboard.

## 16. Brain/Digital Twin Metrics

Les métriques Brain/Digital Twin sont limitées aux événements agrégés disponibles. Les données représentant un profil, un graphe individuel ou un contenu personnel ne sont ni interrogées ni retournées.

## 17. System Health

La santé système vérifie les dépendances réellement interrogeables : API, PostgreSQL, Redis et Qdrant. Les dépendances non sondées restent `unknown` plutôt que supposées saines. Lors de cette validation locale, Qdrant a volontairement été configuré indisponible et le dashboard l’a correctement affiché `DOWN` sans faire échouer les autres sections.

## 18. Incident Summary

Le résumé d’incidents est agrégé et soumis à la capacité `bugs.read`. En l’absence de source ou de signal durable, la réponse indique une indisponibilité explicite; elle ne crée pas d’incident fictif.

## 19. Security Summary

Le résumé sécurité agrège uniquement des indicateurs autorisés (par exemple états de compte et événements de sécurité). Il ne contient ni jeton, ni secret, ni adresse IP, ni métadonnée sensible d’événement de sécurité.

## 20. Alerts

Les alertes sont dérivées des seuils de quota et de l’état des dépendances. Elles sont dédupliquées à l’affichage et gardent un niveau de sévérité. L’alerte Qdrant observée pendant le test est la conséquence attendue de la dépendance localement indisponible, non un défaut produit.

## 21. Recent Activity

L’activité récente est une synthèse limitée des types d’événements d’audit autorisés. Les identifiants, cibles, métadonnées, valeurs avant/après, e-mails et données métier détaillées sont exclus.

## 22. RBAC

L’accès au dashboard exige une session administrateur MFA et la capacité `dashboard.read`. Les sous-sections sont isolées par capacité : abonnements/plans, quotas, usage, infrastructure, incidents, sécurité et audit. Un rôle ayant un accès partiel reçoit les sections interdites sous forme d’enveloppes `unavailable`, sans fuite de données; un utilisateur normal reçoit un refus d’accès.

## 23. Privacy

Le contrat de réponse est agrégé par conception. Les contrôles automatisés vérifient l’absence d’identifiants, e-mails, références de paiement, contenu de document, adresse IP, secret, jeton et métadonnée d’audit sensible. Cette règle s’applique aussi à l’activité récente et aux états d’erreur.

## 24. i18n

Le client admin propose les libellés du dashboard en français et en anglais. Les clés techniques des métriques, moteurs, ressources, composants de santé et alertes sont converties en libellés localisés; les clés brutes ne constituent pas des données de présentation.

## 25. Responsive

La mise en page est conçue pour les formats bureau, tablette et mobile, avec points de rupture pour la navigation et les grilles de cartes. Le dashboard conserve ses données réelles, ses états de chargement et ses contrôles de période sur les tailles de vue prises en charge.

## 26. Accessibility

Les composants fournissent des rôles, libellés et états accessibles pour la navigation, le changement de thème, de langue, les périodes et les actions de session. Le navigateur confirme les boutons nommés, le rôle `tablist`, l’état `aria-selected` exact des périodes, le menu compact, ainsi que la focalisation clavier de l’aide contextuelle des KPI.

## 27. Performance

L’écran charge l’enveloppe globale avec une requête principale, puis peut rafraîchir manuellement ou automatiquement toutes les 60 secondes. Le cache côté API est plafonné à 30 secondes, ce qui évite des scans inutiles tout en conservant une visibilité opérationnelle récente.

## 28. Migrations/Indexes

Une migration additive Sprint 2 ajoute les index d’agrégation sur l’activité et la création des utilisateurs, les cycles de quota et l’usage fournisseur. Sur la base PostgreSQL dédiée `secondbrain_sprint2`, `prisma migrate status` a trouvé 53 migrations et a confirmé que le schéma est à jour. Aucune base de production n’a été utilisée.

## 29. Tests

Les résultats établis pendant la validation sont :

- tests unitaires dashboard : 9/9 réussis ;
- tests HTTP réels du dashboard : 3/3 réussis ;
- suite API complète : 107/107 réussis ;
- suite shared : 58/58 réussis.

Les tests couvrent notamment les périodes UTC, les agrégats de plans et quotas, les dépendances partielles, l’authentification, MFA, RBAC, l’accès utilisateur normal refusé et les sentinelles de confidentialité.

## 30. Typecheck

`pnpm typecheck` a réussi pour les quatre paquets concernés : shared, API, Admin et Mobile. Le typecheck Admin a également été exécuté après les corrections de libellés et d’accessibilité.

## 31. Builds

Les builds finaux ont tous réussi : API (`prisma generate` puis `nest build`), Admin (`expo export` web) et Mobile Web (`expo export --platform web`).

## 32. Browser Validation

Dans un vrai navigateur, le parcours administrateur a validé : login, challenge MFA obligatoire, rejet d’un code MFA incorrect, acceptation d’un code MFA valide, accès au dashboard réel, changement de période, rafraîchissement manuel, thème clair/sombre, français/anglais, navigation compacte, menu mobile et logout vers l’écran de login. Un utilisateur normal a reçu le refus visuel 403 attendu.

Le rendu et les grilles ont été vérifiés à 1440 px, 1024 px et 768 px. La validation utilisait uniquement des comptes et une base de test dédiés, ensuite supprimés ; aucun identifiant, code TOTP ou secret n’est inclus dans ce rapport.

Un proxy local de test à même origine a été utilisé uniquement pour contourner la restriction de réseau du navigateur embarqué vers le port API local. Il ne modifie ni l’API produit, ni sa configuration, ni son contrat de sécurité.

## 33. Known Limitations

Les limites connues sont explicitement visibles : dépendances non sondées en état `unknown`, Qdrant local volontairement indisponible en état `DOWN`, et absence de métriques sans source durable. Elles ne masquent pas un défaut de sécurité ou une panne silencieuse du dashboard.

## 34. Not Instrumented Metrics

Sont laissés `NOT_INSTRUMENTED` les indicateurs qui ne possèdent pas encore une source de vérité durable, notamment certaines répartitions de langues et de niveaux, des mesures pédagogiques détaillées, des coûts/qualités IA et des métriques de réemploi de jetons. Ils ne doivent pas être utilisés comme zéro, objectif ou décision produit avant instrumentation.

## 35. Technical Debt

La dette technique identifiée est principalement l’instrumentation durable des métriques marquées `NOT_INSTRUMENTED` et le sondage explicite des dépendances aujourd’hui `unknown`. Ces chantiers doivent conserver les règles de minimisation des données, RBAC et agrégation avant toute exposition au dashboard.

Un défaut d’intégration relevé par le navigateur a été corrigé : certaines clés techniques réelles (`key`/`state`) n’étaient pas résolues en libellés d’interface, ce qui masquait notamment certains KPI et états de quota. Les clés sont maintenant localisées en français et anglais, les périodes exposent `aria-selected` et les contrôles de shell sont explicitement nommés. Les typechecks, tests Dashboard et build Admin ont confirmé le correctif.

## 36. Sprint 3 Readiness

Le périmètre Sprint 2 est fonctionnel et les validations finales sont vertes. Les conditions de passage sont de conserver les métriques non instrumentées comme telles, de ne pas confondre le `DOWN` Qdrant local intentionnel avec une panne de production, et de planifier l’instrumentation manquante avant de s’appuyer sur ces indicateurs pour des décisions opérationnelles. Aucun travail de Sprint 3 n’a été commencé.

## Conclusion

**SPRINT 3 READY WITH CONDITIONS**
