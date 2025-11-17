-- CreateEnum
CREATE TYPE "AIFeature" AS ENUM ('DOCUMENT_ANALYSIS', 'SMART_UPLOAD', 'DATA_VALIDATION', 'COMPLIANCE_CHECK', 'CHAT_SUPPORT', 'TEXT_GENERATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AIUsageStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL', 'TIMEOUT');

-- CreateTable
CREATE TABLE "AIUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "feature" "AIFeature" NOT NULL,
    "action" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model" TEXT,
    "provider" TEXT,
    "requestDuration" INTEGER,
    "status" "AIUsageStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIUsage_companyId_idx" ON "AIUsage"("companyId");

-- CreateIndex
CREATE INDEX "AIUsage_userId_idx" ON "AIUsage"("userId");

-- CreateIndex
CREATE INDEX "AIUsage_feature_idx" ON "AIUsage"("feature");

-- CreateIndex
CREATE INDEX "AIUsage_status_idx" ON "AIUsage"("status");

-- CreateIndex
CREATE INDEX "AIUsage_createdAt_idx" ON "AIUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_companyId_createdAt_idx" ON "AIUsage"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsage_feature_createdAt_idx" ON "AIUsage"("feature", "createdAt");
