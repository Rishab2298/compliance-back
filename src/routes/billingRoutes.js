import express from 'express';
import { clerkMiddleware, requireAuth } from '@clerk/express';
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

const router = express.Router();

// Apply Clerk auth middleware to all routes
router.use(clerkMiddleware());
router.use(requireAuth());

/**
 * Billing & Plan Management Routes
 */

// Get all available plans
router.get('/plans', getPlans);

// Get current plan and usage
router.get('/current', getCurrentPlan);

// Purchase AI credits
router.post('/purchase-credits', buyCredits);

// Upgrade plan
router.post('/upgrade', upgrade);

// Downgrade plan (schedules downgrade with grace period)
router.post('/downgrade', downgrade);

// Cancel pending downgrade
router.post('/cancel-downgrade', cancelDowngrade);

// Get billing history
router.get('/history', getBillingHistory);

// Get credit transaction history
router.get('/credit-transactions', getCreditTransactions);

// Check if action is allowed (for frontend validation)
router.post('/check-limit', checkActionLimit);

// Get billing portal URL
router.get('/portal', getBillingPortal);

export default router;
