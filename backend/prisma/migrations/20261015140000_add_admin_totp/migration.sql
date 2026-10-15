ALTER TABLE "User" ADD COLUMN "totpSecretEncrypted" TEXT,
ADD COLUMN "totpPendingEncrypted" TEXT,
ADD COLUMN "totpPendingExpiresAt" TIMESTAMP(3),
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastTimeStep" INTEGER,
ADD COLUMN "mfaFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfaLockedUntil" TIMESTAMP(3);

ALTER TABLE "Session" ADD COLUMN "secondFactorPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "secondFactorVerifiedAt" TIMESTAMP(3);

CREATE TABLE "MfaRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
