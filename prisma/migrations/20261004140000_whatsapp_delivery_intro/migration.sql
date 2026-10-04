ALTER TABLE "User" ADD COLUMN "whatsappIntroSeenAt" DATETIME;
ALTER TABLE "WhatsappLog" ADD COLUMN "messageId" TEXT;
ALTER TABLE "WhatsappLog" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "WhatsappLog" ADD COLUMN "readAt" DATETIME;
CREATE UNIQUE INDEX "WhatsappLog_messageId_key" ON "WhatsappLog"("messageId");
