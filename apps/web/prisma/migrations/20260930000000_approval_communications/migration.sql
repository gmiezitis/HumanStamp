ALTER TABLE "ClientSignOff" ADD COLUMN "requestedByEmail" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "lastReminderAt" TIMESTAMP(3);

-- Historical project-wide decisions must never be silently assigned to a file.
UPDATE "ClientSignOff" s SET "versionId" = NULL
WHERE "versionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "Version" v WHERE v."id" = s."versionId" AND v."projectId" = s."projectId"
);
ALTER TABLE "ClientSignOff" ADD CONSTRAINT "ClientSignOff_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ClientSignOff_versionId_idx" ON "ClientSignOff"("versionId");

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL, "dedupeKey" TEXT NOT NULL, "signOffId" TEXT NOT NULL,
  "kind" TEXT NOT NULL, "recipient" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0,
  "retryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedUntil" TIMESTAMP(3),
  "leaseToken" TEXT, "lastError" TEXT, "acceptedAt" TIMESTAMP(3), "providerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDelivery_dedupeKey_key" ON "EmailDelivery"("dedupeKey");
CREATE INDEX "EmailDelivery_status_retryAt_idx" ON "EmailDelivery"("status", "retryAt");
CREATE INDEX "EmailDelivery_signOffId_idx" ON "EmailDelivery"("signOffId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_signOffId_fkey"
  FOREIGN KEY ("signOffId") REFERENCES "ClientSignOff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
