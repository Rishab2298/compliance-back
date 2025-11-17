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

const router = express.Router();

/**
 * Billing & Plan Management Routes with DSP Permission Checks
 * All routes require authentication (handled by authMiddleware in server.js)
 * Billing operations require 'manage_billing' capability (ADMIN or BILLING role)
 */

// Get all available plans (requires manage_billing)
router.get('/plans', requireCapability("manage_billing"), getPlans);

// Get current plan and usage (requires manage_billing)
router.get('/current', requireCapability("manage_billing"), getCurrentPlan);

// Purchase AI credits (requires manage_billing)
router.post('/purchase-credits', requireCapability("manage_billing"), buyCredits);

// Upgrade plan (requires manage_billing)
router.post('/upgrade', requireCapability("manage_billing"), upgrade);

// Downgrade plan (requires manage_billing)
router.post('/downgrade', requireCapability("manage_billing"), downgrade);

// Cancel pending downgrade (requires manage_billing)
router.post('/cancel-downgrade', requireCapability("manage_billing"), cancelDowngrade);

// Get billing history (requires manage_billing)
router.get('/history', requireCapability("manage_billing"), getBillingHistory);

// Get credit transaction history (requires manage_billing)
router.get('/credit-transactions', requireCapability("manage_billing"), getCreditTransactions);

// Check if action is allowed (requires manage_billing)
router.post('/check-limit', requireCapability("manage_billing"), checkActionLimit);

// Get billing portal URL (requires manage_billing)
router.get('/portal', requireCapability("manage_billing"), getBillingPortal);

export default router;
