# Admin architecture — Sprint 1

Status legend: **IMPLEMENTED** exists in code; **PLANNED** is deliberately deferred; **BUSINESS_DECISION_REQUIRED** needs product approval.

## Boundary

`apps/admin` is a standalone Expo Web client. It has no privileged backend logic. It uses `POST /api/auth/login`, `POST /api/auth/2fa/verify`, and `GET /api/admin/session`. The API resolves persistent role assignments on every admin request, so revocation and role changes take effect without minting a new token.

## Access chain

1. `JwtAccessGuard` validates signature, purpose, database session, expiry and account state.
2. `AdminGuard` requires an MFA-authenticated session and resolves a persistent admin identity.
3. `CapabilityGuard` checks endpoint metadata against the role/capability map.
4. `AdminStepUpGuard` requires a recent MFA timestamp on critical mutations.
5. The service performs the mutation, revokes sessions where required, and writes audit/security events.

This chain is **IMPLEMENTED**. End-user role management screens are **PLANNED**.

## Web shell

The protected routes are `/dashboard`, `/users`, `/plans`, `/usage`, `/costs`, `/bugs`, `/support`, `/infrastructure`, `/payments`, `/emails`, `/documents`, `/security`, `/analytics`, and `/settings`. The shell supports desktop collapse, a drawer under 1024px, compact tablet/mobile layouts, light/dark presentation, FR/EN labels, environment visibility and accessible controls.

Detailed domain dashboards are **PLANNED** for later sprints; empty states intentionally contain no fabricated metrics.
