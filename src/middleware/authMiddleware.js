import { clerkClient } from "@clerk/express";

export const authMiddleware = async (req, res, next) => {
  try {
    // req.auth is set by clerkMiddleware()
    const auth = req.auth;

    if (!auth || !auth.userId) {
      console.error("No auth or userId found");
      return res.status(401).json({ message: "Unauthorized - No valid session" });
    }

    // Optionally fetch full user details from Clerk
    const user = await clerkClient.users.getUser(auth.userId);
    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
