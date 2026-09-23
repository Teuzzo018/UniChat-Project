ALTER TABLE "Server" ADD COLUMN "inviteCode" TEXT;

UPDATE "Server"
SET "inviteCode" = substr(md5(random()::text || clock_timestamp()::text || id), 1, 12)
WHERE "inviteCode" IS NULL;

ALTER TABLE "Server" ALTER COLUMN "inviteCode" SET NOT NULL;

CREATE UNIQUE INDEX "Server_inviteCode_key" ON "Server"("inviteCode");
