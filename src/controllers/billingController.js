import prisma from '../../prisma/client.js';
import {
  purchaseCredits,
  upgradePlan,
  initiatePlanDowngrade,
  checkLimit,
} from '../services/billingService.js';
import { getAllPlans, getPlanLimits } from '../config/planLimits.js';
import {
  createSubscriptionCheckout,
  createCreditPurchaseCheckout,
  createBillingPortalSession,
} from '../services/stripeService.js';

/**
 * Get all available plans
 * GET /api/billing/plans
 */
export const getPlans = async (req, res) => {
  try {
    const plans = getAllPlans();

    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get current plan and usage for company
 * GET /api/billing/current
 */
export const getCurrentPlan = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = user.companyAdmin;

    // Get driver count
    const driverCount = await prisma.driver.count({
      where: { companyId: company.id },
    });

    // Get document counts
    const documents = await prisma.document.count({
      where: {
        driver: {
          companyId: company.id,
        },
      },
    });

    // Get plan limits
    const planLimits = getPlanLimits(company.plan);

    // Calculate usage percentages
    const driverUsagePercent = planLimits.maxDrivers === -1
      ? 0
      : Math.round((driverCount / planLimits.maxDrivers) * 100);

    // Log company data for debugging
    console.log('📊 Returning company data:', {
      name: company.name,
      email: company.adminEmail,
      phone: company.adminPhone,
    });

    return res.status(200).json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          email: company.adminEmail,
          phone: company.adminPhone,
        },
        currentPlan: {
          name: company.plan,
          ...planLimits,
        },
        usage: {
          drivers: {
            current: driverCount,
            limit: planLimits.maxDrivers,
            percentage: driverUsagePercent,
          },
          aiCredits: {
            current: company.aiCredits,
            monthlyAllotment: planLimits.monthlyAICredits,
            used: company.monthlyCreditsUsed,
          },
          documents: {
            total: documents,
          },
        },
        billing: {
          subscriptionStatus: company.subscriptionStatus,
          nextBillingDate: company.nextBillingDate,
          planStartDate: company.planStartDate,
        },
        pendingChanges: company.pendingPlanChange
          ? {
              targetPlan: company.pendingPlanChange,
              effectiveDate: company.planChangeDate,
              reason: company.planChangeReason,
            }
          : null,
        features: {
          smsEnabled: company.smsEnabled,
          emailEnabled: company.emailEnabled,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching current plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Purchase AI credits
 * POST /api/billing/purchase-credits
 * Body: { amount: number } // Dollar amount
 */
export const buyCredits = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { amount } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a positive number',
      });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Calculate credits for display
    const creditsAmount = amount * 8;

    // Create Stripe checkout sessions
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await createCreditPurchaseCheckout(
      user.companyAdmin.id,
      amount,
      `${frontendUrl}/client/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${frontendUrl}/client/billing/cancel`
    );

    return res.status(200).json({
      success: true,
      message: `Redirecting to checkout for ${creditsAmount} credits`,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        creditsAmount,
        amount,
      },
    });
  } catch (error) {
    console.error('Error creating credit purchase checkout:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Upgrade to a new plan
 * POST /api/billing/upgrade
 * Body: { targetPlan: string, billingCycle: 'monthly' | 'yearly' }
 */
export const upgrade = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { targetPlan, billingCycle = 'monthly' } = req.body;

    console.log("=== Billing Upgrade Request ===");
    console.log("User ID (Clerk):", userId);
    console.log("Target Plan:", targetPlan);
    console.log("Billing Cycle:", billingCycle);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!targetPlan) {
      return res.status(400).json({
        error: 'Target plan required',
        message: 'Please specify which plan to upgrade to',
      });
    }

    // Get user and company
    console.log("Fetching user from database...");
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        companyAdmin: true,
        companyUser: true,
      },
    });

    console.log("User found:", {
      userId: user?.id,
      companyId: user?.companyId,
      hasCompanyAdmin: !!user?.companyAdmin,
      companyAdminId: user?.companyAdmin?.id,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Try to get company from admin relationship first, then from user relationship
    let company = user.companyAdmin;

    if (!company && user.companyId) {
      // If companyAdmin relation isn't populated yet, try direct lookup
      console.log('CompanyAdmin relation not found, trying direct lookup for companyId:', user.companyId);
      company = await prisma.company.findUnique({
        where: { id: user.companyId },
      });
    }

    if (!company) {
      console.error('No company found for user during upgrade:', {
        userId,
        companyAdmin: !!user.companyAdmin,
        companyId: user.companyId,
      });
      return res.status(404).json({
        error: 'Company not found',
        message: 'Please complete onboarding first or try refreshing the page',
      });
    }

    console.log('Found company for upgrade:', { companyId: company.id, currentPlan: company.plan });

    // Validate upgrade path
    const planTiers = ['Free', 'Starter', 'Professional', 'Enterprise'];
    const currentIndex = planTiers.indexOf(company.plan);
    const targetIndex = planTiers.indexOf(targetPlan);

    if (targetIndex === -1) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: `${targetPlan} is not a valid plan`,
      });
    }

    if (targetIndex <= currentIndex) {
      return res.status(400).json({
        error: 'Invalid upgrade',
        message: 'You can only upgrade to a higher tier. Use downgrade endpoint for downgrades.',
      });
    }

    // Enterprise requires custom pricing
    if (targetPlan === 'Enterprise') {
      return res.status(400).json({
        error: 'Contact sales',
        message: 'Enterprise plan requires custom pricing. Please contact our sales team.',
      });
    }

    // Create Stripe checkout session for subscription
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    console.log("Creating Stripe checkout session...");
    console.log("Success URL:", `${frontendUrl}/client/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    console.log("Cancel URL:", `${frontendUrl}/client/billing/cancel`);

    const session = await createSubscriptionCheckout(
      company.id,
      targetPlan,
      billingCycle,
      `${frontendUrl}/client/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${frontendUrl}/client/billing/cancel`
    );

    console.log("✅ Stripe checkout session created:", session.id);
    console.log("Checkout URL:", session.url);

    return res.status(200).json({
      success: true,
      message: `Redirecting to checkout for ${targetPlan} plan`,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        targetPlan,
        billingCycle,
      },
    });
  } catch (error) {
    console.error("❌ Error creating upgrade checkout:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({
      error: error.message || 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Downgrade to a lower plan
 * POST /api/billing/downgrade
 * Body: { targetPlan: string }
 */
export const downgrade = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { targetPlan } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!targetPlan) {
      return res.status(400).json({
        error: 'Target plan required',
        message: 'Please specify which plan to downgrade to',
      });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = user.companyAdmin;

    // Validate downgrade path
    const planTiers = ['Free', 'Starter', 'Professional', 'Enterprise'];
    const currentIndex = planTiers.indexOf(company.plan);
    const targetIndex = planTiers.indexOf(targetPlan);

    if (targetIndex === -1) {
      return res.status(400).json({
        error: 'Invalid plan',
        message: `${targetPlan} is not a valid plan`,
      });
    }

    if (targetIndex >= currentIndex) {
      return res.status(400).json({
        error: 'Invalid downgrade',
        message: 'You can only downgrade to a lower tier. Use upgrade endpoint for upgrades.',
      });
    }

    // Initiate downgrade (7-day grace period)
    const result = await initiatePlanDowngrade(company.id, targetPlan);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('Error downgrading plan:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Cancel pending downgrade
 * POST /api/billing/cancel-downgrade
 */
export const cancelDowngrade = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = user.companyAdmin;

    if (!company.pendingPlanChange) {
      return res.status(400).json({
        error: 'No pending downgrade',
        message: 'There is no scheduled downgrade to cancel',
      });
    }

    // Cancel pending downgrade
    await prisma.company.update({
      where: { id: company.id },
      data: {
        pendingPlanChange: null,
        planChangeDate: null,
        planChangeReason: null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Downgrade cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling downgrade:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get billing history
 * GET /api/billing/history
 */
export const getBillingHistory = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get billing history
    const history = await prisma.billingHistory.findMany({
      where: { companyId: user.companyAdmin.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 invoices
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching billing history:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get credit transaction history
 * GET /api/billing/credit-transactions
 */
export const getCreditTransactions = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get credit transactions
    const transactions = await prisma.creditTransaction.findMany({
      where: { companyId: user.companyAdmin.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    return res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching credit transactions:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Check if action is allowed (for frontend validation)
 * POST /api/billing/check-limit
 * Body: { limitType: string, context: object }
 */
export const checkActionLimit = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { limitType, context } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!limitType) {
      return res.status(400).json({
        error: 'Limit type required',
        message: 'Please specify limitType (drivers, documents, credits)',
      });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Check limit
    const result = await checkLimit(user.companyAdmin.id, limitType, context || {});

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking limit:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get Stripe billing portal URL
 * GET /api/billing/portal
 */
export const getBillingPortal = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = user.companyAdmin;

    if (!company.stripeCustomerId) {
      return res.status(400).json({
        error: 'No payment method',
        message: 'You must subscribe to a plan first to access the billing portal',
      });
    }

    // Create billing portal session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await createBillingPortalSession(
      company.stripeCustomerId,
      `${frontendUrl}/billing`
    );

    return res.status(200).json({
      success: true,
      data: {
        portalUrl: session.url,
      },
    });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
