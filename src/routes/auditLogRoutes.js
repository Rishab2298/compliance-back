import express from "express";
import {
  getAuditLogs,
  getSecurityEvents,
  verifyIntegrity,
  exportAuditLogs,
} from "../controllers/auditLogController.js";
import { requireCapability } from "../middleware/dspPermissionMiddleware.js";

const router = express.Router();

/**
 * Audit Log Routes
 * All routes require authentication (handled by authMiddleware in server.js)
 * Viewing audit logs requires 'view_audit_logs' capability
 */

// Get audit logs (requires view_audit_logs capability)
router.get("/", requireCapability("view_audit_logs"), getAuditLogs);

// Get security events (requires view_audit_logs capability)
router.get("/security", requireCapability("view_audit_logs"), getSecurityEvents);

// Verify log integrity (requires view_audit_logs capability)
router.get("/verify-integrity", requireCapability("view_audit_logs"), verifyIntegrity);

// Export audit logs (requires view_audit_logs capability)
router.get("/export", requireCapability("view_audit_logs"), exportAuditLogs);

export default router;
