import { getAuth } from "@clerk/express";
import prisma from "../../prisma/client.js";
import { hasDSPCapability } from "../utils/dspCapabilities.js";
import auditService from "../services/auditService.js";

/**
 * DSP Permission Middleware
 * Checks if user has required capability for the action
 * Logs permission denials for security auditing
 */

/**
 * Middleware factory: Requires user to have a specific capability
 * @param {string} capability - Required capability
 * @returns {Function} - Express middleware function
 */
export const requireCapability = (capability) => {
  return async (req, res, next) => {
    try {
      const clerkUserId = getAuth(req)?.userId;

      if (!clerkUserId) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      // Get user from database with all necessary fields
      const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
          id: true,
          role: true,
          dspRole: true,
          email: true,
          firstName: true,
          lastName: true,
          companyId: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "User not found",
          message: "User not found in database",
        });
      }

      // Check if user has the required capability
      if (!hasDSPCapability(user, capability)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `You do not have permission to perform this action. Required capability: ${capability}`,
          requiredCapability: capability,
          yourRole: user.dspRole || user.role,
        });
      }

      // Attach user to request for downstream use
      req.user = user;

      next();
    } catch (error) {
      console.error("DSP permission middleware error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  };
};

/**
 * Middleware: Requires user to be an ADMIN (dspRole = ADMIN)
 * Used for team management operations
 */
export const requireDSPAdmin = async (req, res, next) => {
  try {
    const clerkUserId = getAuth(req)?.userId;

    if (!clerkUserId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        role: true,
        dspRole: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // SUPER_ADMIN can always access
    if (user.role === "SUPER_ADMIN") {
      req.user = user;
      return next();
    }

    // Must have dspRole = ADMIN
    if (user.dspRole !== "ADMIN") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can perform this action",
        yourRole: user.dspRole || user.role,
      });
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("DSP admin middleware error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

export default {
  requireCapability,
  requireDSPAdmin,
};
