-- Add DOCUMENT_DOWNLOAD_URL_GENERATED to AuditAction enum
-- This audit action tracks when presigned download URLs are generated for documents
-- Important for security audit trails and compliance (GDPR, PIPEDA)

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_DOWNLOAD_URL_GENERATED';
