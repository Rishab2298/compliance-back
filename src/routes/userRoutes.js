import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { syncUser } from "../controllers/userController.js";

const userRoutes = express.Router();

// ROUTE DEFINITIONS
userRoutes.post("/sync", authMiddleware, syncUser); // POST /api/users/sync (NO MFA - needed during onboarding)
// userRoutes.get("/:id", requireAuth, getUserById); // GET /api/users/:id
// userRoutes.post("/", createUser);                 // POST /api/users
// userRoutes.put("/:id", updateUser);               // PUT /api/users/:id
// userRoutes.delete("/:id", deleteUser);            // DELETE /api/users/:id

export default userRoutes;
