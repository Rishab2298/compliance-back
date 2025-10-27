import { clerkClient } from "@clerk/express";
import prisma from "../../prisma/client.js";
import { onboardingSchema } from "../schemas/onboardingSchema.js";

export const saveOnboarding = async (req, res) => {
  try {
    // Validate request body
    const validatedData = onboardingSchema.parse(req.body);

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

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the user already has a company
    const existingCompany = await prisma.company.findUnique({
      where: { adminUserId: user.id },
    });

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

      // If first driver information is provided, create the driver
      if (validatedData.firstDriverName && validatedData.firstDriverContact) {
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
      }

      // Update user's companyId
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: newCompany.id },
      });

      // Update Clerk user metadata with the Clerk user ID (not Prisma user ID)
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          companyId: newCompany.id,
        },
      });
      return res.status(201).json({
        message: "Onboarding completed successfully",
        company: newCompany,
      });
    }
  } catch (error) {
    console.error("Onboarding error:", error);

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
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
