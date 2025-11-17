import { clerkClient } from "@clerk/express";

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
