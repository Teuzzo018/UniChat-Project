CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

ALTER TABLE "Friendship"
  ADD CONSTRAINT "Friendship_distinct_users_check" CHECK ("requesterId" <> "addresseeId"),
  ADD CONSTRAINT "Friendship_request_author_check" CHECK (
    "requestedById" IS NULL OR "requestedById" = "requesterId" OR "requestedById" = "addresseeId"
  );
