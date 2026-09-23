# Quota, usage and billing — Sprint 1

## Quota lifecycle

Commercial resources are `AI_TEXT`, `VOICE_SECONDS`, `DOCUMENT_PAGES`, `OCR_PAGES`, `EMBEDDING_UNITS`, `WEB_SEARCH`, `DEEP_RESEARCH`, and `ACADEMIC_AI`.

Each billing window has a `QuotaCycle` and one `QuotaAccount` per used resource. State advances through `PRIMARY`, `FALLBACK`, and `BLOCKED`. Free has no fallback. Paid fallback is a separate persisted allowance calculated with the persisted plan ratio (v1: `0.50`). Usage never carries into a new cycle.

`QuotaService.reserve` uses a serializable transaction and conditional atomic updates. The provider runs only after reservation. Finalization releases any unused portion; failure releases the exact reservation. Reservation and ledger keys prevent duplicate debit/release. The durable ledger retains reset history. Warning thresholds are 50, 70, 85, 95 and 100 percent; delivery notifications are **PLANNED**.

Provider calls through LLM, vision/OCR, embeddings and speech adapters use `ProviderMeteringService`. It records provider/model, feature/resource, request and operation IDs, latency, status and available usage units. Provider price rows are structurally supported but intentionally empty until verified supplier prices are configured.

WAV input duration is measured server-side. Compressed audio and synthesized output currently record measurement as unavailable and reserve a one-second minimum; trusted decoding/output-duration extraction is **PLANNED**.

## Billing events

Provider webhooks require signature verification. Stripe signatures enforce a five-minute freshness window and support key rotation signatures. The registry records receive/process/failure status, attempts and a payload hash. Subscription, payment, invoice and processed status mutations occur in one serializable transaction. Duplicate processed events are no-ops; failed events remain retryable and visible.

Reconciliation can be added through the provider interface, but no endpoint can manually set `paid=true`. Full provider-side reconciliation is **PLANNED** because it requires provider credentials and authoritative lookup contracts.
