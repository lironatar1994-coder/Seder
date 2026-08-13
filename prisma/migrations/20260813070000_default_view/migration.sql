-- Which view the app opens on. A plain nullable-with-default column, which
-- SQLite adds in place, so existing rows are untouched.
ALTER TABLE "User" ADD COLUMN "defaultView" TEXT NOT NULL DEFAULT 'today';
