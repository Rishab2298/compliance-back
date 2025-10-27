import express from "express";
import {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deleteDriver,
  getDocumentCounts,
} from "../controllers/driverController.js";

const router = express.Router();

// All routes require authentication (handled by Clerk middleware)
router.post("/", createDriver);
router.get("/", getDrivers);
router.get("/document-counts", getDocumentCounts); // Must be before /:id
router.get("/:id", getDriverById);
router.put("/:id", updateDriver);
router.delete("/:id", deleteDriver);

export default router;
