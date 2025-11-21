-- Add CLIENT_ERROR to AuditAction enum
-- This allows logging of frontend errors from the ErrorBoundary component

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CLIENT_ERROR';
