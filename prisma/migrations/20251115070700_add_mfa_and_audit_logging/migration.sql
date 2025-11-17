-- CreateEnum
CREATE TYPE "MFAMethod" AS ENUM ('TOTP', 'BACKUP_CODE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_VERIFIED', 'MFA_FAILED', 'BACKUP_CODES_GENERATED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE', 'DOCUMENT_UPLOADED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_VIEWED', 'DOCUMENT_DELETED', 'DOCUMENT_PROCESSED', 'DRIVER_CREATED', 'DRIVER_UPDATED', 'DRIVER_DELETED', 'DRIVER_INVITED', 'DRIVER_ACCESSED_PORTAL', 'PLAN_UPGRADED', 'PLAN_DOWNGRADED', 'PAYMENT_PROCESSED', 'CREDITS_PURCHASED', 'CREDITS_USED', 'SETTINGS_UPDATED', 'DATA_EXPORTED', 'AUDIT_LOG_ACCESSED', 'ACCESS_DENIED', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'DATA_ACCESS', 'DATA_MODIFICATION', 'BILLING', 'SECURITY', 'COMPLIANCE', 'MFA', 'GENERAL');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('FAILED_LOGIN', 'MULTIPLE_FAILED_LOGINS', 'MULTIPLE_FAILED_MFA', 'ACCOUNT_LOCKED', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('READ', 'WRITE', 'DELETE', 'EXPORT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backupCodesHash" TEXT,
ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "totpVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MFAAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "MFAMethod" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MFAAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "companyId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "method" TEXT,
    "endpoint" TEXT,
    "statusCode" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "region" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changes" TEXT[],
    "metadata" JSONB,
    "errorMessage" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "category" "AuditCategory" NOT NULL DEFAULT 'GENERAL',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "companyId" TEXT,
    "eventType" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'LOW',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "actionTaken" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "companyId" TEXT,
    "dataType" TEXT NOT NULL,
    "dataId" TEXT NOT NULL,
    "dataOwnerId" TEXT,
    "accessType" "AccessType" NOT NULL,
    "operation" TEXT NOT NULL,
    "purpose" TEXT,
    "ipAddress" TEXT,
    "endpoint" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MFAAttempt_userId_idx" ON "MFAAttempt"("userId");

-- CreateIndex
CREATE INDEX "MFAAttempt_userId_createdAt_idx" ON "MFAAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MFAAttempt_success_idx" ON "MFAAttempt"("success");

-- CreateIndex
CREATE INDEX "MFAAttempt_createdAt_idx" ON "MFAAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_resourceId_idx" ON "AuditLog"("resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_timestamp_idx" ON "AuditLog"("companyId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX "SecurityEvent_companyId_idx" ON "SecurityEvent"("companyId");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_idx" ON "SecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_timestamp_idx" ON "SecurityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SecurityEvent_blocked_idx" ON "SecurityEvent"("blocked");

-- CreateIndex
CREATE INDEX "DataAccessLog_userId_idx" ON "DataAccessLog"("userId");

-- CreateIndex
CREATE INDEX "DataAccessLog_companyId_idx" ON "DataAccessLog"("companyId");

-- CreateIndex
CREATE INDEX "DataAccessLog_dataType_idx" ON "DataAccessLog"("dataType");

-- CreateIndex
CREATE INDEX "DataAccessLog_dataId_idx" ON "DataAccessLog"("dataId");

-- CreateIndex
CREATE INDEX "DataAccessLog_timestamp_idx" ON "DataAccessLog"("timestamp");

-- CreateIndex
CREATE INDEX "DataAccessLog_accessType_idx" ON "DataAccessLog"("accessType");

-- AddForeignKey
ALTER TABLE "MFAAttempt" ADD CONSTRAINT "MFAAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
