-- CreateTable
CREATE TABLE "PrivateCall" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PrivateCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateCall_callerId_recipientId_startedAt_idx" ON "PrivateCall"("callerId", "recipientId", "startedAt");

-- CreateIndex
CREATE INDEX "PrivateCall_recipientId_callerId_startedAt_idx" ON "PrivateCall"("recipientId", "callerId", "startedAt");

-- AddForeignKey
ALTER TABLE "PrivateCall" ADD CONSTRAINT "PrivateCall_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateCall" ADD CONSTRAINT "PrivateCall_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
