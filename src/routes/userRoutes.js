import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireMFA } from "../middleware/mfaMiddleware.js";
import { getAllUsers, syncUser } from "../controllers/userController.js";

const userRoutes = express.Router();

// ROUTE DEFINITIONS
userRoutes.get("/", authMiddleware, requireMFA, getAllUsers);   // GET /api/users (requires MFA)
userRoutes.post("/sync", authMiddleware, syncUser); // POST /api/users/sync (NO MFA - needed during onboarding)
// userRoutes.get("/:id", requireAuth, getUserById); // GET /api/users/:id
// userRoutes.post("/", createUser);                 // POST /api/users
// userRoutes.put("/:id", updateUser);               // PUT /api/users/:id
// userRoutes.delete("/:id", deleteUser);            // DELETE /api/users/:id

export default userRoutes;
