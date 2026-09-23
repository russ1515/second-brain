-- UX implementation Lot 10: additive Academic Workspace persistence.

CREATE TABLE "academic_workspaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "mode" TEXT NOT NULL DEFAULT 'guide',
    "plan" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "draftFormat" TEXT NOT NULL DEFAULT 'markdown',
    "draftContent" TEXT NOT NULL,
    "assistantHistory" JSONB NOT NULL,
    "progress" JSONB NOT NULL,
    "autosaveRevision" INTEGER NOT NULL DEFAULT 0,
    "experienceSessionId" TEXT,
    "resumeTarget" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "academic_workspaces_userId_status_updatedAt_idx" ON "academic_workspaces"("userId", "status", "updatedAt");
CREATE INDEX "academic_workspaces_userId_updatedAt_idx" ON "academic_workspaces"("userId", "updatedAt");
CREATE INDEX "academic_workspaces_experienceSessionId_idx" ON "academic_workspaces"("experienceSessionId");

ALTER TABLE "academic_workspaces" ADD CONSTRAINT "academic_workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
