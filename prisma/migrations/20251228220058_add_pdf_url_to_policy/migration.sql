-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REMINDER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CSV_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_CLOSED';

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "pdfUrl" TEXT;
