import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { getCompanyById, updateCompanyById } from "../controllers/companyController.js";

const companyRoutes = express.Router();

// ROUTE DEFINITIONS
companyRoutes.get("/:id", authMiddleware, getCompanyById);       // GET /api/company/:id
companyRoutes.put("/:id", authMiddleware, updateCompanyById);    // PUT /api/company/:id

export default companyRoutes;
