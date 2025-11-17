import mfaService from "../services/mfaService.js";
import auditService from "../services/auditService.js";
import prisma from "../../prisma/client.js";
import { clerkClient } from "@clerk/express";

/**
 * MFA Controller
 * Handles MFA setup, verification, and management endpoints
 */

// Helper function to get user from our database
async function getDbUser(clerkUserId) {
  const dbUser = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!dbUser) {
    throw new Error("User not found in database. Please contact support.");
  }

  return dbUser;
}

// Setup TOTP (Step 1: Generate QR code)
export const setupTOTP = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;

    // Get user from our database (created by Clerk webhook)
    const dbUser = await getDbUser(clerkUserId);

    // Check if MFA already enabled
    const mfaStatus = await mfaService.getMFAStatus(dbUser.id);
    if (mfaStatus?.enabled) {
      return res.status(400).json({
        error: "MFA is already enabled. Disable it first to re-enroll.",
      });
    }

    // Get email from Clerk user (only when needed)
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const userEmail =
      clerkUser.emailAddresses[0]?.emailAddress ||
      dbUser.email ||
      clerkUser.username ||
      `user-${clerkUserId.substring(0, 8)}`;

    const { secret, qrCode } = await mfaService.setupTOTP(
      dbUser.id,
      userEmail
    );

    res.json({
      success: true,
      secret, // For manual entry
      qrCode, // QR code data URL
      message: "Scan the QR code with your authenticator app",
    });
  } catch (error) {
    console.error("TOTP setup error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Verify TOTP and enable MFA (Step 2: Verify code from authenticator)
export const verifyAndEnableTOTP = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: "Invalid code format" });
    }

    const dbUser = await getDbUser(clerkUserId);
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const result = await mfaService.verifyAndEnableTOTP(dbUser.id, code, ipAddress, userAgent);

    res.json({
      success: true,
      backupCodes: result.backupCodes,
      message: "MFA enabled successfully. Save your backup codes!",
    });
  } catch (error) {
    console.error("TOTP verification error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Verify MFA during login
export const verifyMFA = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { code, useBackupCode } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const dbUser = await getDbUser(clerkUserId);
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    let verified = false;
    let remainingCodes = null;

    if (useBackupCode) {
      // Verify backup code
      const result = await mfaService.verifyBackupCode(dbUser.id, code, ipAddress, userAgent);
      verified = result.success;
      remainingCodes = result.remainingCodes;
    } else {
      // Verify TOTP
      verified = await mfaService.verifyTOTP(dbUser.id, code, ipAddress, userAgent);
    }

    if (!verified) {
      return res.status(401).json({
        error: "Invalid code. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "MFA verified successfully",
      ...(useBackupCode && { remainingBackupCodes: remainingCodes }),
    });
  } catch (error) {
    console.error("MFA verification error:", error);
    res.status(401).json({ error: error.message });
  }
};

// Get MFA status
export const getMFAStatus = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const dbUser = await getDbUser(clerkUserId);
    const status = await mfaService.getMFAStatus(dbUser.id);

    res.json(status);
  } catch (error) {
    console.error("Get MFA status error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Regenerate backup codes
export const regenerateBackupCodes = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "TOTP code required" });
    }

    const dbUser = await getDbUser(clerkUserId);
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Verify TOTP before regenerating
    const verified = await mfaService.verifyTOTP(dbUser.id, code, ipAddress, userAgent);

    if (!verified) {
      return res.status(401).json({ error: "Invalid TOTP code" });
    }

    const backupCodes = await mfaService.generateBackupCodes(dbUser.id);

    res.json({
      success: true,
      backupCodes,
      message: "New backup codes generated. Save them securely!",
    });
  } catch (error) {
    console.error("Regenerate backup codes error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Disable MFA
export const disableMFA = async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "TOTP code required to disable MFA" });
    }

    const dbUser = await getDbUser(clerkUserId);
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    await mfaService.disableMFA(dbUser.id, code, ipAddress, userAgent);

    res.json({
      success: true,
      message: "MFA disabled successfully",
    });
  } catch (error) {
    console.error("Disable MFA error:", error);
    res.status(400).json({ error: error.message });
  }
};
