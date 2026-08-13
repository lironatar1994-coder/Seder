-- The Inbox was modelled twice, and both were wrong.
--
-- It was a `whenBucket` value, so giving an unfiled task a date moved it out of
-- the Inbox — filing and scheduling fought each other. It was also a synthetic
-- project flagged `isInbox`, which duplicated the same idea in a second place.
--
-- Both go. A task is in the Inbox when `projectId` is NULL, and `whenBucket`
-- now only ever answers "when".
--
-- Hand-written rather than generated: the data has to be carried across before
-- the column can be dropped, and `prisma migrate dev` will not do that.

-- 1. Tasks parked in a synthetic inbox project become genuinely unfiled.
UPDATE "Task"
SET "projectId" = NULL
WHERE "projectId" IN (SELECT "id" FROM "Project" WHERE "isInbox" = true);

-- 2. The retired bucket becomes ANYTIME. Unfiled ones still surface in the
--    Inbox view, which is now driven by projectId.
UPDATE "Task" SET "whenBucket" = 'ANYTIME' WHERE "whenBucket" = 'INBOX';

-- 3. Sections belonging to a synthetic inbox project cannot outlive it.
UPDATE "Task"
SET "sectionId" = NULL
WHERE "sectionId" IN (
  SELECT "s"."id" FROM "Section" "s"
  JOIN "Project" "p" ON "p"."id" = "s"."projectId"
  WHERE "p"."isInbox" = true
);
DELETE FROM "Section" WHERE "projectId" IN (SELECT "id" FROM "Project" WHERE "isInbox" = true);

-- 4. Retire the synthetic projects themselves.
DELETE FROM "Project" WHERE "isInbox" = true;

-- 5. Rebuild both tables: SQLite cannot drop a column or change a default in
--    place.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'teal',
    "position" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("id", "userId", "name", "color", "position", "archivedAt", "createdAt", "updatedAt")
SELECT "id", "userId", "name", "color", "position", "archivedAt", "createdAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_userId_position_idx" ON "Project"("userId", "position");

CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "sectionId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "whenBucket" TEXT NOT NULL DEFAULT 'ANYTIME',
    "scheduledFor" DATETIME,
    "scheduledTime" TEXT,
    "deadline" DATETIME,
    "completedAt" DATETIME,
    "position" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id", "userId", "projectId", "sectionId", "parentId", "title", "notes", "priority", "status", "whenBucket", "scheduledFor", "scheduledTime", "deadline", "completedAt", "position", "createdAt", "updatedAt")
SELECT "id", "userId", "projectId", "sectionId", "parentId", "title", "notes", "priority", "status", "whenBucket", "scheduledFor", "scheduledTime", "deadline", "completedAt", "position", "createdAt", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_userId_status_scheduledFor_idx" ON "Task"("userId", "status", "scheduledFor");
CREATE INDEX "Task_userId_status_whenBucket_idx" ON "Task"("userId", "status", "whenBucket");
CREATE INDEX "Task_userId_status_deadline_idx" ON "Task"("userId", "status", "deadline");
CREATE INDEX "Task_projectId_position_idx" ON "Task"("projectId", "position");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
-- Unfiled tasks are the Inbox, so that lookup gets its own index.
CREATE INDEX "Task_userId_status_projectId_idx" ON "Task"("userId", "status", "projectId");

PRAGMA foreign_keys=ON;
