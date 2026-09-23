-- Sprint 3: durable, auditable learner-profile review/request records.

CREATE TABLE "admin_profile_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_profile_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_profile_reviews_userId_createdAt_idx"
    ON "admin_profile_reviews"("userId", "createdAt");

ALTER TABLE "admin_profile_reviews"
    ADD CONSTRAINT "admin_profile_reviews_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_profile_reviews"
    ADD CONSTRAINT "admin_profile_reviews_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
