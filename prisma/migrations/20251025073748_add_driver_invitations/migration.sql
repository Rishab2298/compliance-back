-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'ACCESSED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DriverInvitation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "requestedDocuments" TEXT[],
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "linkAccessedAt" TIMESTAMP(3),
    "documentsUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverInvitation_driverId_key" ON "DriverInvitation"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverInvitation_token_key" ON "DriverInvitation"("token");

-- CreateIndex
CREATE INDEX "DriverInvitation_token_idx" ON "DriverInvitation"("token");

-- CreateIndex
CREATE INDEX "DriverInvitation_status_idx" ON "DriverInvitation"("status");

-- CreateIndex
CREATE INDEX "DriverInvitation_expiresAt_idx" ON "DriverInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "DriverInvitation" ADD CONSTRAINT "DriverInvitation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
