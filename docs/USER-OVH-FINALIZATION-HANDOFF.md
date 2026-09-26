# Second Brain — remise finale User sur OVH

Dernière vérification : **26 septembre 2026** (Europe/Paris).

Ce document clôt uniquement la consolidation User demandée. Il ne démarre pas le Sprint 6, ne change aucun prix ou quota commercial, ne lance aucune migration et n'active aucun fournisseur payant.

## 1. Version stable réellement servie

| Élément | Valeur vérifiée |
| --- | --- |
| Branche de déploiement | `origin/codex/staging-ovh-2026-09-23` |
| Révision User exécutée | `ead28ac357a0dcda7464b7b1daeaff7e4344b41a` |
| Image User | `second-brain-user-web:ead28ac-user-final` |
| ID de l'image | `sha256:332491924f2f8a722f01e8571201d58f5c15c814041bf97c388ea76d7347eb8b` |
| Conteneur User | `sb-user-web-8082` — healthy, réseau hôte, restart `unless-stopped` |
| API P1 | `sb-ovh-p1-http-20260923163756-0a803ec4-api-1`, image `second-brain-p1-api:f754c0e-quota200`, ID `sha256:1a101fad6259f515fe2ad2dd2bc1f1b226783c75b52e1bbc2ddd2927379837ae`, healthy |
| Admin P1 | `sb-ovh-p1-http-20260923163756-0a803ec4-admin-1`, image `second-brain-p1-admin:20260923163756-0a803ec4`, ID `sha256:19a053872b86c133bfdb121f8b21959c71581bf709ccff335f00fe438daa31ce`, healthy |
| Mode API staging | `NODE_ENV=test` |
| Répertoire VPS | `/home/ubuntu/second-brain-staging` |
| Preuves privées | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/user-deploy-20260926T145744Z` |

L'export Web de cette image a été construit avec :

- `EXPO_NO_DOTENV=1` ;
- `EXPO_PUBLIC_FEATURE_NEW_LANDING=true` ;
- `EXPO_PUBLIC_FEATURE_NEW_APP_SHELL=true`.

Ces deux flags sont injectés **au build**, pas après l'export. Dans le navigateur déployé, `window.location.origin` est disponible et le client utilise donc l'API de même origine; Nginx relaie `/api` vers `127.0.0.1:3106`. Le bundle conserve un dernier fallback de développement `localhost:3000` pour un contexte sans origine, mais ce fallback n'est pas sélectionné sur la page OVH et aucune variable `EXPO_PUBLIC_API_URL` ne le force. `/api/admin` reste bloqué sur le service User.

Le commit `ead28ac` normalise également les permissions des fichiers statiques (`0755` pour les dossiers, `0644` pour les fichiers), ce qui corrige le `403` observé lors de la première tentative de bascule. Les réponses de l'API User et la racine ont `Cache-Control: no-store`; les assets versionnés ont `no-cache`.

`NODE_ENV=test` est une limite explicite du staging privé actuel. Cette remise valide une version démontrable dans ce périmètre; elle ne la qualifie pas de configuration production.

Limite d'en-têtes connue : le chemin navigateur User `8082/api/...` ajoute bien `no-store`, y compris sur le `401` non authentifié de `/api/auth/2fa/setup`. Les mêmes réponses interrogées directement sur l'API loopback `3106` n'ajoutent pas cet en-tête. Le port direct n'est pas public, mais toute future exposition qui contournerait Nginx devra corriger ce point côté API.

## 2. Provenance des changements récupérés

- **Landing complète** : série existante de commits Lot 12, notamment `b2a3ce0`, `cae4940`, `97bc0c9`, `0a50f8a`, `5cc0e37`, `49ab40e`, `ab1a4db` et `78826c5`. Aucun redesign supposé n'a été recréé.
- **Réviser, surface sombre continue** : `9b1823c fix(study): fill review screen with theme background`, toujours ancêtre de la version exécutée. L'écran utilise `c.background` pour les états chargement, erreur et contenu dans `apps/mobile/app/(tabs)/study.tsx`.
- **Compléments i18n et résolution régionale** : `6399e92 feat(i18n): preserve regional locale checkpoint`.
- **Entrée staging, MFA Web minimal et contrat de build** : `e786667 feat(user): finalize staging entry and MFA enrollment`.
- **Permissions de l'image statique** : `ead28ac fix(staging): normalize user web asset permissions`.

Les correctifs API, OTP, bêta privée, quotas et MFA existants ont été conservés. `apps/mobile` n'a pas été remplacé par une copie ancienne.

## 3. Liens privés vérifiés depuis Windows

Ces URL fonctionnent uniquement tant que le tunnel SSH local est ouvert. Elles ne sont pas partageables avec des invités.

- Landing User : <http://127.0.0.1:18084/>
- Connexion : <http://127.0.0.1:18084/sign-in?mode=login>
- Inscription : <http://127.0.0.1:18084/sign-in?mode=register>
- Admin privé : <http://127.0.0.1:18083/login>

Le 26 septembre 2026, la Landing et la page Admin ont répondu en HTTP 200 à travers le tunnel. La racine User a été vérifiée visuellement : elle affiche la Landing complète, son CTA mène au mode inscription, le mode connexion est accessible et la langue française est active. Le rendu arabe RTL ainsi que les sélections espagnole et allemande ont aussi été observés sur cette version.

### Lanceur Windows sûr

Depuis PowerShell :

```powershell
& 'C:\Users\user\Second Brain\.p1-quality-worktree\scripts\open-ovh-private-staging.ps1' -OpenPages
```

Le lanceur :

- vérifie d'abord les deux endpoints existants ;
- ne duplique pas un tunnel valide ;
- refuse de remplacer ou d'arrêter un processus étranger qui occupe un port ;
- crée seulement les redirections `18084 → 8082` et `18083 → 8083` ;
- n'embarque aucun mot de passe, token ou secret.

La clé hôte OVH doit déjà être vérifiée dans `known_hosts`, et la clé utilisateur doit être utilisable sans saisie interactive (fichier protégé ou agent SSH). Le lanceur impose `StrictHostKeyChecking=yes` et refuse donc une clé hôte inconnue ou modifiée. Le tunnel actuel a été lancé avec le PID `3216`; ce PID n'est pas une garantie après redémarrage de Windows.

## 4. Couverture i18n réellement vérifiée

L'audit courant porte sur **27 locales enregistrées** et **3 681 clés source**.

### Locales complètes pour la présence des clés

`en`, `fr`, `es`, `de`, `it`, `pt`, `nl`, `pl`, `ru`, `zh`, `ko`, `ar`, `hi` — **13/27**.

### Locales encore partielles

- `tr` : 3 492/3 681, soit 94,9 %, 189 clés manquantes ;
- `ja` : 2 592/3 681, soit 70,4 %, 1 089 clés manquantes ;
- `sv`, `vi`, `th`, `el`, `cs`, `ro`, `hu`, `da`, `fi`, `id`, `no`, `uk` : 1 992/3 681 chacune, soit 54,1 %, 1 689 clés manquantes chacune.

Total : **21 546 clés manquantes**, **0 erreur d'intégrité hors traductions manquantes**, et **968 valeurs identiques à l'anglais signalées comme diagnostics**. Le gate strict final reste donc **NO**. Cela ne signifie pas que l'application est traduite à 100 % dans 27 langues.

Les clés essentielles de l'écran Réviser et du parcours MFA ont un fallback/review dédié sur les 27 locales, mais la qualité linguistique native de l'ensemble du produit n'a pas été certifiée. La présence d'une clé, une valeur identique à l'anglais, un fallback et une traduction relue sont quatre états différents.

Anomalie linguistique visible connue et volontairement non corrigée juste avant la démonstration : la Landing allemande contient `Fortstreiten` (`apps/mobile/lib/locales/de.ts`), à reprendre en `Fortschreiten` lors de la poursuite i18n. Éviter une démonstration allemande tant que cette correction n'a pas été reconstruite, déployée et retestée.

La résolution de locale préserve la priorité utilisateur, les tags régionaux, la langue navigateur/appareil et le RTL. La langue d'interface reste distincte de la langue d'explication et de la langue étudiée.

## 5. État de livraison

| Gate | État | Preuve / limite exacte |
| --- | --- | --- |
| `USER_VERSION_DEPLOYED` | **PASS** | Image `second-brain-user-web:ead28ac-user-final`, conteneur healthy, révision et ID d'image vérifiés. |
| `LANDING_ROOT` | **PASS** | `/` affiche visuellement la Landing déployée; CTA inscription et mode connexion vérifiés. |
| `REVISER_SHELL` | **NOT_VERIFIED** | Correctif `9b1823c` présent, exporté et testé au niveau source/build. La capture de l'écran authentifié déployé reste à faire avec le compte humain; l'accès anonyme est correctement refusé. |
| `I18N_COVERAGE` | **PASS** | Mesure de couverture vérifiée : 13/27 complètes. L'objectif 27/27 n'est pas atteint et le gate strict reste `NO`. |
| `HUMAN_AUTH_EMAIL_MFA` | **NOT_VERIFIED** | SMTP réel non configuré; aucune réception OTP, réinscription humaine ou saisie TOTP n'a été simulée/forcée. |
| `PRIVATE_BETA_CONTROLS` | **PASS** | Gate technique HTTP, expiration, révocation et cap restrictif déjà validés. Le compte humain demandé n'est pas encore enrôlé. |
| `SHAREABLE_HTTPS` | **BLOCKED** | ngrok n'a ni token privé ni configuration active; aucune URL publique n'est inventée. Admin reste privé. |
| `REAL_OPENAI_PROFESSOR` | **NOT_VERIFIED** | Runtime volontairement sur Echo/Fake; aucun appel OpenAI, coût ou réponse réelle n'est revendiqué. |

Un HTTP 200 n'est pas utilisé comme preuve d'inscription, de réception email, de MFA ou de réponse Professeur réelle.

## 6. Validations techniques conservées

- Mobile : **54/54 PASS** ;
- MFA + contrat de build ciblés : **6/6 PASS** ;
- contrat de permissions de l'image : **3/3 PASS** ;
- Shared : **58/58 PASS** ;
- typecheck Mobile : **PASS** ;
- build Shared : **PASS** ;
- export Web : **PASS**, 953 modules et 17 assets ;
- build Docker distant : **PASS** ;
- `nginx -t` dans l'image : **PASS** ;
- santé API : PostgreSQL, Redis et Qdrant **up** ;
- `/api/admin` depuis User : **404** ;
- `git diff --check` et scan anti-secrets du delta livré : **PASS**.

L'API n'a pas changé dans cette consolidation User. Sa baseline précédente de 121/121 tests est conservée; elle n'est pas présentée comme une nouvelle exécution. Aucune migration n'a été lancée.

## 7. Procédure privée SMTP → OTP → MFA

Ne jamais transmettre les paramètres SMTP dans le chat, un ticket, un commit ou un journal. Lorsque le propriétaire annonce **« SMTP prêt »** :

1. Ouvrir une session SSH privée vers le VPS.
2. Créer une sauvegarde propriétaire-only, sans en afficher le contenu, puis éditer avec `sudoedit` :

   ```bash
   (
   set -euo pipefail
   p1=/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4
   stamp="$(date -u +%Y%m%dT%H%M%SZ)"
   sudo -n install -d -m 0700 "$p1/evidence/smtp-$stamp"
   sudo -n cp --preserve=mode,ownership,timestamps "$p1/p1.env" "$p1/evidence/smtp-$stamp/p1.env.before"
   sudo -n chmod 0600 "$p1/evidence/smtp-$stamp/p1.env.before"
   echo "Sauvegarde privee creee : $p1/evidence/smtp-$stamp/p1.env.before"
   sudoedit /home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/p1.env
   )
   ```

3. Saisir hors chat `MAIL_TRANSPORT=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` et `APP_URL`. `APP_URL` doit pointer vers l'URL User réellement utilisable par le destinataire, jamais vers Admin.
4. Revalider les permissions du fichier (`0600`) sans imprimer son contenu.
5. Identifier l'unique conteneur API P1 par ses labels Compose. Un simple `docker restart` ne recharge pas `p1.env` : il faut recréer **seulement** le service API avec la même image, sans build. Vérifier d'abord dans la configuration Compose effective que son entrypoint/command ne lance aucune migration; sinon arrêter et demander l'autorisation migration. Après recréation, vérifier le signal expurgé `SMTP ready`. Ne jamais afficher la configuration ou une erreur SMTP brute susceptible de contenir des données sensibles. En cas d'échec, restaurer `p1.env.before`, remettre le mode `0600`, recréer la même API et confirmer la santé avant toute tentative email.

   ```bash
   (
   set -euo pipefail
   p1=/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4
   project="$(basename "$p1")"
   mapfile -t api_ids < <(sudo -n docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=api")
   test "${#api_ids[@]}" -eq 1
   api_id="${api_ids[0]}"
   api_image_id="$(sudo -n docker inspect "$api_id" --format '{{.Image}}')"
   sudo -n docker inspect "$api_id" --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}'
   sudo -n docker compose --env-file "$p1/p1.env" -p "$project" -f "$p1/compose.p1.yml" config --format json | jq -e '{entrypoint:.services.api.entrypoint,command:.services.api.command}'
   # Examiner uniquement les entrypoint/command ci-dessus : aucune migration ne doit être appelée.
   sudo -n docker compose --env-file "$p1/p1.env" -p "$project" -f "$p1/compose.p1.yml" up -d --no-deps --no-build --force-recreate api
   mapfile -t new_api_ids < <(sudo -n docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=api")
   test "${#new_api_ids[@]}" -eq 1
   test "$(sudo -n docker inspect "${new_api_ids[0]}" --format '{{.Image}}')" = "$api_image_id"
   api_ready=false
   for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3106/api/health | jq -e '.status=="ok" and .info.postgres.status=="up" and .info.redis.status=="up" and .info.qdrant.status=="up"' && { api_ready=true; break; }; sleep 1; done
   test "$api_ready" = true
   )
   ```

   Restauration ciblée si la configuration SMTP ne démarre pas correctement. Remplacer le marqueur par le timestamp exact créé à l'étape 2; ne jamais sélectionner automatiquement « le dernier » fichier :

   ```bash
   (
   set -euo pipefail
   p1=/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4
   project="$(basename "$p1")"
   backup="$p1/evidence/smtp-<TIMESTAMP_CONFIRME>/p1.env.before"
   sudo -n test -f "$backup"
   mapfile -t api_ids < <(sudo -n docker ps -aq --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=api")
   test "${#api_ids[@]}" -eq 1
   api_image_id="$(sudo -n docker inspect "${api_ids[0]}" --format '{{.Image}}')"
   sudo -n cp --preserve=mode,ownership,timestamps "$backup" "$p1/p1.env"
   sudo -n chmod 0600 "$p1/p1.env"
   sudo -n docker compose --env-file "$p1/p1.env" -p "$project" -f "$p1/compose.p1.yml" up -d --no-deps --no-build --force-recreate api
   mapfile -t restored_api_ids < <(sudo -n docker ps -q --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=api")
   test "${#restored_api_ids[@]}" -eq 1
   test "$(sudo -n docker inspect "${restored_api_ids[0]}" --format '{{.Image}}')" = "$api_image_id"
   api_ready=false
   for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3106/api/health | jq -e '.status=="ok" and .info.postgres.status=="up" and .info.redis.status=="up" and .info.qdrant.status=="up"' && { api_ready=true; break; }; sleep 1; done
   test "$api_ready" = true
   )
   ```

6. Envoyer d'abord **un** email de test vers une adresse explicitement désignée. Aucun endpoint `test-mail` n'existe : employer le premier déclencheur applicatif convenu (par exemple l'inscription jetable autorisée), sans inventer une route ni lire son OTP dans les logs. Si l'inscription jetable sert de déclencheur, son adresse exacte doit elle aussi être ajoutée hors chat à `PRIVATE_BETA_REGISTRATION_EMAILS` avant la recréation API. Cet email compte déjà dans le plafond global de dix.
7. Après confirmation humaine de réception, exécuter dans le navigateur, sans dépasser **dix emails réels au total, email initial inclus** :
   - inscription réelle et réception du code ;
   - saisie du code par le propriétaire ;
   - renvoi du code ;
   - demande de récupération du mot de passe et réception du code.

Aucun OTP ne doit être lu dans les logs et aucune vérification email ne doit être forcée en base.

### Compte personnel Admin

1. Ajouter d'abord l'adresse exacte, hors chat, à `PRIVATE_BETA_REGISTRATION_EMAILS`, puis recréer de façon ciblée le seul service API avec la procédure contrôlée ci-dessus. Sans cette allowlist, l'inscription privée est refusée avant création.
2. Créer le compte par l'UI User, vérifier l'email avec le code reçu.
3. Accorder l'accès bêta par le workflow Admin audité existant. Sa durée n'est pas inventée ici : **BUSINESS_DECISION_REQUIRED** avant le grant personnel.
4. Ouvrir `/two-factor`, lancer explicitement l'enrôlement, saisir le TOTP dans le navigateur et conserver les codes de récupération hors application.
5. Faire attribuer `SUPER_ADMIN` uniquement par un opérateur déjà autorisé, via le workflow audité et step-up existant. Ne pas modifier le rôle en SQL, au boot ou par un contournement d'OTP/MFA.
6. Se reconnecter et vérifier MFA, RBAC et step-up avant toute action administrative.

L'écran Web minimal d'enrôlement MFA est livré. Côté navigateur, le secret d'enrôlement et les codes de récupération en clair restent uniquement en mémoire React; le backend conserve le secret TOTP chiffré et les hashes des codes selon son contrat existant. Les réponses API User sont `no-store`. Deux limites restent à traiter comme risques connus : le backend existant ne prouve pas un step-up spécifique sur `setup/enable`, et une réponse réseau perdue juste après activation pourrait rendre les codes de récupération non récupérables. Le parcours humain reste donc `NOT_VERIFIED` avant la saisie réelle du TOTP.

## 8. Compte apprenant, fenêtre 24 h et trois opérations

Le compte apprenant personnel doit être préservé. Après vérification de son email :

- créer un accès bêta expirant exactement à `T0 + 24 h` ;
- créer un cap staging `AI_TEXT` de **3** avec la même expiration ;
- vérifier au préalable l'usage actuel : le cap est un plafond total restrictif, pas trois crédits ajoutés ;
- ne créer aucun fallback ;
- calculer le restant réel `max(0, 3 - (primaryUsed + fallbackUsed))` ; trois succès ne sont attendus que si l'usage initial vaut zéro ;
- prouver le blocage dès la quatrième opération totale du cycle ;
- vérifier dans l'Admin l'attribution au bon utilisateur, la fonctionnalité, la réservation et la finalisation/libération.

Une opération `AI_TEXT` est une réservation backend d'une unité pour un appel de texte IA. Un succès est finalisé une seule fois. Un échec fournisseur libère la réservation; une répétition avec la même clé d'idempotence ne doit pas débiter deux fois. Une tentative refusée avant réservation n'est pas une opération consommée.

Le grant bêta et le cap expirent ensemble. À l'expiration, le gate bêta bloque l'accès normal; le compte ne retrouve donc pas automatiquement une allowance plus généreuse. Toute nouvelle fenêtre exige un nouvel acte Admin audité.

**Quota restant pour la démonstration humaine : NOT_VERIFIED / non provisionné.** Il ne faut pas annoncer « 3 restantes » avant d'avoir identifié le compte, lu son usage réel et créé le cap audité.

## 9. Suppression et réinscription jetable

Le résultat suppression puis réinscription avec la même adresse est encore **NOT_VERIFIED** : SMTP réel n'est pas prêt et aucun compte jetable exact n'a été confirmé dans ce parcours. Cette vérification devra viser uniquement l'adresse jetable autorisée, après double contrôle de l'identité du compte. Aucun compte personnel Admin ou apprenant ne doit être supprimé.

## 10. Fournisseurs et démonstration

- LLM actif : **Echo** ;
- embeddings : **Fake** dans la baseline validée ;
- mail actif : **log** tant que le signal `SMTP prêt` et la saisie privée ne sont pas réalisés ;
- notifications : **log** ;
- modèle Echo : **echo-p1** ;
- OpenAI réel : **désactivé / non vérifié** ;
- HTTPS partageable : **non ouvert**.

Le scénario `apprendre → professeur → exercice/correction → consommation Admin`, ainsi que Langues, Réviser et reprise de session, doit être exécuté avec le compte humain avant d'être annoncé aux investisseurs comme parcours réel de bout en bout. Avec Echo, l'interface est démontrable mais aucune intelligence OpenAI réelle, aucun token réel et aucun coût fournisseur ne doivent être revendiqués.

Après le signal distinct confirmant crédits, clé, modèle et tarification OpenAI, un test borné pourra être proposé avec plafond et coût estimé. Aucun appel supplémentaire ni activation persistante ne doit précéder l'accord explicite.

## 11. HTTPS partageable

Le tunnel SSH suffit pour une répétition depuis le PC propriétaire. Pour des appareils invités, ngrok reste séparé et bloqué jusqu'à ce que :

- son token soit saisi hors chat ;
- les comptes testeurs soient explicitement autorisés ;
- SMTP/OTP/MFA requis soient validés ;
- la bêta privée et les quotas soient en place ;
- seul User soit exposé ;
- Admin et `/api/admin` restent privés.

Ne publier aucune URL avant ces contrôles. Une adresse `127.0.0.1` n'est jamais qualifiée de lien partageable.

Contrôle réseau distant du 26 septembre 2026 : aucun listener public `80` ou `443`; seul SSH `22` est public. User `8082`, Admin `8083` et API `3106` écoutent exclusivement sur `127.0.0.1`.

## 12. Redémarrage ciblé et retour arrière

### Redémarrer seulement User

À exécuter sur le VPS :

```bash
sudo -n docker inspect sb-user-web-8082 --format '{{.Config.Image}} {{.State.Health.Status}}'
sudo -n docker restart sb-user-web-8082
for i in $(seq 1 30); do health="$(sudo -n docker inspect sb-user-web-8082 --format '{{.State.Health.Status}}')"; test "$health" = healthy && break; sleep 1; done
test "$health" = healthy
sudo -n docker inspect sb-user-web-8082 --format '{{.Config.Image}} {{.State.Health.Status}}'
curl -fsS http://127.0.0.1:8082/ >/dev/null
curl -fsS http://127.0.0.1:8082/api/health | jq -e '.status=="ok" and .info.postgres.status=="up" and .info.redis.status=="up" and .info.qdrant.status=="up"'
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/api/admin)" = 404
```

### Rollback User préparé

Ancienne image conservée :

- tag `second-brain-user-web:rollback-20260926T145744Z` ;
- ID `sha256:e9f89272d015b81e89cbcc196f28caefa7cd1ca76493c8b309adbbeec7ad67a2` ;
- conteneur arrêté `sb-user-web-8082-rollback-final-r2-20260926T145744Z`.

Avant toute bascule, revalider les noms **et les IDs d'image**. Le bloc suivant restaure automatiquement le conteneur forward si la remise en ligne de l'ancien échoue :

```bash
(
set -euo pipefail
active=sb-user-web-8082
rollback=sb-user-web-8082-rollback-final-r2-20260926T145744Z
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
forward="sb-user-web-8082-forward-$stamp"

test "$(sudo -n docker inspect "$active" --format '{{.Image}}')" = 'sha256:332491924f2f8a722f01e8571201d58f5c15c814041bf97c388ea76d7347eb8b'
test "$(sudo -n docker inspect "$rollback" --format '{{.Image}}')" = 'sha256:e9f89272d015b81e89cbcc196f28caefa7cd1ca76493c8b309adbbeec7ad67a2'
if sudo -n docker inspect "$forward" >/dev/null 2>&1; then echo "Nom forward deja utilise: $forward" >&2; exit 1; fi

phase=initial
restore_forward() {
  code=$?
  trap - ERR
  set +e
  case "$phase" in
    stopped)
      sudo -n docker start "$active"
      ;;
    forwarded)
      sudo -n docker rename "$forward" "$active"
      sudo -n docker start "$active"
      ;;
    rollback_named|rollback_started)
      sudo -n docker stop "$active" >/dev/null 2>&1
      sudo -n docker rename "$active" "$rollback" >/dev/null 2>&1
      sudo -n docker rename "$forward" "$active"
      sudo -n docker start "$active"
      ;;
  esac
  echo "Rollback incomplet; tentative de restauration de la version forward effectuee." >&2
  exit "$code"
}
trap restore_forward ERR

