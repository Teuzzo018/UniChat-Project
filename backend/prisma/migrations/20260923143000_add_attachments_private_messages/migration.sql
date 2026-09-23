ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentMimeType" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentSize" INTEGER;
ALTER TABLE "Message" ALTER COLUMN "content" SET DEFAULT '';

CREATE TABLE "PrivateMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSize" INTEGER,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateMessage_senderId_recipientId_createdAt_idx" ON "PrivateMessage"("senderId", "recipientId", "createdAt");
CREATE INDEX "PrivateMessage_recipientId_senderId_createdAt_idx" ON "PrivateMessage"("recipientId", "senderId", "createdAt");

ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
