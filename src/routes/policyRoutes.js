import express from "express";
import {
  createPolicy,
  updatePolicy,
  publishPolicy,
  unpublishPolicy,
  getLatestPublishedPolicy,
  getAllLatestPublishedPolicies,
  getPolicyHistory,
  getPolicyById,
  deletePolicy,
  getPolicyStatus,
  acceptPolicies,
  getAcceptanceStatus,
} from "../controllers/policyController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Policy Routes
 *
 * PUBLIC routes (no auth required):
 * - GET /api/policies/public/latest - Get all latest published policies
 * - GET /api/policies/public/latest/:type - Get latest published policy by type
 *
 * PROTECTED routes (SUPER_ADMIN only):
 * - GET /api/policies/status - Get status of all policy types
 * - POST /api/policies - Create new policy version
 * - PUT /api/policies/:type - Update policy (creates new version)
 * - GET /api/policies/history/:type - Get all versions of a policy
 * - GET /api/policies/:id - Get specific policy by ID
 * - PUT /api/policies/:id/publish - Publish a policy version
 * - PUT /api/policies/:id/unpublish - Unpublish a policy version
 * - DELETE /api/policies/:id - Delete a policy version (if not published)
 */

// ============================================
// PUBLIC ROUTES (for user onboarding flow)
// ============================================

// Get all latest published policies
router.get("/public/latest", getAllLatestPublishedPolicies);

// Get latest published policy by type
router.get("/public/latest/:type", getLatestPublishedPolicy);

// ============================================
// TEAM MEMBER ROUTES (for policy acceptance after MFA)
// ============================================

// Accept policies (team members only)
router.post("/accept", authMiddleware, acceptPolicies);

// Get acceptance status (check if user needs to accept policies)
router.get("/acceptance-status", authMiddleware, getAcceptanceStatus);

// ============================================
// PROTECTED ROUTES (SUPER_ADMIN only)
// ============================================

// Get policy status overview
router.get("/status", authMiddleware, getPolicyStatus);

// Create new policy
router.post("/", authMiddleware, createPolicy);

// Update policy (creates new version)
router.put("/:type", authMiddleware, updatePolicy);

// Get policy history
router.get("/history/:type", authMiddleware, getPolicyHistory);

// Get specific policy by ID
router.get("/:id", authMiddleware, getPolicyById);

// Publish policy
router.put("/:id/publish", authMiddleware, publishPolicy);

// Unpublish policy
router.put("/:id/unpublish", authMiddleware, unpublishPolicy);

// Delete policy
router.delete("/:id", authMiddleware, deletePolicy);

export default router;
