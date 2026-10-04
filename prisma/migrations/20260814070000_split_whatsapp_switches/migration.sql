-- One WhatsApp switch becomes two.
--
-- Letting the app turn your messages into tasks and letting it message you are
-- two different permissions, and a single flag forced them to be the same
-- answer. Someone who wants the morning reminder but prefers to file tasks by
-- hand had no way to say so.
--
-- Backfilled from the old flag before it is dropped, so nobody's setting
-- changes: whoever had it on gets both on, whoever had it off gets both off.

ALTER TABLE "User" ADD COLUMN "whatsappCapture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "whatsappReminders" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "whatsappCapture" = "whatsappEnabled", "whatsappReminders" = "whatsappEnabled";

-- Dropped only after the values are carried across, so a failure here leaves
-- the old column intact and the release rolls back onto it.
ALTER TABLE "User" DROP COLUMN "whatsappEnabled";
