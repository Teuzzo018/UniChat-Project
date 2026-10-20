ALTER TABLE "PrivateMessage"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "activityKey" TEXT;

CREATE UNIQUE INDEX "PrivateMessage_activityKey_key" ON "PrivateMessage"("activityKey");
