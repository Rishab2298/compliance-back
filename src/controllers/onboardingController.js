import { clerkClient } from "@clerk/express";
import prisma from "../../prisma/client.js";
import { onboardingSchema } from "../schemas/onboardingSchema.js";

export const saveOnboarding = async (req, res) => {
  try {
    console.log("=== Onboarding Request Received ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User ID from auth:", req.auth?.userId);

    // Validate request body
    const validatedData = onboardingSchema.parse(req.body);
    console.log("Validation passed. Validated data:", JSON.stringify(validatedData, null, 2));

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
      const updatedCompany = await prisma.company.update({
        where: { id: existingCompany.id },
        data: {
          name: validatedData.companyName,
          companySize: validatedData.companySize,
          operatingRegion: validatedData.operatingRegion,
          statesProvinces: validatedData.statesProvinces,
          industryType: validatedData.industryType || null,
          documentTypes: validatedData.documents,
          reminderDays: validatedData.reminderDays || [],
          notificationMethod: validatedData.notificationMethod,
          notificationRecipients: validatedData.notificationRecipients,
          adminEmail: validatedData.adminEmail || null,
          adminPhone: validatedData.adminPhone || null,
          onboardingCompleted: true,
        },
      });

      // If first driver information is provided, create the driver
      if (validatedData.firstDriverName && validatedData.firstDriverContact) {
        await prisma.driver.create({
          data: {
            companyId: updatedCompany.id,
            name: validatedData.firstDriverName,
            email: validatedData.firstDriverContact.includes("@")
              ? validatedData.firstDriverContact
              : null,
            phone: !validatedData.firstDriverContact.includes("@")
              ? validatedData.firstDriverContact
              : null,
          },
        });
      }

      return res.status(200).json({
        message: "Onboarding completed successfully",
        company: updatedCompany,
      });
    } else {
      // Create new company with onboarding data
      console.log("Creating new company for user:", user.id);
      console.log("Company data to create:", {
        name: validatedData.companyName,
        adminUserId: user.id,
        plan: "Free",
        companySize: validatedData.companySize,
        operatingRegion: validatedData.operatingRegion,
        statesProvinces: validatedData.statesProvinces,
        industryType: validatedData.industryType || null,
        documentTypes: validatedData.documents,
        reminderDays: validatedData.reminderDays || [],
        notificationMethod: validatedData.notificationMethod,
        notificationRecipients: validatedData.notificationRecipients,
      });

      const newCompany = await prisma.company.create({
        data: {
          name: validatedData.companyName,
          adminUserId: user.id,
          plan: "Free", // Default to Free plan
          aiCredits: 5, // 5 one-time AI credits for Free plan
          companySize: validatedData.companySize,
          operatingRegion: validatedData.operatingRegion,
          statesProvinces: validatedData.statesProvinces,
          industryType: validatedData.industryType || null,
          documentTypes: validatedData.documents,
          reminderDays: validatedData.reminderDays || [],
          notificationMethod: validatedData.notificationMethod,
          notificationRecipients: validatedData.notificationRecipients,
          adminEmail: validatedData.adminEmail || null,
          adminPhone: validatedData.adminPhone || null,
          onboardingCompleted: true,
          // Billing defaults
          smsEnabled: false, // Free plan doesn't have SMS
          emailEnabled: true, // Free plan has basic email
          subscriptionStatus: "ACTIVE",
          planStartDate: new Date(),
        },
      });
      console.log("Company created successfully:", newCompany.id);

      // If first driver information is provided, create the driver
      if (validatedData.firstDriverName && validatedData.firstDriverContact) {
        console.log("Creating first driver:", validatedData.firstDriverName);
        await prisma.driver.create({
          data: {
            companyId: newCompany.id,
            name: validatedData.firstDriverName,
            email: validatedData.firstDriverContact.includes("@")
              ? validatedData.firstDriverContact
              : null,
            phone: !validatedData.firstDriverContact.includes("@")
              ? validatedData.firstDriverContact
              : null,
          },
        });
        console.log("Driver created successfully");
      }

      // Update user's companyId
      console.log("Updating user's companyId to:", newCompany.id);
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: newCompany.id },
      });
      console.log("User companyId updated successfully");

      // Update Clerk user metadata with the Clerk user ID (not Prisma user ID)
      console.log("Updating Clerk metadata for user:", userId);
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          companyId: newCompany.id,
        },
      });
      console.log("Clerk metadata updated successfully");
      return res.status(201).json({
        message: "Onboarding completed successfully",
        company: newCompany,
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
