import prisma from '../../prisma/client.js';

/**
 * Get dashboard statistics in one efficient query
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        companyAdmin: {
          select: {
            id: true,
            aiCredits: true,
            plan: true,
          }
        }
      },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyAdmin.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringThreshold = new Date(today);
    expiringThreshold.setDate(expiringThreshold.getDate() + 30);

    const sevenDaysThreshold = new Date(today);
    sevenDaysThreshold.setDate(sevenDaysThreshold.getDate() + 7);

    // Execute all queries in parallel for maximum performance
    const [
      driverCount,
      totalDocuments,
      expiredCount,
      expiringCount,
      expiringSoonCount,
      validCount,
      recentDrivers,
      upcomingExpirations
    ] = await Promise.all([
      // Count total drivers
      prisma.driver.count({
        where: { companyId }
      }),

      // Count total documents
      prisma.document.count({
        where: {
          driver: { companyId }
        }
      }),

      // Count expired documents
      prisma.document.count({
        where: {
          driver: { companyId },
          expiryDate: { lt: today }
        }
      }),

      // Count documents expiring within 30 days
      prisma.document.count({
        where: {
          driver: { companyId },
          expiryDate: {
            gte: today,
            lte: expiringThreshold
          }
        }
      }),

      // Count documents expiring within 7 days (urgent)
      prisma.document.count({
        where: {
          driver: { companyId },
          expiryDate: {
            gte: today,
            lte: sevenDaysThreshold
          }
        }
      }),

      // Count valid documents
      prisma.document.count({
        where: {
          driver: { companyId },
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: expiringThreshold } }
          ]
        }
      }),

      // Get 5 most recently added drivers
      prisma.driver.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: {
            select: { documents: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Get 5 documents expiring soonest
      prisma.document.findMany({
        where: {
          driver: { companyId },
          expiryDate: {
            gte: today,
            lte: expiringThreshold
          }
        },
        select: {
          id: true,
          type: true,
          expiryDate: true,
          driver: {
            select: {
              id: true,
              name: true,
              contact: true,
            }
          }
        },
        orderBy: { expiryDate: 'asc' },
        take: 5,
      })
    ]);

    // Calculate days until expiry for upcoming expirations
    const formattedExpirations = upcomingExpirations.map(doc => {
      const expiryDate = new Date(doc.expiryDate);
      const diffTime = expiryDate - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: doc.id,
        type: doc.type,
        expiryDate: doc.expiryDate,
        daysUntilExpiry,
        driver: {
          id: doc.driver.id,
          name: doc.driver.name,
          employeeId: doc.driver.contact || '',
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalDrivers: driverCount,
          totalDocuments: totalDocuments,
          expiredDocuments: expiredCount,
          expiringDocuments: expiringCount,
          expiringSoonDocuments: expiringSoonCount, // Within 7 days
          validDocuments: validCount,
          aiCredits: user.companyAdmin.aiCredits,
          plan: user.companyAdmin.plan,
        },
        recentDrivers,
        upcomingExpirations: formattedExpirations,
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get document statistics breakdown by type
 * GET /api/dashboard/document-stats
 */
export const getDocumentStatsByType = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        companyAdmin: {
          select: { id: true }
        }
      },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const companyId = user.companyAdmin.id;

    // Group documents by type and count
    const documentsByType = await prisma.document.groupBy({
      by: ['type'],
      where: {
        driver: { companyId }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    const formattedStats = documentsByType.map(item => ({
      type: item.type,
      count: item._count.id
    }));

    return res.status(200).json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Error fetching document stats by type:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
