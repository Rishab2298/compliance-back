import express from "express";
import { saveOnboarding, getOnboardingStatus } from "../controllers/onboardingController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/onboarding - Save onboarding data
router.post("/", authMiddleware, saveOnboarding);

// GET /api/onboarding/status - Get onboarding status
router.get("/status", authMiddleware, getOnboardingStatus);

export default router;