sudo -n docker stop "$active"
phase=stopped
sudo -n docker rename "$active" "$forward"
phase=forwarded
sudo -n docker rename "$rollback" "$active"
phase=rollback_named
sudo -n docker start "$active"
phase=rollback_started
for i in $(seq 1 30); do health="$(sudo -n docker inspect "$active" --format '{{.State.Health.Status}}')"; test "$health" = healthy && break; sleep 1; done
test "$health" = healthy
sudo -n docker inspect "$active" --format '{{.Config.Image}} {{.Image}} {{.State.Health.Status}}'
curl -fsS http://127.0.0.1:8082/ >/dev/null
curl -fsS http://127.0.0.1:8082/api/health | jq -e '.status=="ok" and .info.postgres.status=="up" and .info.redis.status=="up" and .info.qdrant.status=="up"'
test "$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8082/api/admin)" = 404
trap - ERR
)
```

Ce rollback ne touche ni PostgreSQL, ni Redis, ni Qdrant, ni les volumes et ne lance aucune migration. Les conteneurs échoués conservés pour preuve ne sont pas à supprimer sans une demande distincte.

## 13. Interventions restantes, dans l'ordre

1. Le propriétaire saisit les paramètres SMTP hors chat et dit **« SMTP prêt »**.
2. Test email, puis inscription, renvoi et récupération avec saisie humaine des codes.
3. Création du compte Admin personnel, MFA humain, puis rôle `SUPER_ADMIN` par le workflow audité.
4. Vérification du compte apprenant, grant bêta 24 h et cap total de 3 `AI_TEXT`, puis preuve du quatrième blocage.
5. Test suppression/réinscription du seul compte jetable désigné.
6. Capture de Réviser depuis le staging authentifié et répétition des parcours de démonstration.
7. Saisie privée du token ngrok et ouverture User HTTPS seulement, si les prérequis ci-dessus sont verts.
8. Signal OpenAI séparé, budget/plafond approuvé, test borné, puis éventuelle activation persistante explicitement autorisée.

Jusqu'à ces signaux, conserver l'image `ead28ac-user-final` stable et ne lancer ni refonte, ni Sprint 6.
