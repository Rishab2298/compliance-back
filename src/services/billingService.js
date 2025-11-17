import prisma from '../../prisma/client.js';
import { getPlanLimits, isUnlimited, canDowngrade } from '../config/planLimits.js';

/**
 * Billing Service
 * Handles all billing-related operations including credits, plan changes, and limits
 */

/**
 * Deduct AI credits for document processing
 * @param {string} companyId - Company ID
 * @param {string} documentId - Document ID
 * @param {number} amount - Number of credits to deduct (default: 1)
 * @returns {Promise<object>} Transaction result
 */
async function deductCredits(companyId, documentId, amount = 1) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    // Check if Enterprise (unlimited)
    if (isUnlimited(company.plan, 'credits')) {
      return {
        success: true,
        unlimited: true,
        balance: -1,
        message: 'Unlimited credits (Enterprise plan)'
      }
    }

    // Check if enough credits
    if (company.aiCredits < amount) {
      return {
        success: false,
        insufficient: true,
        balance: company.aiCredits,
        required: amount,
        message: `Insufficient credits. Required: ${amount}, Available: ${company.aiCredits}`
      }
    }

    const balanceBefore = company.aiCredits
    const balanceAfter = balanceBefore - amount

    // Deduct credits and log transaction
    const [updatedCompany, transaction] = await prisma.$transaction([
      // Update company credits
      prisma.company.update({
        where: { id: companyId },
        data: {
          aiCredits: balanceAfter,
          monthlyCreditsUsed: { increment: amount },
          monthlyDocsProcessed: { increment: 1 }
        }
      }),

      // Create transaction record
      prisma.creditTransaction.create({
        data: {
          companyId,
          type: 'USED',
          amount: -amount, // Negative for deduction
          balanceBefore,
          balanceAfter,
          documentId,
          reason: `AI processing for document ${documentId}`
        }
      })
    ])

    console.log(`✅ Deducted ${amount} credit(s) for company ${companyId}. New balance: ${balanceAfter}`)

    return {
      success: true,
      balanceBefore,
      balanceAfter,
      transaction
    }
  } catch (error) {
    console.error('Error deducting credits:', error)
    throw error
  }
}

/**
 * Refill AI credits (monthly refill for paid plans)
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Refill result
 */
async function refillCredits(companyId) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    const planLimits = getPlanLimits(company.plan)

    // Free plan: No refill
    if (company.plan === 'Free') {
      return {
        success: false,
        message: 'Free plan does not get monthly refills'
      }
    }

    // Enterprise: No refill needed (unlimited)
    if (isUnlimited(company.plan, 'credits')) {
      return {
        success: true,
        unlimited: true,
        message: 'Enterprise plan has unlimited credits'
      }
    }

    const balanceBefore = company.aiCredits
    const refillAmount = planLimits.monthlyAICredits
    const balanceAfter = balanceBefore + refillAmount // Rollover: ADD to existing

    // Refill credits and log transaction
    const [updatedCompany, transaction] = await prisma.$transaction([
      // Update company credits
      prisma.company.update({
        where: { id: companyId },
        data: {
          aiCredits: balanceAfter,
          lastCreditRefillDate: new Date(),
          monthlyCreditsUsed: 0, // Reset monthly usage counter
          monthlyDocsProcessed: 0 // Reset monthly docs counter
        }
      }),

      // Create transaction record
      prisma.creditTransaction.create({
        data: {
          companyId,
          type: 'REFILL',
          amount: refillAmount,
          balanceBefore,
          balanceAfter,
          reason: `Monthly credit refill for ${company.plan} plan`
        }
      })
    ])

    console.log(`✅ Refilled ${refillAmount} credits for company ${companyId}. New balance: ${balanceAfter}`)

    return {
      success: true,
      refillAmount,
      balanceBefore,
      balanceAfter,
      transaction
    }
  } catch (error) {
    console.error('Error refilling credits:', error)
    throw error
  }
}

/**
 * Purchase additional credits
 * @param {string} companyId - Company ID
 * @param {number} dollarAmount - Dollar amount paid
 * @returns {Promise<object>} Purchase result
 */
async function purchaseCredits(companyId, dollarAmount) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    // Calculate credits: $1 = 8 credits
    const creditsToAdd = dollarAmount * 8
    const balanceBefore = company.aiCredits
    const balanceAfter = balanceBefore + creditsToAdd

    // Add credits and log transaction
    const [updatedCompany, transaction] = await prisma.$transaction([
      // Update company credits
      prisma.company.update({
        where: { id: companyId },
        data: {
          aiCredits: balanceAfter
        }
      }),

      // Create transaction record
      prisma.creditTransaction.create({
        data: {
          companyId,
          type: 'PURCHASE',
          amount: creditsToAdd,
          balanceBefore,
          balanceAfter,
          reason: `Purchased ${creditsToAdd} credits for $${dollarAmount}`,
          metadata: {
            dollarAmount,
            rate: 8, // Credits per dollar
          }
        }
      })
    ])

    console.log(`✅ Purchased ${creditsToAdd} credits for company ${companyId}. New balance: ${balanceAfter}`)

    return {
      success: true,
      creditsAdded: creditsToAdd,
      dollarAmount,
      balanceBefore,
      balanceAfter,
      transaction
    }
  } catch (error) {
    console.error('Error purchasing credits:', error)
    throw error
  }
}

