# SECOND BRAIN ADMIN — SPRINT 7 REPORT

**Scope:** Commercial Control, versioned pricing, quotas and entitlement
observability, protected Admin controls, and the read-only **Admin Copilot**.

**Staging deployment validated:** `b3c8d807682a7f556d45c629a94a0048f46dbc89`.
The subsequent source-only test correction is recorded separately; it changes
no runtime application logic or staging image.

## Safety boundary

- The work was performed only on the isolated OVH P1 staging stack.
- PostgreSQL is not publicly exposed. All browser gates used technical
  `@example.test` fixtures over VPS loopback.
- No production deployment, external payment operation, provider call, or
  OpenAI activation was performed.
- Existing Linux/P1 evidence, containers, volumes and backups were preserved.
- Non-empty PostgreSQL sample password and connection-URL components found in
  `.env.example` were replaced with explicit local-only placeholders; runtime
  staging secrets were not read, changed or logged.
- Prisma reports the database schema up to date. The staging database has
  **60 applied migrations**: the historical 59 plus the additive Sprint 7
  versioned-pricing migration. Historical reports that state 59 were not
  rewritten.

## Commercial Control result

The active, versioned public catalog is:

| Plan | Monthly | Yearly | Result |
|---|---:|---:|---|
| FREE | $0.00 | $0.00 | active |
| PRO | $4.99 | $49.00 | active |
| PRO MAX | $15.00 | $150.00 | active |

The Sprint 7 migration is additive and auditable. It preserves existing
entitlements, quota/fallback semantics, subscription/payment records, billing
periods and usage history. Application boot remains create-only for missing
catalog rows; it does not overwrite existing commercial configuration.

The Commercial Control API is capability-gated, returns `Cache-Control:
no-store`, and requires the existing MFA step-up mechanism before a pricing
mutation. The browser gate deliberately opens but never submits the pricing
dialog. No pricing write was made by the validation.

On final staging, the Commercial HTTP gate passed **52 checks**. The browser
gate passed **10 checks**, including SUPER_ADMIN catalog rendering, FINANCE
catalog reading, sentinel state rendering (`PRIMARY`, `FALLBACK`, `BLOCKED`),
and the two TECH_OPS controls:

- the client does not request the commercial catalog for TECH_OPS;
- the API separately returns the required `403` for that catalog.

## Admin Copilot result

### Implemented V1 boundary

`Admin Copilot` is an internal, bounded read surface with these properties:

- `READ → ANALYZE → EXPLAIN → RECOMMEND` only;
- no Copilot action, deployment, shell, code-write, arbitrary SQL, Prisma
  mutation, schema operation or migration endpoint exists;
- all selected sources are independently limited by the current Admin's
  existing capabilities; Copilot permissions never exceed the current role;
- database access uses fixed Prisma reads and bounded aggregations rather than
  user-provided SQL;
- repository lookup is constrained to read-only mounted source roots, ignores
  symlinks and excluded directories, and is bounded by file/result sizes;
- prompts containing apparent sensitive material are redacted/refused;
  audit metadata records only safe category, tool and length data, never the
  prompt or answer;
- conversations retain only short-lived category context and cannot create a
  future authorization;
- action-shaped requests return `PROPOSAL_ONLY` with
  `HUMAN_CONFIRMATION_REQUIRED`; they do not call any official mutation API.

The interface includes an accessible chat view, source/status cards,
configuration trace labels, English/French UI copy, responsive layout and
explicit `READ ONLY` presentation.

### Sources exercised on staging

The live HTTP and browser gates verified controlled reads from System Health,
the repository source mount, Cost Center status contracts, Admin capability
resolution, Audit Log metadata and the protected Admin session. The live
browser E2E proved that a SUPER_ADMIN receives real-source answers while a
FINANCE Admin receives `ACCESS_DENIED` for infrastructure evidence.

The current staging configuration remains intentionally non-billable:
`LLM_PROVIDER=echo`, `EMBEDDINGS_PROVIDER=fake`, and no Admin Copilot model is
configured. The Copilot therefore returns truthful trace sentinels
(`NOT_CONFIGURED` / `NOT_INSTRUMENTED`) and does not represent an echo response
as a provider answer.

## Evidence retained on OVH

All paths below are on the P1 evidence volume; their JSON contents contain
only check names and redacted/safe metadata.

