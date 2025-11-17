import express from 'express';
import {
  getDashboardStats,
  getAllCompanies,
  getCompanyById,
  getAllUsers,
  getRecentActivity,
  getAIUsage,
  getSystemLogs,
  getConsentLogs,
  getAllBillingData
} from '../controllers/superAdminController.js';

const router = express.Router();

// Dashboard stats
router.get('/stats', getDashboardStats);

// Companies management
router.get('/companies', getAllCompanies);
router.get('/companies/:id', getCompanyById);

// Users management
router.get('/users', getAllUsers);

// Recent activity
router.get('/activity', getRecentActivity);

// AI Usage tracking
router.get('/ai-usage', getAIUsage);

// System logs
router.get('/logs', getSystemLogs);

// Consent logs
router.get('/consent-logs', getConsentLogs);

// Billing data
router.get('/billing', getAllBillingData);

export default router;
