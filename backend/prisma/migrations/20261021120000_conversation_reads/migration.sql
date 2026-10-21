CREATE TABLE "ConversationRead" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("userId","kind","targetId")
);

ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");
