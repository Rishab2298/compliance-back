-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('DOCUMENT_UPLOADED', 'DOCUMENT_EXPIRING', 'DOCUMENT_EXPIRED', 'DRIVER_CREATED', 'DOCUMENT_NEEDS_REVIEW', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'DRIVER_COMPLIANCE_ALERT', 'REMINDER_SENT', 'REMINDER_FAILED', 'TEAM_MEMBER_INVITED', 'TEAM_MEMBER_JOINED', 'TEAM_MEMBER_REMOVED', 'TEAM_ROLE_CHANGED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_RENEWED', 'TICKET_CREATED', 'TICKET_REPLIED', 'TICKET_RESOLVED', 'SYSTEM_UPDATE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "driverId" TEXT,
    "documentId" TEXT,
    "reminderId" TEXT,
    "ticketId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
