import express from "express";
import { clerkMiddleware, clerkClient } from "@clerk/express";
import { Webhook } from "svix";
import cors from "cors";
import helmet from "helmet";
import https from "https";
import fs from "fs";
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
import dashboardRoutes from "./routes/dashboardRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import mfaRoutes from "./routes/mfaRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import systemMetricsRoutes from "./routes/systemMetricsRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import errorLogRoutes from "./routes/errorLogRoutes.js";
import securityLogRoutes from "./routes/securityLogRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import prisma from "../prisma/client.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import { superAdminMiddleware } from "./middleware/superAdminMiddleware.js";
import { requirePolicyAcceptance } from "./middleware/policyAcceptanceMiddleware.js";
import { metricsMiddleware } from "./middleware/metricsMiddleware.js";
import { requireMFA } from "./middleware/mfaMiddleware.js";
import { initializeErrorTracking, errorHandlerMiddleware } from "./services/errorTracker.js";
import companyRoutes from "./routes/compnayRoutes.js";
import { startReminderCronJob, stopReminderCronJob } from "./services/reminderCronService.js";
import { handleStripeWebhook } from "./controllers/stripeWebhookController.js";
import { healthCheck } from "./controllers/systemMetricsController.js";

const app = express();

// Trust proxy - required for rate limiting and req.ip to work correctly
// Set to 1 to trust only the first proxy (Apache/nginx on same server)
// This prevents IP spoofing while allowing proper IP detection
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Security headers middleware
app.use(
  helmet({
    // Content Security Policy - controls what resources can be loaded
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://*.clerk.accounts.dev", // Clerk authentication
          "https://challenges.cloudflare.com", // Cloudflare captcha if used
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for dynamic styles in React
          "https://*.clerk.accounts.dev",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "https://*.s3.amazonaws.com", // AWS S3 images
          "https://*.s3.*.amazonaws.com",
          "https://*.cloudinary.com", // Cloudinary images
          "https://img.clerk.com", // Clerk user avatars
        ],
        connectSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://api.clerk.com",
          "https://clerk.com",
          "https://*.amazonaws.com", // AWS services
          "https://api.stripe.com", // Stripe payments
          "https://*.stripe.com",
          "https://api.openai.com", // OpenAI API
          "https://api.twilio.com", // Twilio SMS
          "https://*.twilio.com",
          "http://ip-api.com", // GeoIP lookup
          "https://api.cloudinary.com",
          process.env.FRONTEND_URL || "http://localhost:5173",
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        frameSrc: [
          "'self'",
          "https://*.stripe.com", // Stripe checkout/payment frames
          "https://js.stripe.com",
          "https://*.clerk.accounts.dev",
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https://*.s3.amazonaws.com"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    // HTTP Strict Transport Security - force HTTPS
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    frameguard: {
      action: "deny", // Don't allow any framing of your site
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // Disable DNS prefetching
    dnsPrefetchControl: {
      allow: false,
    },
    // Referrer policy
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    // Permissions policy - disable unnecessary browser features
    permissionsPolicy: {
      features: {
        camera: ["'none'"],
        microphone: ["'none'"],
        geolocation: ["'none'"],
        payment: ["'self'", "https://*.stripe.com"], // Allow Stripe payments
      },
    },
  })
);

// Special handling for webhooks - use raw body
app.use("/api/clerk-webhook", express.raw({ type: "application/json" }));
app.use("/api/stripe-webhook", express.raw({ type: "application/json" }));

// Regular JSON parsing for other routes
app.use(express.json());
app.use(clerkMiddleware());

// Initialize error tracking for uncaught exceptions and unhandled rejections
initializeErrorTracking();

// Add metrics tracking middleware (tracks response times, errors, etc.)
app.use(metricsMiddleware);

// Sample route
app.get("/", (req, res) => {
  res.send("Compliance Backend is running");
});

// Public health check endpoint
app.get("/api/health", healthCheck);

// Clerk sends JSON

// User routes (MFA selectively applied per route in userRoutes.js)
app.use("/api/users", userRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/document-types", authMiddleware, requireMFA, requirePolicyAcceptance, documentTypeRoutes);
app.use("/api/drivers", authMiddleware, requireMFA, requirePolicyAcceptance, driverRoutes);
app.use("/api/documents", authMiddleware, requireMFA, requirePolicyAcceptance, documentRoutes);

// Driver invitation routes (public routes for token-based access)
app.use("/api/driver-invitations", driverInvitationRoutes);

// Company routes
app.use("/api/company", authMiddleware, requireMFA, companyRoutes);

// Reminder routes
app.use("/api/reminders", authMiddleware, requireMFA, requirePolicyAcceptance, reminderRoutes);

// Billing routes (MFA selectively applied per route in billingRoutes.js - some routes need to work during onboarding)
app.use("/api/billing", authMiddleware, requirePolicyAcceptance, billingRoutes);

// Dashboard routes
app.use("/api/dashboard", authMiddleware, requireMFA, requirePolicyAcceptance, dashboardRoutes);

// Super Admin routes (protected by both auth and super admin middleware)
app.use("/api/super-admin", authMiddleware, requireMFA, superAdminMiddleware, superAdminRoutes);

// System Metrics routes (protected by super admin middleware)
app.use("/api/super-admin/system-metrics", authMiddleware, requireMFA, superAdminMiddleware, systemMetricsRoutes);

// Test routes (for debugging email/SMS)
app.use("/api/test", testRoutes);

// MFA routes (protected by auth middleware, NO policy check - MFA comes before policies)
app.use("/api/mfa", authMiddleware, mfaRoutes);

// Policy routes (public endpoints + acceptance endpoints, NO policy check)
app.use("/api/policies", policyRoutes);

// Team management routes (protected by auth + MFA + DSP permissions + policies)
app.use("/api/team", authMiddleware, requireMFA, requirePolicyAcceptance, teamRoutes);

// Audit log routes (protected by auth + MFA + DSP permissions + policies)
app.use("/api/audit-logs", authMiddleware, requireMFA, requirePolicyAcceptance, auditLogRoutes);

// Security log routes (protected by auth + MFA + admin permissions + policies)
app.use("/api/security-logs", authMiddleware, requireMFA, requirePolicyAcceptance, securityLogRoutes);

// Settings routes (protected by auth + MFA + policies)
app.use("/api/settings", authMiddleware, requireMFA, requirePolicyAcceptance, settingsRoutes);

// Error logging routes (public endpoint for frontend error boundary)
app.use("/api/log-error", errorLogRoutes);

// Ticket routes (protected by auth + MFA + policies)
app.use("/api/tickets", authMiddleware, requireMFA, requirePolicyAcceptance, ticketRoutes);

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
    // Handle user creation (organic signups only - invited users are created directly)
    if (event.type === "user.created") {
      const clerkUser = event.data;
      const email = clerkUser.email_addresses[0]?.email_address;

      if (!email) {
        console.error("User has no email address");
        // Still return 200 to acknowledge receipt
        return res.status(200).json({ received: true });
      }

      console.log("📧 Processing user.created event for:", email);

      // Fetch complete user details from Clerk to ensure we have firstName and lastName
      let fullUserData;
      try {
        fullUserData = await clerkClient.users.getUser(clerkUser.id);
        console.log("✅ Fetched user details from Clerk:", {
          id: fullUserData.id,
          firstName: fullUserData.firstName,
          lastName: fullUserData.lastName,
          email: email
        });
      } catch (error) {
        console.error("❌ Error fetching user from Clerk:", error);
        fullUserData = clerkUser; // Fallback to webhook data
      }

      // Extract name data with fallbacks
      const firstName = fullUserData.firstName || clerkUser.first_name || null;
      const lastName = fullUserData.lastName || clerkUser.last_name || null;

      // Check if user already exists in database
      const existingUser = await prisma.user.findUnique({
        where: { clerkUserId: clerkUser.id }
      });

      if (existingUser) {
        // User already exists (invited user who already has Clerk account)
        // Just update their name if it changed
        console.log("✅ User already exists in database (invited user):", email);

        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName: firstName || existingUser.firstName,
            lastName: lastName || existingUser.lastName,
          },
        });
      } else {
        // ✅ NEW ORGANIC SIGNUP - User not invited, signing up on their own
        console.log("➕ Creating new user (organic signup):", email);
        console.log("   First Name:", firstName);
        console.log("   Last Name:", lastName);

        await prisma.user.create({
          data: {
            clerkUserId: clerkUser.id,
            email: email,
            firstName: firstName,
            lastName: lastName,
            role: 'ADMIN', // Default role for new signups
            dspRole: 'ADMIN', // Default DSP role for company admins
            // No companyId - they need to complete onboarding
          },
        });

        await clerkClient.users.updateUserMetadata(clerkUser.id, {
          publicMetadata: {
            role: "ADMIN",
            dspRole: "ADMIN",
          },
        });

        console.log("✅ New user created successfully:", email);
      }
    } else if (event.type === "user.deleted") {
      // Handle user deletion
      const clerkUser = event.data;
      console.log("Processing user deletion for:", clerkUser.id);

      try {
        // First, find the user to check if they exist and have a company
        const user = await prisma.user.findUnique({
          where: { clerkUserId: clerkUser.id },
          include: { companyAdmin: true },
        });

        if (!user) {
          console.log("User not found in database, already deleted:", clerkUser.id);
          return res.status(200).json({ received: true });
        }

        console.log("User found in database:", {
          userId: user.id,
          email: user.email,
          hasCompany: !!user.companyAdmin,
          companyId: user.companyAdmin?.id
        });

        // If user is a company admin, delete the company first (cascade)
        if (user.companyAdmin) {
          console.log("User is a company admin, deleting company first:", user.companyAdmin.id);

          // Delete all related data in correct order
          // 1. Delete document reminders first (they reference documents)
          await prisma.documentReminder.deleteMany({
            where: {
              document: {
                driver: {
                  companyId: user.companyAdmin.id,
                },
              },
            },
          });
          console.log("Deleted all document reminders for company");

          // 2. Delete driver invitations
          await prisma.driverInvitation.deleteMany({
            where: {
              driver: {
                companyId: user.companyAdmin.id,
              },
            },
          });
          console.log("Deleted all driver invitations for company");

          // 3. Delete documents
          await prisma.document.deleteMany({
            where: {
              driver: {
                companyId: user.companyAdmin.id,
              },
            },
          });
          console.log("Deleted all documents for company");

          // 4. Delete drivers
          await prisma.driver.deleteMany({
            where: { companyId: user.companyAdmin.id },
          });
          console.log("Deleted all drivers for company");

          // 5. Delete reminders
          await prisma.reminder.deleteMany({
            where: { companyId: user.companyAdmin.id },
          });
          console.log("Deleted all reminders for company");

          // 6. Delete custom reminders
          await prisma.customReminder.deleteMany({
            where: { companyId: user.companyAdmin.id },
          });
          console.log("Deleted all custom reminders for company");

          // 7. Delete billing history
          await prisma.billingHistory.deleteMany({
            where: { companyId: user.companyAdmin.id },
          });
          console.log("Deleted billing history for company");

          // 8. Delete credit transactions
          await prisma.creditTransaction.deleteMany({
            where: { companyId: user.companyAdmin.id },
          });
          console.log("Deleted credit transactions for company");

          // 9. Update any other users who were part of this company
          await prisma.user.updateMany({
            where: { companyId: user.companyAdmin.id },
            data: { companyId: null },
          });
          console.log("Unlinked other users from company");

          // 10. Finally, delete the company
          await prisma.company.delete({
            where: { id: user.companyAdmin.id },
          });
          console.log("Deleted company:", user.companyAdmin.id);
        }

        // Finally, delete the user
        await prisma.user.delete({
          where: { clerkUserId: clerkUser.id },
        });
        console.log("✅ User and all related data deleted successfully:", clerkUser.id);

      } catch (err) {
        console.error("❌ Error deleting user:", {
          clerkUserId: clerkUser.id,
          error: err.message,
          code: err.code,
          stack: err.stack,
        });
        // Still return 200 to acknowledge receipt
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

// Error handling middleware (must be last)
app.use(errorHandlerMiddleware);

// Store server instance for graceful shutdown
let server;

if (process.env.NODE_ENV === 'production') {
  const privateKey = fs.readFileSync('/opt/bitnami/apache/htdocs/certs/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/opt/bitnami/apache/htdocs/certs/fullchain.pem', 'utf8');

  server = https.createServer({ key: privateKey, cert: certificate }, app).listen(443, () => {
    console.log("✅ Server running securely on port 443");
    startReminderCronJob();
  });
} else {
  server = app.listen(5003, () => {
    console.log("✅ Server running on port 5003");
    startReminderCronJob();
  });
}

/**
 * Graceful shutdown handler
 * Ensures all resources are properly cleaned up on SIGTERM/SIGINT
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('✅ Server closed - no longer accepting connections');
  });

  try {
    // Stop cron jobs
    stopReminderCronJob();

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected');

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));