// controllers/userController.js

import prisma from "../../prisma/client.js";


/**
 * User Controller
 * 
 * This file contains all controller functions for the User resource.
 * Each function's expected payload, params, and response are described in comments.
 */

//////////////////////////////////////////////
// getAllUsers
//////////////////////////////////////////////
/**
 * Method: GET
 * URL: /api/users
 * Params: none
 * Body: none
 * Response: 
 *   200: Array of user objects
 *   500: { error: "error message" }
 */
export const getAllUsers = async (req, res) => {

   try {
    const users = await prisma.user.findMany();
    res.json(users);
    console.log(users)
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////
// getUserById
//////////////////////////////////////////////
/**
 * Method: GET
 * URL: /api/users/:id
 * Params: 
 *   id: integer (user ID)
 * Body: none
 * Response:
 *   200: { id, name, email, createdAt, updatedAt }
 *   404: { message: "User not found" }
 *   500: { error: "error message" }
 */
export const getUserById = async (req, res) => {
  // TODO: Fetch user by ID
};

//////////////////////////////////////////////
// createUser
//////////////////////////////////////////////
/**
 * Method: POST
 * URL: /api/users
 * Params: none
 * Body: 
 *   {
 *     name: string,
 *     email: string
 *   }
 * Response:
 *   201: { id, name, email, createdAt, updatedAt }
 *   400: { error: "error message" }
 */
export const createUser = async (req, res) => {
  // TODO: Create a new user
};

//////////////////////////////////////////////
// updateUser
//////////////////////////////////////////////
/**
 * Method: PUT
 * URL: /api/users/:id
 * Params: 
 *   id: integer (user ID)
 * Body:
 *   {
 *     name?: string,
 *     email?: string
 *   }
 * Response:
 *   200: { id, name, email, updatedAt }
 *   400: { error: "error message" }
 *   404: { message: "User not found" }
 */
export const updateUser = async (req, res) => {
  // TODO: Update a user by ID
};

//////////////////////////////////////////////
// deleteUser
//////////////////////////////////////////////
/**
 * Method: DELETE
 * URL: /api/users/:id
 * Params:
 *   id: integer (user ID)
 * Body: none
 * Response:
 *   200: { message: "User deleted" }
 *   400: { error: "error message" }
 *   404: { message: "User not found" }
 */
export const deleteUser = async (req, res) => {
  // TODO: Delete user by ID
};

//////////////////////////////////////////////
// syncUser
//////////////////////////////////////////////
/**
 * Method: POST
 * URL: /api/users/sync
 * Params: none
 * Body: none (uses authenticated user from req.auth)
 * Response:
 *   200: { message: "User synced", user: {...} }
 *   201: { message: "User created", user: {...} }
 *   401: { error: "Unauthorized" }
 *   500: { error: "error message" }
 *
 * This endpoint syncs the authenticated Clerk user with the database.
 * If the user doesn't exist in the database, it creates them.
 */
export const syncUser = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user found" });
    }

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (user) {
      // User already exists
      return res.status(200).json({
        message: "User already synced",
        user,
      });
    }

    // User doesn't exist, create them
    // Get user details from Clerk (available from authMiddleware)
    const clerkUser = req.user;

    if (!clerkUser || !clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
      return res.status(400).json({ error: "Unable to get user email from Clerk" });
    }

    user = await prisma.user.create({
      data: {
        clerkUserId: userId,
        email: clerkUser.emailAddresses[0].emailAddress,
      },
    });

    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (err) {
    console.error("Sync user error:", err);
    res.status(500).json({ error: err.message });
  }
};
