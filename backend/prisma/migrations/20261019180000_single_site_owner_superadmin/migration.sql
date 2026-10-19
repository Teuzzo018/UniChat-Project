-- Revoke temporary superadmins before applying the owner-only constraint.
DELETE FROM "Session" WHERE "userId" IN (
  SELECT "id" FROM "User" WHERE "role" = 'SUPERADMIN' AND lower("email") <> 'teo.sisto.04@gmail.com'
);
UPDATE "User" SET "role" = 'STUDENT'
  WHERE "role" = 'SUPERADMIN' AND lower("email") <> 'teo.sisto.04@gmail.com';

-- Only the designated site owner may hold the sole SUPERADMIN role.
CREATE UNIQUE INDEX "User_single_superadmin_key" ON "User" ("role") WHERE "role" = 'SUPERADMIN';

ALTER TABLE "User" ADD CONSTRAINT "User_superadmin_owner_email_check"
  CHECK ("role" <> 'SUPERADMIN' OR lower("email") = 'teo.sisto.04@gmail.com');

-- Two-step verification is no longer used. Clear any previously enrolled secrets
-- and pending challenges while keeping the columns for compatible Prisma clients.
UPDATE "User" SET
  "totpSecretEncrypted" = NULL,
  "totpPendingEncrypted" = NULL,
  "totpPendingExpiresAt" = NULL,
  "totpEnabledAt" = NULL,
  "totpLastTimeStep" = NULL,
  "mfaFailedAttempts" = 0,
  "mfaLockedUntil" = NULL;
UPDATE "Session" SET "secondFactorPending" = false, "secondFactorVerifiedAt" = NULL;
DELETE FROM "MfaRecoveryCode";
