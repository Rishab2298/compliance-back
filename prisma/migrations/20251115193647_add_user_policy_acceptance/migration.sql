-- AlterTable
ALTER TABLE "User" ADD COLUMN     "policiesAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "policiesAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserPolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "companyId" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_userId_idx" ON "UserPolicyAcceptance"("userId");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_policyId_idx" ON "UserPolicyAcceptance"("policyId");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_policyType_idx" ON "UserPolicyAcceptance"("policyType");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_userId_policyType_idx" ON "UserPolicyAcceptance"("userId", "policyType");

-- CreateIndex
CREATE INDEX "UserPolicyAcceptance_acceptedAt_idx" ON "UserPolicyAcceptance"("acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPolicyAcceptance_userId_policyId_key" ON "UserPolicyAcceptance"("userId", "policyId");

-- AddForeignKey
ALTER TABLE "UserPolicyAcceptance" ADD CONSTRAINT "UserPolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAcceptance" ADD CONSTRAINT "UserPolicyAcceptance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