/**
 * Check if company can perform an action based on plan limits
 * @param {string} companyId - Company ID
 * @param {string} limitType - Type of limit (drivers, documents, credits)
 * @param {object} context - Additional context (e.g., driverId for document check)
 * @returns {Promise<object>} Check result
 */
async function checkLimit(companyId, limitType, context = {}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        drivers: {
          include: {
            documents: true
          }
        }
      }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    const planLimits = getPlanLimits(company.plan)

    switch (limitType) {
      case 'drivers': {
        const currentDrivers = company.drivers.length
        const maxDrivers = planLimits.maxDrivers

        if (isUnlimited(company.plan, 'drivers')) {
          return { allowed: true, unlimited: true }
        }

        const allowed = currentDrivers < maxDrivers

        return {
          allowed,
          current: currentDrivers,
          limit: maxDrivers,
          remaining: maxDrivers - currentDrivers,
          message: allowed
            ? `You can add ${maxDrivers - currentDrivers} more driver(s)`
            : `Driver limit reached (${maxDrivers}/${maxDrivers}). Upgrade to add more.`
        }
      }

      case 'documents': {
        const { driverId } = context

        if (!driverId) {
          throw new Error('driverId required for document limit check')
        }

        const driver = company.drivers.find(d => d.id === driverId)

        if (!driver) {
          throw new Error('Driver not found')
        }

        const currentDocs = driver.documents.length
        const maxDocs = planLimits.maxDocumentsPerDriver

        if (isUnlimited(company.plan, 'documents')) {
          return { allowed: true, unlimited: true }
        }

        const allowed = currentDocs < maxDocs

        return {
          allowed,
          current: currentDocs,
          limit: maxDocs,
          remaining: maxDocs - currentDocs,
          message: allowed
            ? `This driver can have ${maxDocs - currentDocs} more document(s)`
            : `Document limit reached for this driver (${maxDocs}/${maxDocs}). Upgrade to add more.`
        }
      }

      case 'credits': {
        const { amount = 1 } = context

        if (isUnlimited(company.plan, 'credits')) {
          return { allowed: true, unlimited: true }
        }

        const allowed = company.aiCredits >= amount

        return {
          allowed,
          current: company.aiCredits,
          required: amount,
          message: allowed
            ? `You have ${company.aiCredits} credit(s) available`
            : `Insufficient credits. Required: ${amount}, Available: ${company.aiCredits}`
        }
      }

      default:
        throw new Error(`Unknown limit type: ${limitType}`)
    }
  } catch (error) {
    console.error('Error checking limit:', error)
    throw error
  }
}

/**
 * Upgrade company to a new plan
 * @param {string} companyId - Company ID
 * @param {string} newPlan - New plan name
 * @param {object} paymentInfo - Payment information (Stripe IDs, etc.)
 * @returns {Promise<object>} Upgrade result
 */
async function upgradePlan(companyId, newPlan, paymentInfo = {}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    const oldPlan = company.plan
    const oldLimits = getPlanLimits(oldPlan)
    const newLimits = getPlanLimits(newPlan)

    // Calculate new credit balance
    let newCreditBalance = company.aiCredits
    let creditsAdded = 0

    // If upgrading from Free plan
    if (oldPlan === 'Free') {
      // If user has exactly 5 credits (unused Free plan credits), REPLACE them with new plan's credits
      if (company.aiCredits === 5) {
        newCreditBalance = newLimits.initialAICredits
        creditsAdded = newLimits.initialAICredits
        console.log(`🔄 Replacing Free plan credits (5) with ${newPlan} plan credits (${newLimits.initialAICredits})`)
      } else {
        // If they've used some credits, ADD the new plan's credits to remaining balance
        newCreditBalance = company.aiCredits + newLimits.initialAICredits
        creditsAdded = newLimits.initialAICredits
        console.log(`➕ Adding ${newPlan} plan credits (${newLimits.initialAICredits}) to existing balance (${company.aiCredits})`)
      }
    } else {
      // For paid to paid upgrades, add new plan's monthly credits
      newCreditBalance = company.aiCredits + newLimits.monthlyAICredits
      creditsAdded = newLimits.monthlyAICredits
      console.log(`⬆️ Upgrading from ${oldPlan} to ${newPlan}, adding ${creditsAdded} credits`)
    }

    // Update company with new plan
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        plan: newPlan,
        aiCredits: newCreditBalance,
        planStartDate: new Date(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        smsEnabled: newLimits.features.sms,
        emailEnabled: newLimits.features.email,
        subscriptionStatus: 'ACTIVE',
        pendingPlanChange: null, // Clear pending change after successful upgrade
        planChangeDate: null,
        planChangeReason: null,
        ...paymentInfo, // stripeCustomerId, stripeSubscriptionId, etc.
      }
    })

    // Create credit transaction for upgrade bonus
    await prisma.creditTransaction.create({
      data: {
        companyId,
        type: 'BONUS',
        amount: creditsAdded,
        balanceBefore: company.aiCredits,
        balanceAfter: newCreditBalance,
        reason: `Plan upgrade from ${oldPlan} to ${newPlan}`,
        metadata: {
          oldPlan,
          newPlan,
          replacedFreeCredits: oldPlan === 'Free' && company.aiCredits === 5
        }
      }
    })

    console.log(`✅ Upgraded company ${companyId} from ${oldPlan} to ${newPlan}`)
    console.log(`💰 Credits: ${company.aiCredits} → ${newCreditBalance} (${creditsAdded >= 0 ? '+' : ''}${creditsAdded})`)

    return {
      success: true,
      oldPlan,
      newPlan,
      creditsAdded: creditsAdded,
      newBalance: newCreditBalance,
      company: updatedCompany
    }
  } catch (error) {
    console.error('Error upgrading plan:', error)
    throw error
  }
}

