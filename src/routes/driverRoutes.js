import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDocumentCounts,
  bulkImportDrivers,
} from "../controllers/driverController.js";
import { requireCapability } from "../middleware/dspPermissionMiddleware.js";

const router = express.Router();

/**
 * Driver Routes with DSP Permission Checks
 * All routes require authentication (handled by authMiddleware in server.js)
 */

// Bulk import drivers from CSV (requires create_edit_drivers capability)
router.post("/bulk-import", requireCapability("create_edit_drivers"), bulkImportDrivers);

// Create driver (requires create_edit_drivers capability)
router.post("/", requireCapability("create_edit_drivers"), createDriver);

// Get all drivers (requires create_edit_drivers capability to view)
router.get("/", requireCapability("create_edit_drivers"), getDrivers);

// Get document counts (requires create_edit_drivers capability)
router.get("/document-counts", requireCapability("create_edit_drivers"), getDocumentCounts);

// Get driver by ID (requires create_edit_drivers capability)
router.get("/:id", requireCapability("create_edit_drivers"), getDriverById);

// Update driver (requires create_edit_drivers capability)
router.put("/:id", requireCapability("create_edit_drivers"), updateDriver);

// Delete driver (requires delete_documents capability - stricter permission)
router.delete("/:id", requireCapability("delete_documents"), deleteDriver);

export default router;
