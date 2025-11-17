import prisma from '../../prisma/client.js';

/**
 * Get Super Admin Dashboard Stats
 * GET /api/super-admin/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching super admin dashboard stats...');

    // Get total companies count
    const totalCompanies = await prisma.company.count();

    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get active subscriptions count (companies with ACTIVE subscription status)
    const activeSubscriptions = await prisma.company.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        plan: {
          not: 'Free'
        }
      }
    });

    // Calculate total revenue for current month
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyRevenue = await prisma.billingHistory.aggregate({
      where: {
        status: 'PAID',
        paidAt: {
          gte: currentMonthStart
        }
      },
      _sum: {
        amount: true
      }
    });

    // Get all-time revenue
    const totalRevenue = await prisma.billingHistory.aggregate({
      where: {
        status: 'PAID'
      },
      _sum: {
        amount: true
      }
    });

    // Get plan distribution
    const planDistribution = await prisma.company.groupBy({
      by: ['plan'],
      _count: {
        plan: true
      }
    });

    // Get recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = await prisma.company.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Get companies by subscription status
    const subscriptionStats = await prisma.company.groupBy({
      by: ['subscriptionStatus'],
      _count: {
        subscriptionStatus: true
      }
    });

    const stats = {
      totalCompanies,
      totalUsers,
      activeSubscriptions,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentSignups,
      planDistribution: planDistribution.map(p => ({
        plan: p.plan,
        count: p._count.plan
      })),
      subscriptionStats: subscriptionStats.map(s => ({
        status: s.subscriptionStatus,
        count: s._count.subscriptionStatus
      }))
    };

    console.log('✅ Dashboard stats fetched:', stats);

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get All Companies (for super admin)
 * GET /api/super-admin/companies
 */
