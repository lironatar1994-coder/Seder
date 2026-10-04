-- WhatsApp capture and reminders.
--
-- Entirely additive: two nullable-or-defaulted columns on User, one nullable
-- column on Task, and one new table. SQLite does all of that in place, so no
-- table is rebuilt and no existing row moves.
--
-- Nothing is backfilled, and that is the safe default rather than an omission:
-- `whatsappEnabled` starts false for everyone, so no existing account begins
-- accepting messages or receiving reminders because this migration ran.

-- The number a message arrives from, in local form ("0541234567").
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Opt-in, off by default. Having a number on file is not consent.
ALTER TABLE "User" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- One account per number: inbound resolution has to be unambiguous. SQLite
-- allows any number of NULLs under a unique index, so every existing row —
-- all of which have no phone — stays valid.
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- When a reminder actually went out, so a late one can be recognised as late.
ALTER TABLE "Task" ADD COLUMN "remindedAt" DATETIME;

-- The reminder sweep is cross-user, so none of the userId-prefixed indexes
-- apply to it.
CREATE INDEX "Task_status_scheduledFor_remindedAt_idx" ON "Task"("status", "scheduledFor", "remindedAt");

-- Every message in or out, with the reason when one fails.
CREATE TABLE "WhatsappLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "WhatsappLog_createdAt_idx" ON "WhatsappLog"("createdAt");
CREATE INDEX "WhatsappLog_userId_createdAt_idx" ON "WhatsappLog"("userId", "createdAt");
