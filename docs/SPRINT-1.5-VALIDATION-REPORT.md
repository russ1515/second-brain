# SECOND BRAIN ADMIN — SPRINT 1.5 VALIDATION REPORT

Date de validation : 15 septembre 2026
Périmètre : validation et correction des fondations du Sprint 1 uniquement. Aucune fonctionnalité du Sprint 2 n'a été commencée.

## Database migration status

**PASS**

- Environnement dédié : PostgreSQL 16 Alpine dans le conteneur `second-brain-sprint15-20260915`, stockage `tmpfs`, exposé uniquement sur `127.0.0.1:15432`.
- Aucune base existante ou donnée de production n'a été utilisée.
- Le dépôt contient 51 migrations antérieures au Sprint 1.5 et la migration Sprint 1 `20260915090000_admin_commercial_foundation`, soit 52 migrations au total.
- Application sur base propre : 52/52 migrations appliquées avec succès et dans l'ordre du dépôt.
- Contrôle final PostgreSQL : 52 migrations terminées, 0 rollback.
- `prisma migrate status` : schéma à jour après déploiement.
- Aucun snapshot de staging n'était disponible dans l'environnement fourni. Il n'a donc pas été créé artificiellement ni remplacé par une base potentiellement sensible.

## PostgreSQL concurrency result

**PASS — 7/7 tests d'intégration PostgreSQL**

- Dernière unité PRIMARY, 10 consommations simultanées : 1 autorisée, 9 refusées.
- Dernière unité FALLBACK, 10 consommations simultanées : 1 autorisée, 9 refusées.
- Déduplication concurrente d'une même clé : 10 appels convergent vers 1 réservation et 1 écriture `RESERVE`.
- Contrôle SQL final : 0 compte avec consommation négative ou supérieure à sa limite.
- Contrôle SQL final : 0 doublon de clé de réservation et 0 doublon de clé ledger.

Preuve automatisée : `apps/api/test/sprint15-postgres.test.cjs`.

## PRIMARY/FALLBACK/BLOCKED result

**PASS**

- PRO : épuisement PRIMARY → FALLBACK de 500 unités AI text, soit exactement 50 % du quota FREE correspondant de 1 000 unités.
- PRO MAX : même calcul depuis le quota FREE correspondant, sans dériver la réserve du plafond payant.
- Épuisement FALLBACK → BLOCKED, sans changement du plan commercial.
- Renouvellement : création d'un nouveau cycle PRIMARY, `fallbackUsed = 0`, conservation et fermeture du cycle précédent.
- Les ressources exprimées en minutes côté plan FREE sont converties en secondes avant le calcul du fallback quand la ressource le requiert.

## Anti-double-credit result

**PASS**

- PRO consommé → FALLBACK consommé → downgrade FREE dans la même période : aucun nouveau crédit FREE à 100 %, cycle et consommation conservés.
- PRO MAX → PRO dans la même période : aucun second cycle ni double crédit.
- Un vrai renouvellement de période reste distinct d'un changement de plan dans la période courante.

## Webhook idempotency result

**PASS — 5/5 tests d'intégration webhook sur API et PostgreSQL réels**

- Paiement Stripe correctement signé : traité une fois.
- Événement dupliqué : aucun double Payment, Invoice, Subscription, Billing Cycle, quota ou Audit Log.
- Signature invalide : refusée sans persistance métier.
- Échec partiel provoqué puis retry du payload strictement identique : état `failed` puis `processed`, `attemptCount = 2`, sans double crédit ni double paiement.
- Événement hors ordre : détecté, audité et ignoré sans régression de la période d'abonnement.
- Paiement échoué dupliqué : un seul paiement en échec et un seul audit.
- Renouvellement : ancien cycle conservé, nouveau cycle alloué une seule fois.
- Une réutilisation du même identifiant d'événement avec un payload différent est rejetée.

Preuve automatisée : `apps/api/test/sprint15-webhook.test.cjs`.

## Account security result

**PASS — parcours API réel**

- ACTIVE : login et JWT autorisés.
- SUSPENDED : login, refresh et JWT déjà émis refusés.
- REACTIVATED : ancien JWT toujours refusé, nouveau login autorisé.
- BANNED : login, refresh et JWT refusés.
- Révocation de session vérifiée via logout serveur.
- L'ancien token reste invalidé grâce à la rotation de version de sécurité du compte.

