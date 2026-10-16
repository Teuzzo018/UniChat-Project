CREATE TABLE "ChannelMessageFavorite" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMessageFavorite_pkey" PRIMARY KEY ("userId","messageId")
);

CREATE TABLE "PrivateMessageFavorite" (
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrivateMessageFavorite_pkey" PRIMARY KEY ("userId","messageId")
);

CREATE INDEX "ChannelMessageFavorite_userId_createdAt_idx" ON "ChannelMessageFavorite"("userId", "createdAt");
CREATE INDEX "PrivateMessageFavorite_userId_createdAt_idx" ON "PrivateMessageFavorite"("userId", "createdAt");

ALTER TABLE "ChannelMessageFavorite" ADD CONSTRAINT "ChannelMessageFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelMessageFavorite" ADD CONSTRAINT "ChannelMessageFavorite_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessageFavorite" ADD CONSTRAINT "PrivateMessageFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateMessageFavorite" ADD CONSTRAINT "PrivateMessageFavorite_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "PrivateMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