export const getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { adminEmail: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          adminUser: {
            select: {
              email: true,
              clerkUserId: true
            }
          },
          _count: {
            select: {
              drivers: true,
              User: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.company.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get Single Company by ID (for super admin)
 * GET /api/super-admin/companies/:id
 */
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🏢 Fetching company details for ID: ${id}`);

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        adminUser: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            clerkUserId: true,
            role: true,
            dspRole: true,
            createdAt: true
          }
        },
        User: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            dspRole: true,
            createdAt: true,
            mfaEnabled: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            drivers: true,
            billingHistory: true,
            creditTransactions: true,
            User: true
          }
        }
      }
    });

    if (!company) {
      console.log(`❌ Company not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    console.log(`✅ Company details fetched: ${company.name}`);

    return res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('❌ Error fetching company details:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get All Users (for super admin)
 * GET /api/super-admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: parseInt(limit),
        include: {
          companyAdmin: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.user.count()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get Recent Activity (for super admin)
 * GET /api/super-admin/activity
 */
export const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get recent billing transactions
    const recentBilling = await prisma.billingHistory.findMany({
      take: parseInt(limit),
      include: {
        company: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get recently created companies
    const recentCompanies = await prisma.company.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        plan: true,
        createdAt: true
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        recentBilling,
        recentCompanies
      }
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get AI Usage Statistics and Records
 * GET /api/super-admin/ai-usage
 */
export const getAIUsage = async (req, res) => {
  try {
    const { page = 1, limit = 20, period = 'all', feature = 'all', status = 'all', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('📊 Fetching AI usage data...', { page, limit, period, feature, status, search });

    // Build date filter based on period
    let dateFilter = {};
    const now = new Date();

    if (period === 'today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfDay };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (period === 'month') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(now.getDate() - 30);
      dateFilter = { gte: startOfMonth };
    }

    // Build where clause
    const where = {
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      ...(feature !== 'all' && { feature }),
      ...(status !== 'all' && { status }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { userName: { contains: search, mode: 'insensitive' } },
          { userEmail: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Fetch AI usage records and total count
    const [aiUsageRecords, total] = await Promise.all([
      prisma.aIUsage.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.aIUsage.count({ where })
    ]);

    // Calculate statistics
    const stats = await prisma.aIUsage.aggregate({
      where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      _sum: {
        tokensUsed: true,
        cost: true
      },
      _count: {
        id: true
      }
    });

    // Get unique companies count
    const uniqueCompanies = await prisma.aIUsage.groupBy({
      by: ['companyId'],
      where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
    });

    // Get top feature
    const featureUsage = await prisma.aIUsage.groupBy({
      by: ['feature'],
      where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      _count: {
        feature: true
      },
      orderBy: {
        _count: {
          feature: 'desc'
        }
      },
      take: 1
    });

    const statsData = {
      totalRequests: stats._count.id || 0,
      totalTokens: stats._sum.tokensUsed || 0,
      totalCost: stats._sum.cost || 0,
      activeCompanies: uniqueCompanies.length,
      topFeature: featureUsage.length > 0 ? featureUsage[0].feature : 'N/A'
    };

    console.log('✅ AI usage data fetched:', { total, stats: statsData });

    return res.status(200).json({
      stats: statsData,
      records: aiUsageRecords,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching AI usage:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get System Logs
 * GET /api/super-admin/logs
 */
export const getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, period = 'all', severity = 'all', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('📋 Fetching system logs...', { page, limit, period, severity, search });

    // Build date filter based on period
    let dateFilter = {};
    const now = new Date();

    if (period === 'today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfDay };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (period === 'month') {
      const startOfMonth = new Date(now);
      startOfMonth.setDate(now.getDate() - 30);
      dateFilter = { gte: startOfMonth };
    }

    // Build where clause
    const where = {
      ...(Object.keys(dateFilter).length > 0 && { timestamp: dateFilter }),
      ...(severity !== 'all' && { severity }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { details: { contains: search, mode: 'insensitive' } },
          { userEmail: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Fetch logs and total count
    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    // Convert BigInt to number
    const total = Number(totalCount);

    // Calculate statistics by severity
    const severityStats = await prisma.auditLog.groupBy({
      by: ['severity'],
      where: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {},
      _count: {
        severity: true
      }
    });

    const statsData = {
      total: total,
      error: Number(severityStats.find(s => s.severity === 'error')?._count.severity || 0),
      warning: Number(severityStats.find(s => s.severity === 'warning')?._count.severity || 0),
      info: Number(severityStats.find(s => s.severity === 'info')?._count.severity || 0)
    };

    // Convert BigInt fields to strings for JSON serialization
    const logsConverted = logs.map(log => ({
      ...log,
      sequenceNumber: log.sequenceNumber?.toString()
    }));

    console.log('✅ System logs fetched:', { total, stats: statsData });

    return res.status(200).json({
      success: true,
      data: {
        logs: logsConverted,
        stats: statsData,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching system logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get Consent Logs
 * GET /api/super-admin/consent-logs
 * Returns all policy consent/acceptance logs with filtering and pagination
 */
export const getConsentLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, policyType, startDate, endDate, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('📋 Fetching consent logs with filters:', { page, limit, userId, policyType, startDate, endDate, search });

    // Build where clause
    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (policyType) {
      where.policyType = policyType;
    }

    if (startDate || endDate) {
      where.acceptedAt = {};
      if (startDate) {
        where.acceptedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.acceptedAt.lte = new Date(endDate);
      }
    }

    // Add search filter for user email
    if (search) {
      where.userEmail = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Fetch consent logs with user and policy details
    const [logs, totalCount] = await Promise.all([
      prisma.userPolicyAcceptance.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          acceptedAt: 'desc'
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            }
          },
          policy: {
            select: {
              id: true,
              type: true,
              version: true,
              content: true,
              contentHash: true,
              isPublished: true,
              publishedAt: true,
            }
          }
        }
      }),
      prisma.userPolicyAcceptance.count({ where })
    ]);

    // Convert BigInt to number
    const total = Number(totalCount);

    // Calculate statistics
    const stats = {
      total: total,
      byPolicyType: {},
      last30Days: 0,
    };

    // Count by policy type
    const policyTypeCounts = await prisma.userPolicyAcceptance.groupBy({
      by: ['policyType'],
      _count: {
        policyType: true
      }
    });

    policyTypeCounts.forEach(item => {
      stats.byPolicyType[item.policyType] = Number(item._count.policyType);
    });

    // Count last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30Count = await prisma.userPolicyAcceptance.count({
      where: {
        acceptedAt: {
          gte: thirtyDaysAgo
        }
      }
    });
    stats.last30Days = Number(last30Count);

    console.log('✅ Consent logs fetched:', { total, page });

    return res.status(200).json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching consent logs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get All Billing Data (Super Admin Only)
 * GET /api/super-admin/billing
 * Returns all transactions, company-plan associations, and transaction logs
 */
export const getAllBillingData = async (req, res) => {
  try {
    console.log('💰 Fetching all billing data for super admin...');

    // Get all companies with their billing info
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        adminEmail: true,
        plan: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        billingCycle: true,
        planStartDate: true,
        nextBillingDate: true,
        aiCredits: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            billingHistory: true,
            creditTransactions: true,
            drivers: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get all billing history with company info
    const allBillingHistory = await prisma.billingHistory.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            adminEmail: true,
            plan: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 500 // Last 500 transactions
    });

    // Get all credit transactions with company info
    const allCreditTransactions = await prisma.creditTransaction.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            adminEmail: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 500 // Last 500 credit transactions
    });

    // Calculate summary statistics
    const totalRevenue = await prisma.billingHistory.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
      _count: { id: true }
    });

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyRevenue = await prisma.billingHistory.aggregate({
      where: {
        status: 'PAID',
        paidAt: { gte: currentMonthStart }
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Get plan distribution
    const planDistribution = await prisma.company.groupBy({
      by: ['plan'],
      _count: { plan: true },
      _sum: { aiCredits: true }
    });

    // Get subscription status breakdown
    const subscriptionBreakdown = await prisma.company.groupBy({
      by: ['subscriptionStatus'],
      _count: { subscriptionStatus: true }
    });

    const stats = {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalTransactions: totalRevenue._count.id || 0,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      monthlyTransactions: monthlyRevenue._count.id || 0,
      totalCompanies: companies.length,
      planDistribution: planDistribution.map(p => ({
        plan: p.plan,
        count: p._count.plan,
        totalCredits: p._sum.aiCredits || 0
      })),
      subscriptionBreakdown: subscriptionBreakdown.map(s => ({
        status: s.subscriptionStatus,
        count: s._count.subscriptionStatus
      }))
    };

    console.log('✅ Billing data fetched successfully');
    console.log('📊 Companies:', companies.length);
    console.log('💳 Billing History:', allBillingHistory.length);
    console.log('💰 Credit Transactions:', allCreditTransactions.length);
    console.log('📈 Stats:', stats);

    return res.status(200).json({
      success: true,
      data: {
        companies,
        billingHistory: allBillingHistory,
        creditTransactions: allCreditTransactions,
        stats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching billing data:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

export default {
  getDashboardStats,
  getAllCompanies,
  getCompanyById,
  getAllUsers,
  getRecentActivity,
  getAIUsage,
  getSystemLogs,
  getConsentLogs,
  getAllBillingData
};
