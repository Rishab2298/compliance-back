/**
 * Plan Limits Configuration
 * Defines the limits and features for each subscription tier
 */

const PLAN_LIMITS = {
  Free: {
    name: 'Free',
    price: 0,
    billingCycle: null,

    // Core Limits
    maxDrivers: 5,
    maxDocumentsPerDriver: 1,

    // AI Credits
    initialAICredits: 5, // One-time only
    monthlyAICredits: 0, // No monthly refill
    creditsRollover: false, // Free plan credits don't rollover

    // Features
    features: {
      email: true, // Basic email only
      sms: false,
      reminders: true, // Basic reminders via email
      advancedAnalytics: false,
      customIntegrations: false,
      sso: false,
      dedicatedSupport: false,
    },

    // Display Info
    description: 'Perfect for trying out Logilink',
    popular: false,
  },

  Starter: {
    name: 'Starter',
    price: 49,
    yearlyPrice: 470, // ~20% discount
    billingCycle: 'monthly',

    // Core Limits
    maxDrivers: 25,
    maxDocumentsPerDriver: 5,

    // AI Credits
    initialAICredits: 100,
    monthlyAICredits: 100,
    creditsRollover: true, // Credits roll over

    // Features
    features: {
      email: true,
      sms: false, // Email only
      reminders: true,
      advancedAnalytics: false,
      customIntegrations: false,
      sso: false,
      dedicatedSupport: false,
    },

    // Display Info
    description: 'For small fleets getting started',
    popular: false,
  },

  Professional: {
    name: 'Professional',
    price: 149,
    yearlyPrice: 1430, // ~20% discount
    billingCycle: 'monthly',

    // Core Limits
    maxDrivers: 100,
    maxDocumentsPerDriver: 10,

    // AI Credits
    initialAICredits: 500,
    monthlyAICredits: 500,
    creditsRollover: true, // Credits roll over

    // Features
    features: {
      email: true,
      sms: true, // Email + SMS
      reminders: true,
      advancedAnalytics: true,
      customIntegrations: false,
      sso: false,
      dedicatedSupport: false,
    },

    // Display Info
    description: 'For medium to large fleets',
    popular: true,
  },

  Enterprise: {
    name: 'Enterprise',
    price: null, // Custom pricing
    yearlyPrice: null,
    billingCycle: 'custom',

    // Core Limits
    maxDrivers: -1, // Unlimited
    maxDocumentsPerDriver: -1, // Unlimited

    // AI Credits
    initialAICredits: -1, // Unlimited
    monthlyAICredits: -1, // Unlimited
    creditsRollover: true, // Not applicable for unlimited

    // Features
    features: {
      email: true,
      sms: true,
      whatsapp: true, // Future feature
      reminders: true,
      advancedAnalytics: true,
      customIntegrations: true,
      sso: true,
      dedicatedSupport: true,
      multiLocation: true,
    },

    // Display Info
    description: 'For enterprise-scale operations',
    popular: false,
    isCustom: true,
  },
}

/**
 * Helper Functions
 */

/**
 * Get plan limits for a specific plan
 * @param {string} planName - Plan name (Free, Starter, Professional, Enterprise)
 * @returns {object} Plan limits and features
 */
function getPlanLimits(planName) {
  const plan = PLAN_LIMITS[planName]
  if (!plan) {
    console.warn(`Unknown plan: ${planName}, defaulting to Free`)
    return PLAN_LIMITS.Free
  }
  return plan
}

/**
 * Check if a plan has unlimited resources
 * @param {string} planName - Plan name
 * @param {string} resource - Resource type (drivers, documents, credits)
 * @returns {boolean}
 */
function isUnlimited(planName, resource) {
  const plan = getPlanLimits(planName)

  switch (resource) {
    case 'drivers':
      return plan.maxDrivers === -1
    case 'documents':
      return plan.maxDocumentsPerDriver === -1
    case 'credits':
      return plan.monthlyAICredits === -1
    default:
      return false
  }
}

/**
 * Check if a plan supports a feature
 * @param {string} planName - Plan name
 * @param {string} featureName - Feature name
 * @returns {boolean}
 */
function hasFeature(planName, featureName) {
  const plan = getPlanLimits(planName)
  return plan.features[featureName] === true
}

/**
 * Get the next tier plan
 * @param {string} currentPlan - Current plan name
 * @returns {string|null} Next plan name or null if already at highest
 */
function getNextTier(currentPlan) {
  const tiers = ['Free', 'Starter', 'Professional', 'Enterprise']
  const currentIndex = tiers.indexOf(currentPlan)

  if (currentIndex === -1 || currentIndex === tiers.length - 1) {
    return null
  }

  return tiers[currentIndex + 1]
}

/**
 * Get all available plans for display
 * @returns {array} Array of plan objects
 */
function getAllPlans() {
  return Object.values(PLAN_LIMITS)
}

/**
 * Check if user can downgrade to a plan based on current usage
 * @param {object} currentUsage - Current usage stats
 * @param {string} targetPlan - Target plan name
 * @returns {object} { canDowngrade: boolean, reasons: [] }
 */
function canDowngrade(currentUsage, targetPlan) {
  const targetLimits = getPlanLimits(targetPlan)
  const reasons = []

  // Check driver count
  if (currentUsage.driversCount > targetLimits.maxDrivers && targetLimits.maxDrivers !== -1) {
    reasons.push({
      resource: 'drivers',
      current: currentUsage.driversCount,
      limit: targetLimits.maxDrivers,
      message: `You have ${currentUsage.driversCount} drivers but ${targetPlan} allows only ${targetLimits.maxDrivers}`
    })
  }

  // Check documents per driver
  if (currentUsage.maxDocsPerDriver > targetLimits.maxDocumentsPerDriver && targetLimits.maxDocumentsPerDriver !== -1) {
    reasons.push({
      resource: 'documents',
      current: currentUsage.maxDocsPerDriver,
      limit: targetLimits.maxDocumentsPerDriver,
      message: `Some drivers have ${currentUsage.maxDocsPerDriver} documents but ${targetPlan} allows only ${targetLimits.maxDocumentsPerDriver} per driver`
    })
  }

  return {
    canDowngrade: reasons.length === 0,
    reasons
  }
}

/**
 * Calculate prorated amount for plan change
 * Note: Current policy is NO proration, immediate charge
 * @param {string} fromPlan - Current plan
 * @param {string} toPlan - Target plan
 * @param {Date} nextBillingDate - Next billing date
 * @returns {number} Prorated amount (currently returns full price)
 */
function calculateProratedAmount(fromPlan, toPlan, nextBillingDate) {
  const targetLimits = getPlanLimits(toPlan)

  // No proration - immediate upgrade with full price
  return targetLimits.price || 0
}

export {
  PLAN_LIMITS,
  getPlanLimits,
  isUnlimited,
  hasFeature,
  getNextTier,
  getAllPlans,
  canDowngrade,
  calculateProratedAmount,
};
