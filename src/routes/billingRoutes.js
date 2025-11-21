import express from 'express';
import {
  getPlans,
  getCurrentPlan,
  buyCredits,
  upgrade,
  downgrade,
  cancelDowngrade,
  getBillingHistory,
  getCreditTransactions,
  checkActionLimit,
  getBillingPortal,
} from '../controllers/billingController.js';
import { requireCapability } from '../middleware/dspPermissionMiddleware.js';
import { requireMFA } from '../middleware/mfaMiddleware.js';

const router = express.Router();

/**
 * Billing & Plan Management Routes with DSP Permission Checks
 * All routes require authentication (handled by authMiddleware in server.js)
 * Billing operations require 'manage_billing' capability (ADMIN or BILLING role)
 *
 * NOTE: Some routes (plans, upgrade) do NOT require MFA to allow payment setup during onboarding
 * Other routes DO require MFA for security (history, portal, downgrade, etc.)
 */

// Get all available plans (NO MFA - needed during onboarding)
router.get('/plans', requireCapability("manage_billing"), getPlans);

// Get current plan and usage (NO MFA - needed during onboarding)
router.get('/current', requireCapability("manage_billing"), getCurrentPlan);

// Purchase AI credits (NO MFA - needed during onboarding)
router.post('/purchase-credits', requireCapability("manage_billing"), buyCredits);

// Upgrade plan (NO MFA - needed during onboarding)
router.post('/upgrade', requireCapability("manage_billing"), upgrade);

// Downgrade plan (REQUIRES MFA - sensitive operation)
router.post('/downgrade', requireMFA, requireCapability("manage_billing"), downgrade);

// Cancel pending downgrade (REQUIRES MFA - sensitive operation)
router.post('/cancel-downgrade', requireMFA, requireCapability("manage_billing"), cancelDowngrade);

// Get billing history (REQUIRES MFA - sensitive data)
router.get('/history', requireMFA, requireCapability("manage_billing"), getBillingHistory);

// Get credit transaction history (REQUIRES MFA - sensitive data)
router.get('/credit-transactions', requireMFA, requireCapability("manage_billing"), getCreditTransactions);

// Check if action is allowed (NO MFA - just a check)
router.post('/check-limit', requireCapability("manage_billing"), checkActionLimit);

// Get billing portal URL (REQUIRES MFA - sensitive operation)
router.get('/portal', requireMFA, requireCapability("manage_billing"), getBillingPortal);

export default router;
