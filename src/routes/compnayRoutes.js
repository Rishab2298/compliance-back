import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireCapability } from "../middleware/dspPermissionMiddleware.js";
import { getCompanyById, updateCompanyById } from "../controllers/companyController.js";

const companyRoutes = express.Router();

// ROUTE DEFINITIONS
companyRoutes.get("/:id", authMiddleware, getCompanyById);       // GET /api/company/:id
// Update company settings - requires access_settings capability (ADMIN only)
companyRoutes.put("/:id", requireCapability('access_settings'), updateCompanyById);    // PUT /api/company/:id

export default companyRoutes;
