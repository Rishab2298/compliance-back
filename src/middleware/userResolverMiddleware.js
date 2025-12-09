import prisma from '../../prisma/client.js';

/**
 * Middleware to resolve Clerk user ID to database user ID
 * Attaches the database user object to req.dbUser
 * This reduces redundant database queries across notification endpoints
 */
export const resolveUser = async (req, res, next) => {
  try {
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        companyId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Your user account could not be found in the database. Please contact support.',
      });
    }

    // Attach user to request object for downstream use
    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Error resolving user:', error);

    // Distinguish between database errors and user not found
    if (error.code === 'P2021' || error.code === 'P2025') {
      // Prisma-specific errors for missing records
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Database connection or other errors
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Failed to retrieve user information. Please try again.',
    });
  }
};
