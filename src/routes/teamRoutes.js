import express from "express";
import {
  inviteTeamMember,
  getTeamMembers,
  getTeamInvitations,
  updateTeamMemberRole,
  removeTeamMember,
} from "../controllers/teamController.js";
import { requireCapability } from "../middleware/dspPermissionMiddleware.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Team Management Routes
 * All routes require authentication (handled by authMiddleware in server.js)
 * Specific routes require 'manage_users' capability (DSP ADMIN only)
 */

// Invite team member (requires manage_users capability)
router.post("/invite", requireCapability("manage_users"), inviteTeamMember);

// Get team members (all authenticated users can view their team)
router.get("/", requireAuth, getTeamMembers);

// Get team invitation history (all authenticated users can view)
router.get("/invitations", requireAuth, getTeamInvitations);

// Update team member role (requires manage_users capability)
router.put("/:userId", requireCapability("manage_users"), updateTeamMemberRole);

// Remove team member (requires manage_users capability)
router.delete("/:userId", requireCapability("manage_users"), removeTeamMember);

export default router;
