# SECOND BRAIN ADMIN — SPRINT 3 VALIDATION REPORT

Date : 16 septembre 2026
Périmètre : validation/correction Sprint 3 et régression Sprint 1 / Sprint 1.5 / Sprint 2. Aucun travail Sprint 4 n’a été engagé.

## Résumé exécutif

Les fondations Admin Sprint 3 ont été validées sur une instance PostgreSQL dédiée et jetable (`secondbrain_sprint3`), jamais sur une base de production. Les migrations, les droits Admin/MFA, le détail utilisateur, les quotas, les webhooks, le dashboard et les builds sont verts après corrections.

Un défaut réel de concurrence FALLBACK a été découvert puis corrigé : sous dix requêtes simultanées sur la dernière unité, Prisma pouvait expirer avant de démarrer une transaction interactive (`P2028`). La correction garde l’allocation atomique et sérialisable, augmente le délai borné de démarrage de transaction, réessaie uniquement les erreurs de contention sûres, et calcule l’état PRIMARY/FALLBACK/BLOCKED dans la transaction gagnante. Le test PostgreSQL complet est ensuite repassé à 7/7.

## Pré-vol et base de données

| Contrôle | Résultat |
|---|---|
| Environnement | PASS — PostgreSQL isolé sur `127.0.0.1:15433`, base `secondbrain_sprint3`; conteneurs de test séparés, sans données de production. |
| Historique des migrations | PASS — 53 migrations historiques; deux migrations Sprint 3 initiales, puis une réconciliation additive/idempotente n°56. Aucune migration historique n’a été modifiée. |
| Divergence découverte | CORRIGÉE — une DB propre a révélé l’absence de la table/énums/FK/index `onboarding_profiles` attendus par le schéma. La migration `20260915132000_onboarding_profile_schema_reconciliation` les réconcilie de façon additive. |
| État Prisma final | PASS — `prisma migrate status` : 56 migrations, schéma à jour. |
| Diff Prisma ↔ PostgreSQL | PASS — migration vide (`-- This is an empty migration.`). |
| Snapshot staging | NON FOURNI — la preuve porte sur la base PostgreSQL dédiée, pas sur une copie de staging. |

## Validation fonctionnelle Sprint 3

| Domaine | Résultat et preuve |
|---|---|
| Annuaire, recherche, filtres, pagination | PASS — pagination serveur bornée, recherche serveur, profil minimisé; intégration PostgreSQL et smoke HTTP. |
| Fiche utilisateur | PASS — vue d’ensemble rapide, panneaux indépendants chargés à la demande; détail HTTP de fixture sous le timeout UI. |
| États de compte | PASS — suspend, reactivate, ban, révocation de sessions et demande de suppression audités/persistés. |
| Learner Profile | PASS avec limites — accès standard/minimisé, accès hautement restreint avec capability, reason, step-up et audit. Identity Verification reste `NOT_IMPLEMENTED`; documents/conversations hautement restreints restent `HIGHLY_RESTRICTED_NOT_IMPLEMENTED`. |
| Subscription, overrides, beta | PASS serveur — plan effectif, override temporaire, beta entitlement, historique et audit préservés; aucune écriture de paiement par l’Admin. L’expiration observée en temps réel reste `NOT VERIFIED`. |
| Quotas et crédit Admin | PASS — `ADMIN_CREDIT` applique d’abord le fallback puis le primaire via ledger, sans reset d’usage. |
| Paiements | PASS — lecture seule, montant/devise/statut/date; référence fournisseur masquée. |
| Notes support et audit | PASS — note persistée et visible même à l’état vide; les contenus sensibles ne sont pas injectés dans les moteurs apprenant. |
| Reports/errors | `NOT_INSTRUMENTED` — aucune métrique fictive n’est substituée. |

## Quota, concurrence et anti-double-crédit PostgreSQL

`test/sprint15-postgres.test.cjs` : **7/7 PASS** sur PostgreSQL réel.

- PRO et PRO MAX : FALLBACK = 50 % du quota FREE correspondant.
- Dernière unité PRIMARY, 10 requêtes concurrentes : exactement 1 autorisation, 9 refus `QUOTA_EXHAUSTED`, aucun dépassement, 2 réservations/ledgers attendus seulement.
- Dernière unité FALLBACK, 10 requêtes concurrentes : exactement 1 autorisation, 9 refus `QUOTA_EXHAUSTED`, aucun dépassement ni double ledger.
- Doublon de clé d’idempotence : une seule réservation et une seule écriture `RESERVE`.
- PRO → FREE et PRO MAX → PRO : aucun nouveau cycle FREE complet dans la même période; consommation et cycle de référence conservés.

## Webhooks, sécurité de compte et RBAC

| Suite réelle | Résultat |
|---|---|
| `sprint15-webhook.test.cjs` | **5/5 PASS** — signature valide/invalide, doublon, événement partiellement échoué puis rejoué, ordre des renouvellements, nouveau cycle, paiement échoué, idempotence/atomicité/audit. Une clé de signature uniquement locale et éphémère a été utilisée pour cette exécution. |
| `sprint15-api-security.test.cjs` | **1/1 PASS** — ACTIVE, SUSPENDED, REACTIVATED, BANNED; login/refresh/JWT; MFA, recovery code à usage unique, step-up, logout serveur, normal user 403 et rôle SUPPORT sans droit de ban. |
| `sprint3-admin-http-smoke.cjs` | PASS — MFA Admin, code de step-up invalide en `403 MFA_CODE_INVALID` sans invalider la session, step-up valide, annuaire/recherche/détail, et RBAC normal user. |

La MFA Admin est obligatoire. Un mauvais code de step-up ne déconnecte plus artificiellement le client : le serveur retourne un `403` typé, tandis qu’un JWT réellement révoqué reste refusé.

