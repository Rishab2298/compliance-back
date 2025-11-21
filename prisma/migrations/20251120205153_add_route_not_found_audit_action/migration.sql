-- Add ROUTE_NOT_FOUND to AuditAction enum
-- This allows logging of 404 errors from the frontend NotFound page
-- Tracks when users navigate to non-existent routes with user info, IP, referrer

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROUTE_NOT_FOUND';