Preuve automatisée : `apps/api/test/sprint15-api-security.test.cjs`.

## Admin MFA/browser result

**PASS — bundle Admin de production dans un vrai navigateur**

- Login administrateur → MFA/TOTP obligatoire → Control Center.
- Mauvais TOTP refusé ; bon TOTP accepté.
- Recovery code implémenté : accepté une seule fois puis refusé à la réutilisation via le même endpoint MFA.
- Session MFA vieillie au-delà du TTL : refus `ADMIN_SESSION_EXPIRED` et retour au login.
- Logout : révocation serveur confirmée et retour au login ; aucune session navigateur admin active restante.
- Utilisateur normal : réponse 403 et message d'autorisation, sans fausse demande MFA.
- RBAC SUPPORT : accès admin de base autorisé, capacité critique de bannissement refusée.
- Step-up sur action critique : exigé et renouvelable par TOTP.

Cette validation navigateur a révélé deux défauts corrigés : l'ordre RBAC/MFA du guard admin et un logout auparavant seulement local au navigateur.

## Security result

**PASS**

- Recherche finale dans les bundles Admin et Mobile Web : aucune signature de secret (`sk_live`, `sk_test`, `whsec`, URL PostgreSQL avec identifiants, clé privée).
- Réponses réseau inspectées pendant le parcours admin : aucune configuration backend ou secret serveur exposé.
- Logs API observés : aucun mot de passe, TOTP, token brut, secret webhook ou donnée de paiement sensible.
- Scan PostgreSQL d'Audit Log et Security Events : aucune occurrence des secrets utilisés par les scénarios de test.

## Regression result

**PASS**

- `pnpm typecheck` : PASS pour Shared, Admin, API et Mobile.
- Tests Shared : 58/58 PASS.
- Tests API/Sprint 1 : 107/107 PASS.
- Tests Sprint 1.5 PostgreSQL : 7/7 PASS.
- Tests Sprint 1.5 webhooks : 5/5 PASS.
- Tests Sprint 1.5 sécurité compte/API : 1/1 PASS.
- Build API : PASS.
- Build Admin : PASS.
- Export Mobile Web : PASS, 946 modules assemblés et export `dist` produit.

## Problems corrected

1. Le fallback payant était calculé depuis le quota payant au lieu de 50 % du quota FREE correspondant.
2. Les clés d'idempotence du ledger pouvaient entrer en collision entre utilisateurs.
3. Les conflits PostgreSQL sérialisables/concurrents (`P2034`/`P2002`) n'étaient pas rejoués de façon bornée.
4. Un renouvellement pouvait réutiliser l'ancien cycle ; la distinction renouvellement/changement de plan dans la même période a été corrigée.
5. Le démarrage Nest réel échouait sur la résolution d'`AdminIdentityService` dans `MonitoringModule`.
6. Les webhooks ne garantissaient pas complètement l'audit transactionnel, le rejet des payloads divergents, la prise atomique d'un événement et la protection contre les événements hors ordre.
7. Un utilisateur non-admin pouvait recevoir une demande MFA au lieu d'un refus RBAC 403.
8. Le logout Admin supprimait uniquement l'état client et ne révoquait pas la session serveur.
9. Le message de session Admin expirée ne distinguait pas correctement l'expiration MFA.

## Remaining conditions

- Aucun snapshot de staging n'a été fourni ; seule la migration complète depuis une base PostgreSQL dédiée et propre a pu être validée. Une migration de snapshot reste à exécuter si un snapshot non-production devient disponible.
- Qdrant n'a pas été provisionné dans ce banc de test. Le healthcheck global peut donc le signaler indisponible, sans incidence sur les fondations Sprint 1.5 validées ici.
- Sous Docker Desktop Windows, lancer plusieurs suites d'intégration complètes en parallèle peut saturer temporairement le proxy TCP local (`P1001`). Les suites finales ont été exécutées séquentiellement. La concurrence métier exigée de 10 requêtes simultanées est, elle, validée.
- Les conteneurs PostgreSQL et Redis dédiés sont conservés temporairement pour inspection ; ils ne contiennent que des données de test Sprint 1.5.

## Conclusion

**SPRINT 2 READY**

STOP — aucun travail Sprint 2 n'a été commencé.
