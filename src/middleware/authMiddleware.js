import { clerkClient, getAuth } from "@clerk/express";
import prisma from "../../prisma/client.js";
import auditService from "../services/auditService.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // Get auth from clerkMiddleware()
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      console.error("No auth or userId found");

      // Log failed authentication attempt as security event
      const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
      const userAgent = req.headers["user-agent"];

      await auditService.logSecurityEvent({
        userId: null,
        userEmail: null,
        companyId: null,
        eventType: "FAILED_LOGIN",
        severity: "MEDIUM",
        ipAddress,
        userAgent,
        location: null,
        description: "Authentication failed - No valid session or userId",
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
        },
        blocked: true,
        actionTaken: "Request rejected with 401",
      });

      return res.status(401).json({ message: "Unauthorized - No valid session" });
    }

    // Store userId for downstream middleware
    // Only fetch full user details from Clerk when specifically needed
    // This avoids expensive API calls on every request
    req.userId = auth.userId;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * Middleware: Requires authentication and attaches full user object
 * Use this for routes that need user info but don't require specific capabilities
 */
export const requireAuth = async (req, res, next) => {
  try {
    const clerkUserId = getAuth(req)?.userId;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    if (!clerkUserId) {
      // Log authentication failure
      await auditService.logSecurityEvent({
        userId: null,
        userEmail: null,
        companyId: null,
        eventType: "FAILED_LOGIN",
        severity: "MEDIUM",
        ipAddress,
        userAgent,
        location: null,
        description: "Authentication required - No Clerk user ID found",
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
        },
        blocked: true,
        actionTaken: "Request rejected with 401",
      });

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
      // Log user not found as security event
      await auditService.logSecurityEvent({
        userId: clerkUserId,
        userEmail: null,
        companyId: null,
        eventType: "SUSPICIOUS_ACTIVITY",
        severity: "HIGH",
        ipAddress,
        userAgent,
        location: null,
        description: "Valid Clerk session but user not found in database",
        metadata: {
          clerkUserId,
          endpoint: req.originalUrl,
          method: req.method,
        },
        blocked: true,
        actionTaken: "Request rejected with 404",
      });

      return res.status(404).json({
        error: "User not found",
        message: "User not found in database",
      });
    }

    // Attach user to request for downstream use
    req.user = user;

    next();
  } catch (error) {
    console.error("requireAuth middleware error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
