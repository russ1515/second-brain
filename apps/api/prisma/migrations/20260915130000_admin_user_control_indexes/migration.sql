-- Sprint 3: server-side User Administration Control Center.
-- Additive only: support-note persistence and indexes for bounded admin lists.

CREATE TABLE "admin_support_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_support_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_support_notes_userId_createdAt_idx"
    ON "admin_support_notes"("userId", "createdAt");

ALTER TABLE "admin_support_notes"
    ADD CONSTRAINT "admin_support_notes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_support_notes"
    ADD CONSTRAINT "admin_support_notes_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_accountStatus_createdAt_idx"
    ON "users"("accountStatus", "createdAt");

CREATE INDEX "sessions_userId_revokedAt_createdAt_idx"
    ON "sessions"("userId", "revokedAt", "createdAt");

CREATE INDEX "subscriptions_status_planId_idx"
    ON "subscriptions"("status", "planId");

CREATE INDEX "audit_logs_targetId_createdAt_idx"
    ON "audit_logs"("targetId", "createdAt");

CREATE INDEX "quota_accounts_cycleId_state_idx"
    ON "quota_accounts"("cycleId", "state");

-- One unresolved deletion workflow per learner.  The service additionally
-- serializes/retries the read-create path so concurrent admin clicks are
-- idempotent rather than producing duplicate requests.
CREATE UNIQUE INDEX "account_deletion_requests_one_open_user_idx"
    ON "account_deletion_requests"("userId")
    WHERE "status" IN ('requested', 'approved');
