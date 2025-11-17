import { clerkClient } from "@clerk/express";
import prisma from "../../prisma/client.js";
import { onboardingSchema } from "../schemas/onboardingSchema.js";
import { getIPAddress, getRegionFromIP } from "../utils/geoip.js";
import crypto from "crypto";

/**
 * Helper function to create policy acceptance records for admin users during onboarding
 * This ensures admins have proper consent logs just like team members
 */
const logPolicyAcceptances = async (userId, companyId, userEmail, req) => {
  try {
    console.log("=== Logging Policy Acceptances for Admin ===");

    // Get IP address, region, and user agent for consent logging
    const ipAddress = getIPAddress(req);
    const region = await getRegionFromIP(ipAddress);
    const userAgent = req.headers["user-agent"];

    console.log("Consent metadata:", { ipAddress, region, userAgent: userAgent?.substring(0, 50) });

    // Get all latest published policies
    const policyTypes = [
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
      'DATA_PROCESSING_AGREEMENT',
      'SMS_CONSENT',
      'COOKIE_PREFERENCES',
      'SUPPORT_ACCESS',
    ];

    const policies = await prisma.policy.findMany({
      where: {
        type: { in: policyTypes },
        isPublished: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      distinct: ['type'],
    });

    console.log(`Found ${policies.length} published policies to accept`);

    if (policies.length === 0) {
      console.warn("⚠️  No published policies found. Skipping consent logging.");
      return { success: false, message: "No published policies found" };
    }

    // Create acceptance records with full consent logging
    const acceptances = await Promise.all(
      policies.map(async (policy) => {
        // Generate SHA-256 hash of policy content
        const contentHash = crypto.createHash('sha256').update(policy.content).digest('hex');

        console.log(`Creating acceptance for ${policy.type} v${policy.version}`);

        return prisma.userPolicyAcceptance.upsert({
          where: {
            userId_policyId: {
              userId: userId,
              policyId: policy.id,
            },
          },
          create: {
            userId: userId,
            policyId: policy.id,
            policyType: policy.type,
            policyVersion: policy.version,
            contentHash,
            ipAddress,
            region,
            userAgent,
            userEmail,
            companyId: companyId,
            isMandatory: true,
          },
          update: {
            acceptedAt: new Date(),
            contentHash,
            ipAddress,
            region,
            userAgent,
            userEmail,
          },
        });
      })
    );

    console.log(`✅ Created ${acceptances.length} policy acceptance records`);

    return {
      success: true,
      acceptedCount: acceptances.length,
      policies: policies.map(p => ({ type: p.type, version: p.version }))
    };
  } catch (error) {
    console.error("❌ Error logging policy acceptances:", error);
    throw error;
  }
};

export const saveOnboarding = async (req, res) => {
  try {
    console.log("=== Onboarding Request Received ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User ID from auth:", req.auth?.userId);

    // Validate request body
    const validatedData = onboardingSchema.parse(req.body);
    console.log("Validation passed. Validated data:", JSON.stringify(validatedData, null, 2));

    // Log consent data (TODO: Store in separate CompanyConsents table)
    if (validatedData.agreeToTerms || validatedData.agreeToPrivacy) {
      console.log("=== Legal Consents Captured ===");
      console.log("Terms of Service:", validatedData.agreeToTerms);
      console.log("Privacy Policy:", validatedData.agreeToPrivacy);
      console.log("Data Processing (DSP):", validatedData.agreeToDataProcessing);
      console.log("SMS Consent:", validatedData.agreeToSmsConsent);
      console.log("Support Access:", validatedData.agreeToSupportAccess);
      console.log("Consent Timestamp:", validatedData.consentTimestamp);
      console.log("Consent IP:", validatedData.consentIpAddress);
      console.log("Consent Version:", validatedData.consentVersion);
      // TODO: Create CompanyConsents table to store this data permanently
    }

    // Get the authenticated user from Clerk middleware
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user found" });
    }

    console.log("Processing onboarding for userId:", userId);

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });
    console.log("User found in database:", user ? `ID: ${user.id}` : "NOT FOUND");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the user already has a company
    console.log("Checking for existing company with adminUserId:", user.id);
    const existingCompany = await prisma.company.findUnique({
      where: { adminUserId: user.id },
    });
    console.log("Existing company:", existingCompany ? `Found - ID: ${existingCompany.id}` : "None");

    if (existingCompany) {
      // Update existing company with onboarding data
      // IMPORTANT: Plan remains 'Free' until payment is confirmed via Stripe webhook
      // The intended paid plan is stored in pendingPlanChange for tracking
      const updatedCompany = await prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          name: validatedData.legalCompanyName,
          plan: 'Free', // Always Free until payment confirmed
          aiCredits: 5, // Free plan starts with 5 credits
          pendingPlanChange: validatedData.plan !== 'Free' ? validatedData.plan : null, // Track intended upgrade
          companySize: validatedData.companySize || null,
          operatingRegion: validatedData.country,
          statesProvinces: validatedData.statesProvinces || [],
          industryType: validatedData.industryType || null,
          documentTypes: validatedData.documents || ["Driver's License"],
          reminderDays: validatedData.reminderDays || ["90d", "30d", "7d"],
          notificationMethod: 'email', // Always email until payment confirmed
          notificationRecipients: [validatedData.adminEmail],
          adminEmail: validatedData.adminEmail || null,
          adminPhone: validatedData.adminPhone || null,
          onboardingCompleted: true,
          smsEnabled: false, // Will be enabled after payment for paid plans
          emailEnabled: true,
          subscriptionStatus: validatedData.plan === 'Free' ? "ACTIVE" : "INCOMPLETE",
          planStartDate: validatedData.plan === 'Free' ? new Date() : null,

          // Extended Company Information
          legalCompanyName: validatedData.legalCompanyName || null,
          operatingName: validatedData.operatingName || null,
          country: validatedData.country || null,
          entityType: validatedData.entityType || null,
          businessRegistrationNumber: validatedData.businessRegistrationNumber || null,
          registeredAddress: validatedData.registeredAddress || null,
          operatingAddresses: validatedData.operatingAddresses || null,
          companyWebsite: validatedData.companyWebsite || null,
          adminFullName: validatedData.adminFullName || null,

          // DSP Specific Information
          isAmazonDSP: validatedData.isAmazonDSP || false,
          dspCompanyName: validatedData.dspCompanyName || null,
          stationCodes: validatedData.stationCodes || [],
          dspOwnerName: validatedData.dspOwnerName || null,
          opsManagerName: validatedData.opsManagerName || null,
          dspId: validatedData.dspId || null,

          // Billing Contact Information
          paymentMethod: validatedData.paymentMethod || null,
          billingContactName: validatedData.billingContactName || null,
          billingContactEmail: validatedData.billingContactEmail || null,
          billingAddress: validatedData.billingAddress || null,
        },
      });

      // Get user email from Clerk for consent logging
      const clerkUser = await clerkClient.users.getUser(userId);
      const userEmail = clerkUser.emailAddresses[0]?.emailAddress || validatedData.adminEmail;

      // Log policy acceptances with full consent metadata
      try {
        const consentResult = await logPolicyAcceptances(
          user.id,
          updatedCompany.id,
          userEmail,
          req
        );
        console.log("Policy acceptance logging result:", consentResult);
      } catch (consentError) {
        console.error("Failed to log policy acceptances:", consentError);
        // Don't fail onboarding if consent logging fails, but log the error
      }

      // Update user's policy acceptance status
      await prisma.user.update({
        where: { id: user.id },
        data: {
          policiesAccepted: true, // Admin accepted policies during onboarding
          policiesAcceptedAt: new Date(),
        },
      });

      // Sync companyId to Clerk metadata (preserve existing role/dspRole)
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          companyId: updatedCompany.id,
        },
      });

      return res.status(200).json({
        message: "Onboarding completed successfully",
        company: updatedCompany,
      });
    } else {
      // Create new company with onboarding data
      console.log("Creating new company for user:", user.id);
      console.log("Company data to create:", {
        name: validatedData.legalCompanyName,
        adminUserId: user.id,
        plan: validatedData.plan,
        companySize: validatedData.companySize || null,
        operatingRegion: validatedData.country,
        statesProvinces: validatedData.statesProvinces || [],
        industryType: validatedData.industryType || null,
        documentTypes: validatedData.documents || ["Driver's License"],
        reminderDays: validatedData.reminderDays || ["90d", "30d", "7d"],
      });

      // IMPORTANT: All companies start as Free plan with 5 credits during onboarding
      // For paid plans, the actual upgrade happens AFTER payment confirmation via Stripe webhook
      // The intended paid plan is stored in pendingPlanChange for tracking purposes

      const newCompany = await prisma.company.create({
        data: {
          name: validatedData.legalCompanyName,
          adminUserId: user.id,
          plan: 'Free', // Always Free until payment confirmed
          aiCredits: 5, // Free plan starts with 5 credits
          pendingPlanChange: validatedData.plan !== 'Free' ? validatedData.plan : null, // Track intended upgrade
          companySize: validatedData.companySize || null,
          operatingRegion: validatedData.country,
          statesProvinces: validatedData.statesProvinces || [],
          industryType: validatedData.industryType || null,
          documentTypes: validatedData.documents || ["Driver's License"],
          reminderDays: validatedData.reminderDays || ["90d", "30d", "7d"],
          notificationMethod: 'email', // Always email until payment confirmed
          notificationRecipients: [validatedData.adminEmail],
          adminEmail: validatedData.adminEmail || null,
          adminPhone: validatedData.adminPhone || null,
          onboardingCompleted: true,
          // Billing defaults
          smsEnabled: false, // Will be enabled after payment confirmation for paid plans
          emailEnabled: true,
          subscriptionStatus: validatedData.plan === 'Free' ? "ACTIVE" : "INCOMPLETE", // Paid plans are INCOMPLETE until payment
          planStartDate: validatedData.plan === 'Free' ? new Date() : null, // Set after payment for paid plans

          // Extended Company Information
          legalCompanyName: validatedData.legalCompanyName || null,
          operatingName: validatedData.operatingName || null,
          country: validatedData.country || null,
          entityType: validatedData.entityType || null,
          businessRegistrationNumber: validatedData.businessRegistrationNumber || null,
          registeredAddress: validatedData.registeredAddress || null,
          operatingAddresses: validatedData.operatingAddresses || null,
          companyWebsite: validatedData.companyWebsite || null,
          adminFullName: validatedData.adminFullName || null,

          // DSP Specific Information
          isAmazonDSP: validatedData.isAmazonDSP || false,
          dspCompanyName: validatedData.dspCompanyName || null,
          stationCodes: validatedData.stationCodes || [],
          dspOwnerName: validatedData.dspOwnerName || null,
          opsManagerName: validatedData.opsManagerName || null,
          dspId: validatedData.dspId || null,

          // Billing Contact Information
          paymentMethod: validatedData.paymentMethod || null,
          billingContactName: validatedData.billingContactName || null,
          billingContactEmail: validatedData.billingContactEmail || null,
          billingAddress: validatedData.billingAddress || null,
        },
      });
      console.log("Company created successfully:", newCompany.id);

      // Update user's companyId and mark policies as accepted
      console.log("Updating user's companyId to:", newCompany.id);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: newCompany.id,
          policiesAccepted: true, // Admin accepted policies during onboarding
          policiesAcceptedAt: new Date(),
        },
      });
      console.log("User companyId and policy acceptance updated successfully");

      // Get user email from Clerk for consent logging
      console.log("Fetching Clerk user for consent logging...");
      const clerkUser = await clerkClient.users.getUser(userId);
      const userEmail = clerkUser.emailAddresses[0]?.emailAddress || validatedData.adminEmail;

      // Log policy acceptances with full consent metadata
      try {
        console.log("Logging policy acceptances for admin...");
        const consentResult = await logPolicyAcceptances(
          user.id,
          newCompany.id,
          userEmail,
          req
        );
        console.log("✅ Policy acceptance logging result:", consentResult);
      } catch (consentError) {
        console.error("❌ Failed to log policy acceptances:", consentError);
        // Don't fail onboarding if consent logging fails, but log the error
      }

      // Update Clerk user metadata - preserve existing metadata
      console.log("Updating Clerk metadata for user:", userId);
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...clerkUser.publicMetadata, // Preserve existing metadata (role, dspRole)
          companyId: newCompany.id,
        },
      });
      console.log("Clerk metadata updated successfully");

      console.log("=== Onboarding Complete Summary ===");
      console.log("Company ID:", newCompany.id);
      console.log("Company Name:", newCompany.name);
      console.log("Plan:", newCompany.plan);
      console.log("User ID (Clerk):", userId);
      console.log("User ID (Prisma):", user.id);
      console.log("===================================");

      return res.status(201).json({
        message: "Onboarding completed successfully",
        company: {
          id: newCompany.id,
          name: newCompany.name,
          plan: newCompany.plan,
        },
      });
    }
  } catch (error) {
    console.error("Onboarding error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Log additional Prisma error details
    if (error.code) {
      console.error("Prisma error code:", error.code);
      console.error("Prisma meta:", error.meta);
    }

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    // Handle Prisma unique constraint errors
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Duplicate entry",
        message: "A company already exists for this admin user",
        field: error.meta?.target,
      });
    }

    // Handle other Prisma errors
    if (error.code && error.code.startsWith("P")) {
      return res.status(500).json({
        error: "Database error",
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const getOnboardingStatus = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        companyAdmin: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const company = user.companyAdmin;

    return res.status(200).json({
      onboardingCompleted: company?.onboardingCompleted || false,
      company: company || null,
    });
  } catch (error) {
    console.error("Error fetching onboarding status:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
