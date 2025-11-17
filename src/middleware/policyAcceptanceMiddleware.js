import { getAuth } from "@clerk/express";
import prisma from "../../prisma/client.js";

/**
 * Policy Acceptance Middleware
 * Ensures team members have accepted all required policies before accessing protected routes
 *
 * This middleware:
 * - Only applies to team members (not admins or super admins)
 * - Checks if user has accepted all 6 mandatory policies
 * - Returns 403 with specific error code if policies not accepted
 */
export const requirePolicyAcceptance = async (req, res, next) => {
  try {
    const clerkUserId = getAuth(req)?.userId;

    if (!clerkUserId) {
      // No user ID, let auth middleware handle it
      return next();
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        role: true,
        companyId: true,
        policiesAccepted: true,
      },
    });

    if (!user) {
      // User not found, let it pass to next middleware/controller
      return next();
    }

    // Skip check for super admins (they don't need to accept policies)
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Skip check for admins without companyId (they accept during onboarding)
    if (!user.companyId) {
      return next();
    }

    // Team members must have accepted policies
    if (!user.policiesAccepted) {
      return res.status(403).json({
        error: "Policy acceptance required",
        message: "You must accept all required policies before accessing this resource",
        errorCode: "POLICIES_NOT_ACCEPTED",
        needsPolicyAcceptance: true,
      });
    }

    // User has accepted policies, continue
    next();
  } catch (error) {
    console.error("Policy acceptance middleware error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Whitelist of routes that should skip policy acceptance check
 * These routes are needed for the policy acceptance flow itself
 */
const whitelistedRoutes = [
  '/api/policies/public/latest',
  '/api/policies/acceptance-status',
  '/api/policies/accept',
  '/api/auth/logout',
  '/api/mfa',
];

/**
 * Check if a route should skip policy acceptance check
 */
export const shouldSkipPolicyCheck = (path) => {
  return whitelistedRoutes.some(route => path.startsWith(route));
};

export default {
  requirePolicyAcceptance,
  shouldSkipPolicyCheck,
};
