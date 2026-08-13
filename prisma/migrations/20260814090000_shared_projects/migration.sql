-- Shared projects.
--
-- Three additions, all of them additive: SQLite can add a nullable column and
-- create tables in place, so no table is rebuilt and no existing row moves.
--
-- Nothing is backfilled on purpose. A project's owner is still `Project.userId`
-- and always was; `ProjectMember` holds only the people let in afterwards, so
-- every existing project starts correct with zero rows — an owner-only project,
-- which is exactly what it was yesterday.

-- Who has been let into a project, not counting its owner.
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Accepting an invitation twice is a no-op rather than a duplicate row.
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- An invitation. Only the SHA-256 of the emailed/copied token is stored, the
-- same way sessions and password resets are handled.
CREATE TABLE "ProjectInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectInvite_tokenHash_key" ON "ProjectInvite"("tokenHash");
CREATE INDEX "ProjectInvite_projectId_idx" ON "ProjectInvite"("projectId");
CREATE INDEX "ProjectInvite_expiresAt_idx" ON "ProjectInvite"("expiresAt");

-- Who is doing a task, as opposed to who wrote it. Null everywhere until
-- somebody shares a project, which is why it can be added in place.
ALTER TABLE "Task" ADD COLUMN "assigneeId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "Everything on my plate across every shared project" — the query a
-- collaborator's Today runs.
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
