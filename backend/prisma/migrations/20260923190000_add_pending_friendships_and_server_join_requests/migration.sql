CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');
CREATE TYPE "ServerJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Friendship"
ADD COLUMN "requestedById" TEXT,
ADD COLUMN "status" "FriendshipStatus" NOT NULL DEFAULT 'ACCEPTED',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Friendship"
SET "requestedById" = "requesterId"
WHERE "requestedById" IS NULL;

ALTER TABLE "Friendship"
ADD CONSTRAINT "Friendship_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ServerJoinRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "status" "ServerJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServerJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServerJoinRequest_userId_serverId_key" ON "ServerJoinRequest"("userId", "serverId");
CREATE INDEX "ServerJoinRequest_serverId_status_idx" ON "ServerJoinRequest"("serverId", "status");

ALTER TABLE "ServerJoinRequest"
ADD CONSTRAINT "ServerJoinRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServerJoinRequest"
ADD CONSTRAINT "ServerJoinRequest_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
