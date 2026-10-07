ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "lastActiveAt" DATETIME;

-- Existing session creation is evidence of sign-in, not an invented visit.
UPDATE "User" SET "lastActiveAt" = (
  SELECT MAX("createdAt") FROM "Session" WHERE "Session"."userId" = "User"."id"
);
CREATE INDEX "User_role_lastActiveAt_idx" ON "User"("role", "lastActiveAt");
