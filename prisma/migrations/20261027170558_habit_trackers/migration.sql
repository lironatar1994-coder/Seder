-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'WEEK',
    "weekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "position" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tracker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackerRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackerRow_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackerCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackerCheck_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "TrackerRow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Tracker_projectId_position_idx" ON "Tracker"("projectId", "position");

-- CreateIndex
CREATE INDEX "TrackerRow_trackerId_position_idx" ON "TrackerRow"("trackerId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerCheck_rowId_day_key" ON "TrackerCheck"("rowId", "day");
