import speakeasy from "speakeasy";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../../prisma/client.js";
import auditService from "./auditService.js";
import { clerkClient } from "@clerk/express";

/**
 * MFA Service
 * Handles TOTP generation, verification, and backup codes
 */

class MFAService {
  constructor() {
    // Encryption key for TOTP secrets (should be in .env)
    this.encryptionKey = process.env.MFA_ENCRYPTION_KEY || "default-key-change-in-production";
    this.algorithm = "aes-256-ctr";
  }

  /**
   * Encrypt TOTP secret before storing
   */
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey, "hex").slice(0, 32),
      iv
    );
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  }

  /**
   * Decrypt TOTP secret when verifying
   */
  decrypt(encryptedText) {
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey, "hex").slice(0, 32),
      iv
    );
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString();
  }

  /**
   * Generate TOTP secret and QR code for user enrollment
   */
  async setupTOTP(userId, userEmail) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Complyo (${userEmail})`,
      issuer: "Complyo",
      length: 32,
    });

    // Encrypt and store secret (not verified yet)
    const encryptedSecret = this.encrypt(secret.base32);

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedSecret,
        totpVerified: false,
      },
    });

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32, // Return plain secret for manual entry
      qrCode: qrCodeDataUrl,
    };
  }

  /**
   * Verify TOTP code and enable MFA
   */
  async verifyAndEnableTOTP(userId, token, ipAddress, userAgent) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.totpSecret) {
      throw new Error("TOTP not set up");
    }

    // Decrypt secret
    const secret = this.decrypt(user.totpSecret);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Allow 2 time steps before/after for clock drift
    });

    // Log MFA attempt
    await prisma.mFAAttempt.create({
      data: {
        userId,
        method: "TOTP",
        success: verified,
        ipAddress,
        userAgent,
        failureReason: verified ? null : "Invalid code",
      },
    });

    if (!verified) {
      // Log failed verification
      await auditService.logMFA({
        userId,
        userEmail: user.email,
        action: "MFA_FAILED",
        method: "TOTP",
        success: false,
        ipAddress,
        userAgent,
      });

      throw new Error("Invalid TOTP code");
    }

    // Mark TOTP as verified and enable MFA
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        totpVerified: true,
        mfaEnabled: true,
        mfaEnrolledAt: new Date(),
      },
    });

    // Update Clerk metadata to invalidate cache
    if (updatedUser.clerkUserId) {
      clerkClient.users.updateUserMetadata(updatedUser.clerkUserId, {
        publicMetadata: {
          mfaEnabled: true,
          mfaVerified: true,
          role: updatedUser.role,
        },
      }).catch(err => console.error("Failed to update Clerk metadata:", err));
    }

    // Generate backup codes
    const backupCodes = await this.generateBackupCodes(userId);

    // Log successful MFA enrollment
    await auditService.logMFA({
      userId,
      userEmail: user.email,
      action: "MFA_ENABLED",
      method: "TOTP",
      success: true,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      backupCodes,
    };
  }

  /**
   * Verify TOTP code during login
   */
  async verifyTOTP(userId, token, ipAddress, userAgent) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.totpSecret || !user.totpVerified) {
      throw new Error("MFA not enabled");
    }

    // Check for suspicious activity (too many failed attempts)
    const suspicious = await auditService.checkSuspiciousActivity(userId, ipAddress);
    if (suspicious) {
      throw new Error("Too many failed attempts. Account temporarily locked.");
    }

    // Decrypt secret
    const secret = this.decrypt(user.totpSecret);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2,
    });

    // Log attempt
    await prisma.mFAAttempt.create({
      data: {
        userId,
        method: "TOTP",
        success: verified,
        ipAddress,
        userAgent,
        failureReason: verified ? null : "Invalid code",
      },
    });

    if (verified) {
      await auditService.logMFA({
        userId,
        userEmail: user.email,
        action: "MFA_VERIFIED",
        method: "TOTP",
        success: true,
        ipAddress,
        userAgent,
      });
    } else {
      await auditService.logMFA({
        userId,
        userEmail: user.email,
        action: "MFA_FAILED",
        method: "TOTP",
        success: false,
        ipAddress,
        userAgent,
      });

      // Check for multiple failed MFA attempts (last 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentFailures = await prisma.mFAAttempt.count({
        where: {
          userId,
          success: false,
          timestamp: {
            gte: fifteenMinutesAgo,
          },
        },
      });

      // Log security event if 3 or more failures in 15 minutes
      if (recentFailures >= 3) {
        await auditService.logSecurityEvent({
          userId,
          userEmail: user.email,
          companyId: user.companyId,
          eventType: "MULTIPLE_FAILED_MFA",
          severity: recentFailures >= 5 ? "HIGH" : "MEDIUM",
          ipAddress,
          userAgent,
          location: null,
          description: `Multiple failed MFA attempts detected: ${recentFailures} failures in last 15 minutes`,
          metadata: {
            failureCount: recentFailures,
            timeWindow: "15 minutes",
            method: "TOTP",
          },
          blocked: false,
          actionTaken: recentFailures >= 5 ? "Account flagged for review" : "Monitoring",
        });
      }
    }

    return verified;
  }

  /**
   * Generate 10 backup codes
   */
  async generateBackupCodes(userId) {
    const codes = [];
    const hashedCodes = [];

    // Generate 10 random codes
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
      codes.push(formattedCode);

      // Hash each code
      const hash = await bcrypt.hash(formattedCode, 10);
      hashedCodes.push({
        code: hash,
        used: false,
      });
    }

    // Store hashed codes
    await prisma.user.update({
      where: { id: userId },
      data: {
        backupCodesHash: JSON.stringify(hashedCodes),
      },
    });

    // Log backup codes generation
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    await auditService.logAudit({
      userId,
      userEmail: user.email,
      action: "BACKUP_CODES_GENERATED",
      resource: "MFA",
      severity: "INFO",
      category: "MFA",
    });

    return codes; // Return plain codes (show to user once)
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId, code, ipAddress, userAgent) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.backupCodesHash) {
      throw new Error("No backup codes available");
    }

    const backupCodes = JSON.parse(user.backupCodesHash);
    let codeVerified = false;
    let codeIndex = -1;

    // Check each backup code
    for (let i = 0; i < backupCodes.length; i++) {
      const storedCode = backupCodes[i];

      // Skip already used codes
      if (storedCode.used) continue;

      // Check if code matches
      const match = await bcrypt.compare(code, storedCode.code);
      if (match) {
        codeVerified = true;
        codeIndex = i;
        break;
      }
    }

    // Log attempt
    await prisma.mFAAttempt.create({
      data: {
        userId,
        method: "BACKUP_CODE",
        success: codeVerified,
        ipAddress,
        userAgent,
        failureReason: codeVerified ? null : "Invalid backup code",
      },
    });

    if (!codeVerified) {
      await auditService.logMFA({
        userId,
        userEmail: user.email,
        action: "MFA_FAILED",
        method: "BACKUP_CODE",
        success: false,
        ipAddress,
        userAgent,
      });

      // Check for multiple failed MFA attempts (last 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentFailures = await prisma.mFAAttempt.count({
        where: {
          userId,
          success: false,
          timestamp: {
            gte: fifteenMinutesAgo,
          },
        },
      });

      // Log security event if 3 or more failures in 15 minutes
      if (recentFailures >= 3) {
        await auditService.logSecurityEvent({
          userId,
          userEmail: user.email,
          companyId: user.companyId,
          eventType: "MULTIPLE_FAILED_MFA",
          severity: recentFailures >= 5 ? "HIGH" : "MEDIUM",
          ipAddress,
          userAgent,
          location: null,
          description: `Multiple failed MFA attempts detected: ${recentFailures} failures in last 15 minutes`,
          metadata: {
            failureCount: recentFailures,
            timeWindow: "15 minutes",
            method: "BACKUP_CODE",
          },
          blocked: false,
          actionTaken: recentFailures >= 5 ? "Account flagged for review" : "Monitoring",
        });
      }

      throw new Error("Invalid backup code");
    }

    // Mark code as used
    backupCodes[codeIndex].used = true;

    await prisma.user.update({
      where: { id: userId },
      data: {
        backupCodesHash: JSON.stringify(backupCodes),
      },
    });

    // Count remaining codes
    const remainingCodes = backupCodes.filter((c) => !c.used).length;

    // Log successful verification
    await auditService.logMFA({
      userId,
      userEmail: user.email,
      action: "MFA_VERIFIED",
      method: "BACKUP_CODE",
      success: true,
      ipAddress,
      userAgent,
      metadata: {
        remainingBackupCodes: remainingCodes,
      },
    });

    return {
      success: true,
      remainingCodes,
    };
  }

  /**
   * Disable MFA (requires verification)
   */
  async disableMFA(userId, token, ipAddress, userAgent) {
    // Verify TOTP first
    const verified = await this.verifyTOTP(userId, token, ipAddress, userAgent);

    if (!verified) {
      throw new Error("Invalid TOTP code. Cannot disable MFA.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Disable MFA
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        totpSecret: null,
        totpVerified: false,
        backupCodesHash: null,
      },
    });

    // Update Clerk metadata to invalidate cache
    if (updatedUser.clerkUserId) {
      clerkClient.users.updateUserMetadata(updatedUser.clerkUserId, {
        publicMetadata: {
          mfaEnabled: false,
          mfaVerified: false,
          role: updatedUser.role,
        },
      }).catch(err => console.error("Failed to update Clerk metadata:", err));
    }

    // Log MFA disabled
    await auditService.logAudit({
      userId,
      userEmail: user.email,
      action: "MFA_DISABLED",
      resource: "MFA",
      severity: "WARNING",
      category: "MFA",
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, totpVerified: true },
    });

    return user?.mfaEnabled && user?.totpVerified;
  }

  /**
   * Get MFA status for user
   */
  async getMFAStatus(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        totpVerified: true,
        mfaEnrolledAt: true,
        backupCodesHash: true,
      },
    });

    if (!user) {
      return null;
    }

    let remainingBackupCodes = 0;
    if (user.backupCodesHash) {
      const codes = JSON.parse(user.backupCodesHash);
      remainingBackupCodes = codes.filter((c) => !c.used).length;
    }

    return {
      enabled: user.mfaEnabled,
      verified: user.totpVerified,
      enrolledAt: user.mfaEnrolledAt,
      remainingBackupCodes,
    };
  }
}

export default new MFAService();
