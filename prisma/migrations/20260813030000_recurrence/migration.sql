-- Repeating tasks.
--
-- `recurrence` holds a rule serialised by lib/recurrence.ts ("weekly:1:0,3").
-- Completing a repeating task writes a done copy into the Logbook and advances
-- the live row, so `recurrenceParentId` links a copy back to the task it came
-- from. Both are plain nullable columns, which SQLite can add in place — no
-- table rebuild, so existing rows are untouched.

ALTER TABLE "Task" ADD COLUMN "recurrence" TEXT;
ALTER TABLE "Task" ADD COLUMN "recurrenceParentId" TEXT;

-- Undo after completing a repeat has to find the copy it just made.
CREATE INDEX "Task_recurrenceParentId_idx" ON "Task"("recurrenceParentId");
