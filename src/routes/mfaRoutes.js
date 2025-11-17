import express from "express";
import {
  setupTOTP,
  verifyAndEnableTOTP,
  verifyMFA,
  getMFAStatus,
  regenerateBackupCodes,
  disableMFA,
} from "../controllers/mfaController.js";

const router = express.Router();

// Get MFA status for current user
router.get("/status", getMFAStatus);

// Setup TOTP (generate QR code)
router.post("/setup/totp", setupTOTP);

// Verify TOTP and enable MFA
router.post("/verify/totp", verifyAndEnableTOTP);

// Verify MFA during login (TOTP or backup code)
router.post("/verify", verifyMFA);

// Regenerate backup codes
router.post("/backup-codes/regenerate", regenerateBackupCodes);

// Disable MFA
router.post("/disable", disableMFA);

export default router;