## Dashboard et navigateur Admin

| Contrôle | Résultat |
|---|---|
| Dashboard Sprint 2 unitaire | **9/9 PASS**. |
| Dashboard Sprint 2 HTTP/PostgreSQL | **3/3 PASS** — agrégats sans données privées, plage invalide/normal user refusés, sections RBAC isolées. |
| Vrai navigateur Admin | PASS — login MFA, mauvais/bon TOTP, Control Center, annuaire paginé, détail, profil restreint audité, plan override, quota credit, note Support, step-up suivi d’une action critique, normal user 403, FR/EN, clair/sombre et largeurs 1440/1024/768 sans débordement horizontal. |
| Accessibilité | PARTIAL — libellés, tabs et dialogues sont présents; parcours clavier exhaustif/lecteur d’écran non rejoués. |
| Recovery code dans l’UI | `NOT VERIFIED` — le flux API est validé, mais le champ navigateur reste à vérifier avec un recovery code. |

Une tentative de relecture navigateur finale a été interrompue par le contrôleur local, après les validations visibles ci-dessus. Les modifications postérieures concernaient uniquement la contention quota backend; le smoke HTTP, les tests PostgreSQL et les builds correspondants sont verts.

## Régression

| Commande/suite | Résultat |
|---|---|
| `pnpm --filter @second-brain/api run test:unit` | **107/107 PASS** — inclut auth, RBAC, quotas, audit et fondation webhook. |
| `test/user-admin-sprint3.test.cjs` | **6/6 PASS**. |
| `test/sprint3-postgres.integration.test.cjs` | **3/3 PASS** sur PostgreSQL réel. |
| `pnpm --filter @second-brain/shared run test` | **58/58 PASS**. |
| `pnpm typecheck` | PASS — Shared, API, Admin et Mobile. |
| API build | PASS — Prisma generate puis Nest build. |
| Admin build | PASS — export Web. |
| Mobile Web | PASS — typecheck puis export Web (946 modules). |

## Contrôles de confidentialité et secrets

- Scan des bundles Admin et Mobile générés : **0 marqueur de secret connu** (`DATABASE_URL`, clés JWT, Stripe, SMTP, TOTP ou OpenAI).
- Les tests de sécurité sérialisent Audit Log/Security Events et vérifient l’absence de mot de passe, secret TOTP, JWT ou refresh token.
- Les tests Admin vérifient la rédaction récursive des données sensibles et l’absence de références fournisseur brutes dans les vues agrégées.

Ce contrôle est une validation statique et contractuelle; il ne remplace pas un audit de sécurité externe ni une revue de logs d’infrastructure de production.

## Problèmes corrigés

### Produit

- Réconciliation additive du schéma `OnboardingProfile` révélée par une DB propre.
- Concurrence quota FALLBACK : démarrage de transaction Prisma borné mais suffisamment tolérant, retry sûr des erreurs de pool/démarrage, état quota calculé par l’allocation gagnante.
- Chargement de fiche utilisateur rendu paresseux pour éviter le timeout UI.
- Dashboard exécuté par petits lots, évitant l’épuisement du pool Prisma au login.
- Timeout HTTP Admin réglable et borné à 30 s par défaut.
- Erreur de step-up TOTP structurée en `MFA_CODE_INVALID`, sans effacement abusif de session côté Admin.
- Formulaire de note Support disponible lorsque l’historique est vide; protection contre réponses UI périmées lors d’un changement d’utilisateur.

### Harness de validation

- Fixture sécurité adaptée au RBAC persistant (`SUPER_ADMIN`) plutôt qu’au bootstrap legacy volontairement désactivé.
- Fixture MFA vieillie au-delà de la durée maximale configurée de 8 h, au lieu de 2 h valides.
- Smoke annuaire corrigé pour rechercher l’utilisateur de fixture côté serveur, plutôt que de supposer qu’il reste sur la première page.

## Conditions et limites connues

- `Identity Verification` : `NOT_IMPLEMENTED`.
- Documents/conversations hautement restreints : `HIGHLY_RESTRICTED_NOT_IMPLEMENTED`.
- Language Text/Voice et plusieurs métriques d’usage sans ledger durable : `NOT_INSTRUMENTED`.
- Livraison effective de `REQUEST_USER_UPDATE` de profile review : `NOT_INSTRUMENTED`.
- Reports utilisateur, corrélation d’erreurs et benchmark sur historique massif : `NOT_INSTRUMENTED` ou `NOT VERIFIED`.
- Validation navigateur complète de l’application apprenant : PARTIAL (typecheck/export Mobile Web verts, mais pas de parcours E2E apprenant rejoué ici).
- Révocation individuelle/totale via l’UI Admin et expiration observée d’override/beta : à rejouer séparément si ces écrans deviennent un prérequis de mise en production.
- Aucun snapshot staging non-production n’a été fourni.

## Nettoyage de validation

- Fixture navigateur Sprint 3 supprimée via son mécanisme explicite de cleanup.
- API locale de test et serveur statique Admin temporaire arrêtés.
- Conteneurs Docker `sb-sprint3-pg`, `sb-sprint3-redis` et `sb-sprint3-qdrant`, tous étiquetés `sprint3-validation`, supprimés avec leurs seules données de test.
- Les ports temporaires 8083, 3104, 15433, 16380 et 16333 ne sont plus à l’écoute.

## Conclusion

**SPRINT 4 READY WITH CONDITIONS**

Les fondations critiques Admin, PostgreSQL, quotas, webhooks, MFA/RBAC et régressions de build/test sont prêtes. Les conditions ci-dessus doivent rester visibles dans le backlog et ne doivent pas être remplacées par des données fictives. Aucun Sprint 4 n’a été commencé dans cette validation.
