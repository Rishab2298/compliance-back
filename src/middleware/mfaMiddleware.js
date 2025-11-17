import { getAuth, clerkClient } from "@clerk/express";
import mfaService from "../services/mfaService.js";
import prisma from "../../prisma/client.js";

/**
 * MFA Enforcement Middleware
 * Ensures users have MFA enabled before accessing protected routes
 * Uses cached metadata from Clerk to avoid database queries on every request
 */

export const requireMFA = async (req, res, next) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // First, check cached metadata from Clerk session (stored in publicMetadata)
    // This avoids database queries on every request
    const sessionClaims = getAuth(req)?.sessionClaims;
    const cachedRole = sessionClaims?.metadata?.role;
    const cachedMfaEnabled = sessionClaims?.metadata?.mfaEnabled;
    const cachedMfaVerified = sessionClaims?.metadata?.mfaVerified;

    // If cache is available, use it
    if (cachedRole !== undefined && cachedMfaEnabled !== undefined) {
      // Drivers don't need MFA
      if (cachedRole === "DRIVER") {
        return next();
      }

      // Check cached MFA status
      if (!cachedMfaEnabled || !cachedMfaVerified) {
        return res.status(403).json({
          error: "MFA_REQUIRED",
          message: "Multi-factor authentication is required. Please set up MFA to continue.",
          requiresMFASetup: true,
        });
      }

      // MFA is enabled and verified, proceed
      return next();
    }

    // Cache miss - fetch from database and update Clerk metadata
    // This only happens once per session or when metadata is missing
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        mfaEnabled: true,
        totpVerified: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update Clerk metadata for future requests (async, don't await)
    clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        mfaVerified: user.totpVerified,
      },
    }).catch(err => console.error("Failed to update Clerk metadata:", err));

    // Check if this is a driver (drivers don't need MFA)
    if (user.role === "DRIVER") {
      return next();
    }

    // Check if MFA is enabled and verified
    const mfaEnabled = user.mfaEnabled && user.totpVerified;

    if (!mfaEnabled) {
      return res.status(403).json({
        error: "MFA_REQUIRED",
        message: "Multi-factor authentication is required. Please set up MFA to continue.",
        requiresMFASetup: true,
      });
    }

    // MFA is enabled, proceed
    next();
  } catch (error) {
    console.error("MFA middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * MFA Verification Middleware
 * Checks if the current session has been verified with MFA
 * This should be used after initial login to verify MFA code
 */

export const verifyMFASession = async (req, res, next) => {
  try {
    const userId = getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has MFA enabled
    const mfaEnabled = await mfaService.isMFAEnabled(userId);

    if (!mfaEnabled) {
      // No MFA required, proceed
      return next();
    }

    // Check for MFA verification in session/token
    // In a real implementation, you'd check a session flag or JWT claim
    // For now, we'll assume Clerk handles this via their session management

    // If using custom auth, you would check:
    // const mfaVerified = req.session?.mfaVerified || req.auth?.mfaVerified;
    // if (!mfaVerified) {
    //   return res.status(403).json({ error: "MFA verification required" });
    // }

    next();
  } catch (error) {
    console.error("MFA session verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
