-- CreateTable
CREATE TABLE "GoogleOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "accessExpiresAt" DATETIME NOT NULL,
    "taskCalendarId" TEXT,
    "taskSyncToken" TEXT,
    "showEvents" BOOLEAN NOT NULL DEFAULT true,
    "syncTasks" BOOLEAN NOT NULL DEFAULT true,
    "syncAllDay" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "leaseUntil" DATETIME,
    "leaseOwner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleCalendarSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GoogleCalendarSource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleCalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "startDay" TEXT NOT NULL,
    "endDay" TEXT NOT NULL,
    "allDay" BOOLEAN NOT NULL,
    "htmlLink" TEXT,
    "location" TEXT,
    CONSTRAINT "GoogleCalendarEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GoogleCalendarSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoogleTaskLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "taskId" TEXT,
    "eventId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "taskUpdatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleTaskLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoogleTaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalendarFeed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "deadline" DATETIME,
    "completedAt" DATETIME,
    "remindedAt" DATETIME,
    "reminder" TEXT,
    "recurrence" TEXT,
    "recurrenceParentId" TEXT,
    "assigneeId" TEXT,
    "position" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "completedAt", "createdAt", "deadline", "id", "notes", "parentId", "position", "priority", "projectId", "recurrence", "recurrenceParentId", "remindedAt", "reminder", "scheduledFor", "scheduledTime", "sectionId", "status", "title", "updatedAt", "userId", "whenBucket") SELECT "assigneeId", "completedAt", "createdAt", "deadline", "id", "notes", "parentId", "position", "priority", "projectId", "recurrence", "recurrenceParentId", "remindedAt", "reminder", "scheduledFor", "scheduledTime", "sectionId", "status", "title", "updatedAt", "userId", "whenBucket" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_userId_status_scheduledFor_idx" ON "Task"("userId", "status", "scheduledFor");
CREATE INDEX "Task_userId_status_whenBucket_idx" ON "Task"("userId", "status", "whenBucket");
CREATE INDEX "Task_userId_status_deadline_idx" ON "Task"("userId", "status", "deadline");
CREATE INDEX "Task_projectId_position_idx" ON "Task"("projectId", "position");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_userId_status_projectId_idx" ON "Task"("userId", "status", "projectId");
CREATE INDEX "Task_recurrenceParentId_idx" ON "Task"("recurrenceParentId");
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");
CREATE INDEX "Task_status_scheduledFor_remindedAt_idx" ON "Task"("status", "scheduledFor", "remindedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuthState_stateHash_key" ON "GoogleOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "GoogleOAuthState_expiresAt_idx" ON "GoogleOAuthState"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarSource_connectionId_googleId_key" ON "GoogleCalendarSource"("connectionId", "googleId");

-- CreateIndex
CREATE INDEX "GoogleCalendarEvent_sourceId_startDay_endDay_idx" ON "GoogleCalendarEvent"("sourceId", "startDay", "endDay");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarEvent_sourceId_googleId_key" ON "GoogleCalendarEvent"("sourceId", "googleId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleTaskLink_connectionId_taskId_key" ON "GoogleTaskLink"("connectionId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleTaskLink_connectionId_eventId_key" ON "GoogleTaskLink"("connectionId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_userId_key" ON "CalendarFeed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeed_tokenHash_key" ON "CalendarFeed"("tokenHash");
