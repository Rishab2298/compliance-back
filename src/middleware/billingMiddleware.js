import { getAuth } from "@clerk/express";
import * as billingService from '../services/billingService.js';
import { getNextTier, hasFeature } from '../config/planLimits.js';
import prisma from '../../prisma/client.js';

/**
 * Billing Middleware
 * Enforces plan limits before allowing actions
 */

/**
 * Check if company can add a driver
 */
async function checkDriverLimit(req, res, next) {
  try {
    // Get companyId from Clerk session claims
    const companyId = getAuth(req)?.sessionClaims?.metadata?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID not found in user metadata' })
    }

    const limitCheck = await billingService.checkLimit(companyId, 'drivers')

    if (!limitCheck.allowed) {
      const plan = getAuth(req)?.sessionClaims?.metadata?.plan || 'Free'
      const nextTier = getNextTier(plan)

      return res.status(403).json({
        error: 'Driver limit reached',
        message: limitCheck.message,
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgradeRequired: true,
        nextTier,
        errorCode: 'DRIVER_LIMIT_REACHED'
      })
    }

    // Store limit info in request for logging
    req.limitCheck = limitCheck
    next()
  } catch (error) {
    console.error('Error checking driver limit:', error)
    return res.status(500).json({ error: 'Error checking driver limit' })
  }
}

/**
 * Check if driver can have more documents
 */
async function checkDocumentLimit(req, res, next) {
  try {
    const companyId = getAuth(req)?.sessionClaims?.metadata?.companyId
    const driverId = req.params.driverId || req.body.driverId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID not found in user metadata' })
    }

    if (!driverId) {
      return res.status(400).json({ error: 'Driver ID required' })
    }

    const limitCheck = await billingService.checkLimit(companyId, 'documents', { driverId })

    if (!limitCheck.allowed) {
      const plan = getAuth(req)?.sessionClaims?.metadata?.plan || 'Free'
      const nextTier = getNextTier(plan)

      return res.status(403).json({
        error: 'Document limit reached',
        message: limitCheck.message,
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgradeRequired: true,
        nextTier,
        errorCode: 'DOCUMENT_LIMIT_REACHED'
      })
    }

    req.limitCheck = limitCheck
    next()
  } catch (error) {
    console.error('Error checking document limit:', error)
    return res.status(500).json({ error: 'Error checking document limit' })
  }
}

/**
 * Check if company has enough AI credits
 */
async function checkCredits(req, res, next) {
  try {
    const companyId = getAuth(req)?.sessionClaims?.metadata?.companyId
    const amount = req.body.creditsRequired || 1

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID not found in user metadata' })
    }

    const limitCheck = await billingService.checkLimit(companyId, 'credits', { amount })

    if (!limitCheck.allowed) {
      return res.status(402).json({
        error: 'Insufficient credits',
        message: limitCheck.message,
        current: limitCheck.current,
        required: limitCheck.required,
        purchaseCreditsRequired: true,
        creditPrice: {
          perCredit: 0.125, // $1 for 8 credits
          recommended: [
            { amount: 5, credits: 40 },
            { amount: 10, credits: 80 },
            { amount: 25, credits: 200 }
          ]
        },
        errorCode: 'INSUFFICIENT_CREDITS'
      })
    }

    req.limitCheck = limitCheck
    next()
  } catch (error) {
    console.error('Error checking credits:', error)
    return res.status(500).json({ error: 'Error checking credits' })
  }
}

/**
 * Check if plan supports a feature (e.g., SMS)
 */
function requiresFeature(featureName) {
  return async (req, res, next) => {
    try {
      const plan = getAuth(req)?.sessionClaims?.metadata?.plan || 'Free'

      if (!hasFeature(plan, featureName)) {
        const nextTier = getNextTier(plan)

        return res.status(403).json({
          error: 'Feature not available',
          message: `${featureName} is not available on your current plan`,
          currentPlan: plan,
          upgradeRequired: true,
          nextTier,
          errorCode: 'FEATURE_NOT_AVAILABLE'
        })
      }

      next()
    } catch (error) {
      console.error('Error checking feature access:', error)
      return res.status(500).json({ error: 'Error checking feature access' })
    }
  }
}

/**
 * Attach company billing info to request
 */
async function attachBillingInfo(req, res, next) {
  try {
    const companyId = getAuth(req)?.sessionClaims?.metadata?.companyId

    if (!companyId) {
      return next()
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        plan: true,
        aiCredits: true,
        smsEnabled: true,
        emailEnabled: true,
        subscriptionStatus: true,
        nextBillingDate: true,
        pendingPlanChange: true,
        planChangeDate: true
      }
    })

    if (company) {
      req.billing = {
        plan: company.plan,
        credits: company.aiCredits,
        smsEnabled: company.smsEnabled,
        emailEnabled: company.emailEnabled,
        subscriptionStatus: company.subscriptionStatus,
        nextBillingDate: company.nextBillingDate,
        pendingDowngrade: company.pendingPlanChange ? {
          targetPlan: company.pendingPlanChange,
          effectiveDate: company.planChangeDate
        } : null
      }
    }

    next()
  } catch (error) {
    console.error('Error attaching billing info:', error)
    // Don't block the request, just log the error
    next()
  }
}

/**
 * Check if subscription is active
 */
async function requireActiveSubscription(req, res, next) {
  try {
    const companyId = getAuth(req)?.sessionClaims?.metadata?.companyId

    if (!companyId) {
      return res.status(401).json({ error: 'Company ID not found' })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionStatus: true, plan: true }
    })

    if (!company) {
      return res.status(404).json({ error: 'Company not found' })
    }

    // Free plan doesn't need active subscription
    if (company.plan === 'Free') {
      return next()
    }

    // Check if subscription is active
    if (company.subscriptionStatus === 'PAST_DUE') {
      return res.status(402).json({
        error: 'Payment required',
        message: 'Your subscription payment is past due. Please update your payment method.',
        subscriptionStatus: company.subscriptionStatus,
        errorCode: 'PAYMENT_PAST_DUE'
      })
    }

    if (company.subscriptionStatus === 'CANCELED') {
      return res.status(403).json({
        error: 'Subscription canceled',
        message: 'Your subscription has been canceled. Please reactivate to continue.',
        subscriptionStatus: company.subscriptionStatus,
        errorCode: 'SUBSCRIPTION_CANCELED'
      })
    }

    next()
  } catch (error) {
    console.error('Error checking subscription status:', error)
    return res.status(500).json({ error: 'Error checking subscription status' })
  }
}

export {
  checkDriverLimit,
  checkDocumentLimit,
  checkCredits,
  requiresFeature,
  attachBillingInfo,
  requireActiveSubscription,
};
