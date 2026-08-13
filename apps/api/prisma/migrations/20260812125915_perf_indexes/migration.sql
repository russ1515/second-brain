-- CreateIndex
CREATE INDEX "exercise_attempts_userId_createdAt_idx" ON "exercise_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "review_logs_userId_idx" ON "review_logs"("userId");

-- CreateIndex
CREATE INDEX "study_sessions_userId_status_completedAt_idx" ON "study_sessions"("userId", "status", "completedAt");