| Gate | Result | Evidence |
|---|---|---|
| Commercial HTTP | PASS, 52 checks | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/sprint7-commercial-http-sprint7-commercial-http-final-20261005T073056Z.json` |
| Commercial browser | PASS, 10 checks | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/sprint7-commercial-browser-sprint7-commercial-browser-final-20261005T073222Z.json` |
| Copilot HTTP | PASS, 21 checks | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/sprint7-admin-copilot-http-sprint7-copilot-http-final-20261005T073128Z.json` |
| Copilot real-source browser E2E | PASS, 5 checks | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/sprint7-admin-copilot-e2e-sprint7-copilot-e2e-final-20261005T073255Z.json` |
| Copilot UI/i18n/responsive mock contract | PASS, 3 checks; explicitly synthetic replies | `/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4/evidence/sprint7-admin-copilot-browser-sprint7-copilot-browser-20261005T072916Z.json` |
| API Linux image | PASS | `/home/ubuntu/second-brain-evidence/sprint7-api-build-b3c8d807682a7f556d45c629a94a0048f46dbc89.log` |
| Admin Linux web export | PASS | `/home/ubuntu/second-brain-evidence/sprint7-admin-build-b3c8d807682a7f556d45c629a94a0048f46dbc89.log` |

The runner, PostgreSQL, Redis, Qdrant, API and Admin containers were healthy
at validation time. The public User beta endpoint returned HTTP `200`, its
health endpoint returned HTTP `200`, and `/api/admin` returned HTTP `404` from
the public User entry point. Admin remains private.

Earlier failed evidence was retained as diagnostic history and is not counted
as a pass. It identified two test-only issues: a compact-shell navigation
assumption in the Copilot UI mock and a legacy pricing assertion. Neither was
a runtime pricing, RBAC or Copilot data-access defect.

## Regression result

- API typecheck: PASS.
- Admin typecheck: PASS.
- API unit regressions: **206/206 PASS** (five deterministic groups).
- Shared regressions: **75/75 PASS**.
- Sprint 7 commercial/Copilot static tests: **7/7 PASS**.
- Linux API image build: PASS.
- Linux Admin web export: PASS.
- `git diff --check`: PASS at validation checkpoints.
- Delta secret scan: no real `.env`, private key, usable credential, provider
  key, token or connection URL was introduced.

## Business decisions required

- Any paid provider/model selection, provider tariff source, maximum spend,
  and the authorization for a bounded real Copilot provider call.
- Repricing an already-paid external subscription, refunds, cancellation
  behavior and upgrade/downgrade proration.
- Any new numeric quota/resource policy beyond the existing authoritative
  Quota Engine configuration.

## Not verified / not configured

- A real Admin Copilot provider call with provider, model, tokens, cost,
  correlation and Cost Center evidence. No such call was authorized or made.
- Actual payment-provider/webhook processing; no PSP is configured for this
  staging validation.
- A provider-backed embedding/Qdrant operation for the Copilot; the staging
  embedding provider intentionally remains fake.

## Required status lines

```text
SPRINT 7: FAIL
PLANS & PRICING: PASS
ACTIVE PRICING: FREE $0 | PRO $4.99/mo $49/yr | PRO MAX $15/mo $150/yr — PASS
QUOTA POLICY: PASS
PRIMARY/FALLBACK/BLOCKED: PASS
SUBSCRIPTIONS: PASS
PAYMENTS/BILLING: NOT_CONFIGURED
USAGE: PASS
FEATURE CONTROL: PASS
SETTINGS SAFETY: PASS
AUDIT LOG: PASS
RBAC/STEP-UP: PASS
USER ↔ ADMIN CONSISTENCY: PASS
API TESTS: 206/206 PASS
ADMIN TESTS: Commercial browser 10/10 PASS; Copilot real-source E2E 5/5 PASS; UI contract 3/3 PASS
SHA: deployed API/Admin b3c8d807682a7f556d45c629a94a0048f46dbc89
API IMAGE: second-brain-p1-api:sprint7-b3c8d807682a7f556d45c629a94a0048f46dbc89
ADMIN IMAGE: second-brain-p1-admin:sprint7-b3c8d807682a7f556d45c629a94a0048f46dbc89
PUBLIC USER BETA: PASS
ROLLBACK: PASS
ADMIN FUNCTIONAL READINESS: PASS
ADMIN COPILOT UI: PASS
ADMIN COPILOT DATA ACCESS: PASS
ADMIN COPILOT CODE READ: PASS
ADMIN COPILOT RBAC: PASS
ADMIN COPILOT REDACTION: PASS
ADMIN COPILOT COST TRACE: FAIL
ADMIN COPILOT MUTATION SAFETY: PASS
BUSINESS_DECISIONS_REQUIRED: paid provider/model/budget; provider tariffs; paid-plan repricing/refunds/proration; new numeric quota policy
NOT_VERIFIED: real Copilot provider/model/token/cost/correlation/Cost Center trace; real payment provider/webhook; provider-backed embeddings/Qdrant
```

`SPRINT 7: FAIL` is deliberate: a Cost Center trace for a **real** Copilot
provider call cannot be inferred from deterministic read-only tests, and no
billable call is permitted without a separate authorization. Sprint 8 has not
been started.
