ALTER TABLE "Server"
  ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "inviteMaxUses" INTEGER,
  ADD COLUMN "inviteUses" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "inviteRevokedAt" TIMESTAMP(3),
  ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Server"
  ADD CONSTRAINT "Server_invite_uses_check" CHECK (
    "inviteUses" >= 0 AND ("inviteMaxUses" IS NULL OR "inviteMaxUses" > 0)
  );

CREATE INDEX "Server_isDiscoverable_universityId_name_idx"
  ON "Server"("isDiscoverable", "universityId", "name");
CREATE INDEX "Channel_serverId_name_idx" ON "Channel"("serverId", "name");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Server_name_trgm_idx" ON "Server" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Server_description_trgm_idx" ON "Server" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Channel_name_trgm_idx" ON "Channel" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
CREATE INDEX "User_fullName_trgm_idx" ON "User" USING GIN ("fullName" gin_trgm_ops);
