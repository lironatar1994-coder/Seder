-- Per-task reminders, and the hour they fire when a task has no time.
--
-- Both additive, both in place. `Task.reminder` is nullable and null already
-- means "follow the account default", so every existing task is correct with
-- no backfill: they keep behaving exactly as they did yesterday, and they keep
-- following the setting if it is later changed.
--
-- `User.reminderHour` defaults to 8, which is the behaviour that was hardcoded
-- until now — so this migration changes nothing for anyone until they touch a
-- control.

-- 0–23, Israel time. The moment an untimed task's reminder is anchored to.
ALTER TABLE "User" ADD COLUMN "reminderHour" INTEGER NOT NULL DEFAULT 8;

-- null = account default · 'off' = none · otherwise minutes before the anchor.
ALTER TABLE "Task" ADD COLUMN "reminder" TEXT;
