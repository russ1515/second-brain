# Security model — Sprint 1

## Account and session enforcement

Access JWTs carry a database session identifier. Every authenticated request reloads the user and session; revoked, expired, suspended, banned and deletion-pending identities are denied. Login, refresh, 2FA completion and existing access tokens all use the same persisted account state. Reactivation never restores revoked sessions.

Suspension and ban are distinct persisted states. Ban retains reason, actor, timestamp, optional internal note and external reference. Admin deletion creates an `AccountDeletionRequest`; it does not directly erase the user. Actual erasure remains owned by the Privacy service and requires its external-vector cleanup guarantees.

## Admin identity

Roles: `SUPER_ADMIN`, `TECH_OPS`, `SUPPORT`, `FINANCE`, `SECURITY`, `ANALYTICS`. Capabilities are explicit in `admin-rbac.ts`. TOTP is mandatory for the admin surface. Critical account, subscription, quota, payment, security and role operations require recent step-up authentication.

`ADMIN_EMAILS` and legacy `isAdmin` are compatibility inputs only. They can persist one initial role once; normal authorization reads `AdminRoleAssignment`.

## Audit and privacy

Audit V2 stores actor, role, action, target, before/after snapshots, reason, result, request/session identifiers, IP, user agent, safe metadata and time. `SecurityEvent` is a separate stream. A recursive redactor strips fields matching password, token, secret, TOTP, recovery code, cookie, authorization and API-key patterns.

Admin views classify learner data as `STANDARD`, `RESTRICTED`, or `HIGHLY_RESTRICTED`. Fine-grained field masking and access-review tooling are **PLANNED**.

## HTTP hardening

Helmet, validation, throttling and request IDs remain enabled. Browser CORS uses `CORS_ALLOWED_ORIGINS`; native Expo requests without an Origin remain valid. Localhost is accepted only outside production.
