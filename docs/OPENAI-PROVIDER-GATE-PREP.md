# OpenAI real-provider gate preparation

This document records preparation only. At the time of writing, staging remains
`LLM_PROVIDER=echo` and `EMBEDDINGS_PROVIDER=fake`; no OpenAI credential,
pricing row, external provider request, or persistent provider switch has been
made. Therefore `REAL_PROVIDER` remains **NOT_VERIFIED**.

## Source path

The application path reserved for the later bounded validation is:

```text
authenticated learner → Tutor session message → LlmService → OpenAI Responses
→ ProviderUsageOperation / ProviderUsageAttempt → PostgreSQL → Cost Center
```

`LlmService` maps the Responses usage into independently priced input, cached
input, and output units. Responses output includes reasoning units, so reasoning
is retained only as safe observability metadata and is never double priced. If
the provider returns a positive cache-write unit count, the current catalog has
no corresponding unit/rate: the attempt is deliberately **UNKNOWN**, never zero.

The immutable ledger already attributes request correlation, user, subscription,
plan/version, feature, quota state, provider, model, latency, units, pricing
version/snapshot, and outcome. Cost Center already groups that data by user,
plan, feature, provider, model, and selected period.

## Staging-only secret boundary

The only future secret location is the out-of-Git, owner-only VPS file:

```text
$P1_DIR/private/provider-real.env
```

Its parent must be mode `0700` and the file must be `0600`. Copy
[`scripts/openai-provider-real.env.example`](../scripts/openai-provider-real.env.example)
there only after the user explicitly authorizes the single real test. The file
uses the existing `LLM_MODEL` convention and intentionally does **not** set
`LLM_PROVIDER`: the temporary Compose override selects OpenAI while the running
P1 service remains Echo. Neither this file nor an OpenAI key belongs in Expo,
Git, Docker image layers, evidence, logs, or reports.

## Future bounded execution

After the exact model and official price source have been approved and a Finance
administrator has created an active USD pricing version through the protected
MFA/step-up workflow, run on the VPS:

```bash
P1_DIR=/home/ubuntu/.config/second-brain/sb-ovh-p1-http-20260923163756-0a803ec4 \
  /home/ubuntu/second-brain-staging/scripts/run-openai-provider-gate.sh
```

The script refuses—with a sanitized `NOT_VERIFIED` evidence file—when the
private file, key, model, permissions, runtime OpenAI selection, or exact active
pricing is missing. It never creates pricing. It builds a tagged temporary API,
starts it with `docker compose run --no-deps` (no published port), forces only
that container to `openai`, retains `fake` embeddings, sets a server-only cap
of at most 128 output tokens (32 by default), and disables Tutor retries.

The client first verifies the temporary runtime selection and Finance price,
then makes one short learner Tutor message. It retains only a sanitized evidence
JSON with a hashed correlation ID, non-sensitive ledger/cost metadata, and Cost
Center delta. The temporary API container is removed; the long-running Echo API,
Admin, PostgreSQL, Redis, Qdrant, prior Linux evidence, and P1 evidence are not
recreated or cleaned.

Persistent activation is deliberately separate: it requires a later explicit
authorization to configure the P1 service with `LLM_PROVIDER=openai`, the exact
`LLM_MODEL`, and the VPS-only key, recreate only that API service, confirm
`/api/ai/orchestrator` reports OpenAI after restart, and preserve Echo as the
explicit rollback selection. No automatic fallback turns an OpenAI failure into
an Echo response.

## Remaining verification boundaries

- The real OpenAI call, real pricing snapshot, attributable ledger record, and
  Cost Center aggregation remain **NOT_VERIFIED** until the one authorized call.
- Existing Qdrant proof used fake embeddings. A real OpenAI embedding adapter
  is not added or enabled by this preparation; real embedding → Qdrant →
  retrieval therefore remains **NOT_VERIFIED**.
- The temporary P1 user API route proves the backend Tutor path. A human
  Professor browser flow must be checked separately against the user-web surface
  after authorization; it is not inferred from the API path.
