-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TEAM_MEMBER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE 'TEAM_MEMBER_ROLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TEAM_MEMBER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'TEAM_LIST_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_CONFIGURED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'AUDIT_LOG_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'AUDIT_LOG_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'PERMISSION_DENIED';

-- AlterEnum
ALTER TYPE "AuditCategory" ADD VALUE 'USER_MANAGEMENT';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "sequenceNum" BIGSERIAL NOT NULL,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DataAccessLog" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "sequenceNum" BIGSERIAL NOT NULL,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SecurityEvent" ADD COLUMN     "hash" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "sequenceNum" BIGSERIAL NOT NULL,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AuditLog_sequenceNum_idx" ON "AuditLog"("sequenceNum");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_sequenceNum_idx" ON "AuditLog"("companyId", "sequenceNum");

-- CreateIndex
CREATE INDEX "DataAccessLog_sequenceNum_idx" ON "DataAccessLog"("sequenceNum");

-- CreateIndex
CREATE INDEX "DataAccessLog_companyId_sequenceNum_idx" ON "DataAccessLog"("companyId", "sequenceNum");

-- CreateIndex
CREATE INDEX "SecurityEvent_sequenceNum_idx" ON "SecurityEvent"("sequenceNum");

-- CreateIndex
CREATE INDEX "SecurityEvent_companyId_sequenceNum_idx" ON "SecurityEvent"("companyId", "sequenceNum");
