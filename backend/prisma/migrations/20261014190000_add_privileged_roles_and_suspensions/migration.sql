-- Mantiene ADMIN per gli account preesistenti: il codice lo tratta come admin di piattaforma.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "ServerMember" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_role_suspendedAt_idx" ON "User"("role", "suspendedAt");
CREATE INDEX "ServerMember_serverId_isAdmin_idx" ON "ServerMember"("serverId", "isAdmin");
