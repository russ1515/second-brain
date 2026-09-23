# Repository operating notes

- Preserve unrelated worktree changes and use additive migrations.
- Never place secrets, raw tokens, TOTP values, passwords, receipts, or payment data in logs.
- Backend RBAC, account state, entitlements, quota reservation and verified billing events are authoritative.
- Do not overwrite plan quotas or prices during application boot.
- A billable provider call must reserve first and finalize or release exactly once.
- Keep `apps/mobile` learner behavior separate from the internal `apps/admin` shell.
- Mark unresolved product rules `BUSINESS_DECISION_REQUIRED`; do not invent prices, prorata rules, or resource limits.
