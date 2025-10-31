-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "Document_driverId_status_idx" ON "Document"("driverId", "status");

-- CreateIndex
CREATE INDEX "Document_driverId_expiryDate_idx" ON "Document"("driverId", "expiryDate");
