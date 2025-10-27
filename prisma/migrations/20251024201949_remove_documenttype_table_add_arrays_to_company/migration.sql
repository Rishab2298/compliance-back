/*
  Warnings:

  - You are about to drop the column `documents` on the `Company` table. All the data in the column will be lost.
  - The `reminderDays` column on the `Company` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `DocumentType` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DocumentType" DROP CONSTRAINT "DocumentType_companyId_fkey";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "documents",
ADD COLUMN     "documentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "reminderDays",
ADD COLUMN     "reminderDays" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "public"."DocumentType";

-- CreateIndex
CREATE INDEX "Document_driverId_idx" ON "Document"("driverId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");
