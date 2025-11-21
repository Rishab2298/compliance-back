import { clerkClient } from "@clerk/express";
import auditService from "../services/auditService.js";
import prisma from "../../prisma/client.js";

/**
 * Middleware to verify SUPER_ADMIN role
 * Checks if the authenticated user has SUPER_ADMIN role in their public metadata
 */
export const superAdminMiddleware = async (req, res, next) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Get user from Clerk to check their role
    const user = await clerkClient.users.getUser(userId);
    const role = user?.publicMetadata?.role;

    console.log(`🔐 Super Admin Middleware - User: ${userId}, Role: ${role}`);

    if (role !== 'SUPER_ADMIN') {
      console.log(`❌ Access denied - User ${userId} is not a SUPER_ADMIN`);

      // Log unauthorized super admin access attempt
      try {
        // Try to get user info from database
        const dbUser = await prisma.user.findUnique({
          where: { clerkUserId: userId },
          select: { id: true, email: true, companyId: true },
        });

        const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
        const userAgent = req.headers["user-agent"];

        await auditService.logSecurityEvent({
          userId: dbUser?.id || userId,
          userEmail: dbUser?.email || user?.emailAddresses?.[0]?.emailAddress,
          companyId: dbUser?.companyId,
          eventType: "UNAUTHORIZED_ACCESS_ATTEMPT",
          severity: "HIGH",
          ipAddress,
          userAgent,
          location: null,
          description: "Attempted to access super admin resource without SUPER_ADMIN role",
          metadata: {
            currentRole: role,
            requiredRole: "SUPER_ADMIN",
            endpoint: req.originalUrl,
            method: req.method,
          },
          blocked: true,
          actionTaken: "Request rejected with 403",
        });
      } catch (error) {
        console.error("Error logging super admin access attempt:", error);
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Super admin access required'
      });
    }

    console.log(`✅ Super admin access granted for user ${userId}`);
    next();
  } catch (error) {
    console.error('Error in super admin middleware:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