/**
 * Initiate plan downgrade (with grace period)
 * @param {string} companyId - Company ID
 * @param {string} newPlan - New plan name
 * @returns {Promise<object>} Downgrade result
 */
async function initiatePlanDowngrade(companyId, newPlan) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        drivers: {
          include: {
            documents: true
          }
        }
      }
    })

    if (!company) {
      throw new Error('Company not found')
    }

    // Calculate current usage
    const currentUsage = {
      driversCount: company.drivers.length,
      maxDocsPerDriver: Math.max(
        ...company.drivers.map(d => d.documents.length),
        0
      )
    }

    // Check if can downgrade
    const downgradeCheck = canDowngrade(currentUsage, newPlan)

    if (!downgradeCheck.canDowngrade) {
      return {
        success: false,
        canDowngrade: false,
        reasons: downgradeCheck.reasons,
        message: 'Cannot downgrade: current usage exceeds target plan limits'
      }
    }

    // Schedule downgrade for 7 days from now (grace period)
    const downgradeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        pendingPlanChange: newPlan,
        planChangeDate: downgradeDate,
        planChangeReason: 'User initiated downgrade'
      }
    })

    console.log(`📅 Scheduled downgrade for company ${companyId} from ${company.plan} to ${newPlan} on ${downgradeDate}`)

    return {
      success: true,
      canDowngrade: true,
      currentPlan: company.plan,
      targetPlan: newPlan,
      downgradeDate,
      gracePeriodDays: 7,
      message: `Downgrade scheduled for ${downgradeDate.toLocaleDateString()}. You have 7 days to adjust your usage.`
    }
  } catch (error) {
    console.error('Error initiating downgrade:', error)
    throw error
  }
}

/**
 * Execute pending plan downgrades (called by cron job)
 * @returns {Promise<object>} Execution result
 */
async function executePendingDowngrades() {
  try {
    const now = new Date()

    // Find companies with pending downgrades that are due
    const companies = await prisma.company.findMany({
      where: {
        pendingPlanChange: { not: null },
        planChangeDate: { lte: now }
      }
    })

    const results = []

    for (const company of companies) {
      try {
        const newPlan = company.pendingPlanChange
        const newLimits = getPlanLimits(newPlan)

        // Execute downgrade
        const updatedCompany = await prisma.company.update({
          where: { id: company.id },
          data: {
            plan: newPlan,
            aiCredits: newLimits.initialAICredits, // Reset to new plan's credits
            pendingPlanChange: null,
            planChangeDate: null,
            planChangeReason: null,
            planStartDate: new Date(),
            smsEnabled: newLimits.features.sms,
            emailEnabled: newLimits.features.email
          }
        })

        // Log transaction
        await prisma.creditTransaction.create({
          data: {
            companyId: company.id,
            type: 'ADJUSTMENT',
            amount: newLimits.initialAICredits - company.aiCredits,
            balanceBefore: company.aiCredits,
            balanceAfter: newLimits.initialAICredits,
            reason: `Plan downgrade from ${company.plan} to ${newPlan}`,
            metadata: {
              oldPlan: company.plan,
              newPlan
            }
          }
        })

        console.log(`✅ Executed downgrade for company ${company.id} from ${company.plan} to ${newPlan}`)

        results.push({
          companyId: company.id,
          success: true,
          oldPlan: company.plan,
          newPlan
        })
      } catch (error) {
        console.error(`Error downgrading company ${company.id}:`, error)
        results.push({
          companyId: company.id,
          success: false,
          error: error.message
        })
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    }
  } catch (error) {
    console.error('Error executing pending downgrades:', error)
    throw error
  }
}

export {
  deductCredits,
  refillCredits,
  purchaseCredits,
  checkLimit,
  upgradePlan,
  initiatePlanDowngrade,
  executePendingDowngrades,
};
