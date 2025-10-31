import express from "express";
import { clerkMiddleware, clerkClient } from "@clerk/express";
import { Webhook } from "svix";
import cors from "cors";
import "dotenv/config";

import userRoutes from "./routes/userRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import documentTypeRoutes from "./routes/documentTypeRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import driverInvitationRoutes from "./routes/driverInvitationRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import prisma from "../prisma/client.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { getAllUsers } from "./controllers/userController.js";
import companyRoutes from "./routes/compnayRoutes.js";
import { startReminderCronJob } from "./services/reminderCronService.js";
import { handleStripeWebhook } from "./controllers/stripeWebhookController.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// Special handling for webhooks - use raw body
app.use("/api/clerk-webhook", express.raw({ type: "application/json" }));
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));

// Regular JSON parsing for other routes
app.use(express.json());
app.use(clerkMiddleware());
// Sample route
app.get("/", (req, res) => {
  res.send("Compliance Backend is running");
});

// Clerk sends JSON

app.use("/api/users", authMiddleware, getAllUsers);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/document-types", authMiddleware, documentTypeRoutes);
app.use("/api/drivers", authMiddleware, driverRoutes);
app.use("/api/documents", authMiddleware, documentRoutes);

// Driver invitation routes (public routes for token-based access)
app.use("/api/driver-invitations", driverInvitationRoutes);

// Company routes
app.use("/api/company", companyRoutes);

// Reminder routes
app.use("/api/reminders", authMiddleware, reminderRoutes);

// Billing routes
app.use("/api/billing", authMiddleware, billingRoutes);

// Test routes (for debugging email/SMS)
app.use("/api/test", testRoutes);



// Webhook to handle Clerk events
app.post("/api/clerk-webhook", async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Get the headers
  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  // If there are no headers, return 400
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return res.status(400).json({ error: "Missing svix headers" });
  }

  // Get the raw body as string
  const payload = req.body.toString();

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let event;

  // Verify the webhook signature
  try {
    event = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle the webhook event
  try {
    // Only handle user creation
    if (event.type === "user.created") {
      const clerkUser = event.data;
      const email = clerkUser.email_addresses[0]?.email_address;

      if (!email) {
        console.error("User has no email address");
        // Still return 200 to acknowledge receipt
        return res.status(200).json({ received: true });
      }

      // Check for existing user by both clerkUserId and email
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { clerkUserId: clerkUser.id },
            { email: email }
          ]
        }
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            clerkUserId: clerkUser.id,
            email: email,
          },
        });
        await clerkClient.users.updateUserMetadata(clerkUser.id, {
          publicMetadata: {
            "role": "admin",
          },
        });
        console.log("New user created and added to database:", clerkUser.id);
      } else {
        console.log("User already exists, skipping creation:", clerkUser.id);
      }
    } else if (event.type === "user.deleted") {
      // Handle user deletion
      const clerkUser = event.data;

      const deletedUser = await prisma.user.delete({
        where: {
          clerkUserId: clerkUser.id,
        },
      }).catch(err => {
        console.log("User not found in database, already deleted:", clerkUser.id);
      });

      if (deletedUser) {
        console.log("User deleted from database:", clerkUser.id);
      }
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Still return 200 to prevent retries if it's a known error
    return res.status(200).json({ received: true, error: err.message });
  }
});

// Stripe Webhook to handle payment events
app.post("/api/stripe-webhook", handleStripeWebhook);

  if (process.env.NODE_ENV === 'production') {
    const privateKey = fs.readFileSync('/opt/bitnami/apache/htdocs/certs/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/opt/bitnami/apache/htdocs/certs/fullchain.pem', 'utf8');

    https.createServer({ key: privateKey, cert: certificate }, app).listen(443, () => {
      console.log("✅ Server running securely on port 443");
      startReminderCronJob();
    });
  } else {
    app.listen(5000, () => {
      console.log("✅ Server running on port 3000");
      startReminderCronJob();
    });
  }