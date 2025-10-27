import prisma from "../../prisma/client.js";
import { z } from "zod";
import { checkLimit } from '../services/billingService.js';

// Validation schema for creating a driver
const createDriverSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  location: z.string().min(1, "Location is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  documentOption: z.enum(["upload", "link", "skip"]),
  processingMethod: z.enum(["ai", "manual"]).optional(),
  documents: z.record(z.any()).optional(),
  reminders: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    days: z.array(z.number()),
  }).optional(),
});

// Create a new driver
export const createDriver = async (req, res) => {
  try {
    // Validate request body
    const validatedData = createDriverSchema.parse(req.body);

    // Get the authenticated user from Clerk middleware
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user found" });
    }

    console.log("Creating driver for userId:", userId);

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get the company
    const company = user.companyAdmin;
    if (!company) {
      return res.status(404).json({ error: "Company not found. Please complete onboarding first." });
    }

    // Check driver limit before creating
    const limitCheck = await checkLimit(company.id, 'drivers');

    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: 'Driver limit reached',
        message: limitCheck.message,
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgradeRequired: true,
        currentPlan: company.plan,
        errorCode: 'DRIVER_LIMIT_REACHED'
      });
    }

    // Create the driver
    const driver = await prisma.driver.create({
      data: {
        companyId: company.id,
        name: `${validatedData.firstName} ${validatedData.lastName}`,
        email: validatedData.email,
        phone: validatedData.phone,
        contact: validatedData.employeeId,
      },
    });

    console.log("Driver created:", driver.id);

    // Return success response
    return res.status(201).json({
      message: "Driver created successfully",
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
      },
    });
  } catch (error) {
    console.error("Error creating driver:", error);

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

// Get all drivers for a company
export const getDrivers = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        companyAdmin: {
          include: {
            drivers: {
              include: {
                documents: {
                  select: {
                    id: true,
                    type: true,
                    status: true,
                    expiryDate: true,
                    uploadedAt: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const drivers = user.companyAdmin?.drivers || [];

    return res.status(200).json({
      drivers,
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Get a single driver by ID
export const getDriverById = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyAdmin.id,
      },
      include: {
        documents: {
          orderBy: {
            uploadedAt: "desc",
          },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    return res.status(200).json({ driver });
  } catch (error) {
    console.error("Error fetching driver:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Validation schema for updating a driver
const updateDriverSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().min(1, "Phone number is required").optional(),
  contact: z.string().optional(),
});

// Update a driver
export const updateDriver = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Validate request body
    const validatedData = updateDriverSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Verify the driver belongs to this company
    const existingDriver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyAdmin.id,
      },
    });

    if (!existingDriver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Build update data object
    const updateData = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.contact !== undefined) updateData.contact = validatedData.contact;

    const updatedDriver = await prisma.driver.update({
      where: { id },
      data: updateData,
      include: {
        documents: {
          orderBy: {
            uploadedAt: "desc",
          },
        },
      },
    });

    return res.status(200).json({
      message: "Driver updated successfully",
      driver: updatedDriver,
    });
  } catch (error) {
    console.error("Error updating driver:", error);

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

// Delete a driver
export const deleteDriver = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Verify the driver belongs to this company
    const existingDriver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyAdmin.id,
      },
    });

    if (!existingDriver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Delete related records in a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete all documents for this driver
      await tx.document.deleteMany({
        where: { driverId: id },
      });

      // Delete driver invitation if exists
      await tx.driverInvitation.deleteMany({
        where: { driverId: id },
      });

      // Finally, delete the driver
      await tx.driver.delete({
        where: { id },
      });
    });

    return res.status(200).json({
      message: "Driver deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting driver:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get document counts for all drivers in the company
 * Returns a map of driverId -> documentCount
 * GET /api/drivers/document-counts
 */
export const getDocumentCounts = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { companyAdmin: true },
    });

    if (!user || !user.companyAdmin) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Get all drivers for this company
    const drivers = await prisma.driver.findMany({
      where: { companyId: user.companyAdmin.id },
      select: { id: true },
    });

    // Get document counts for each driver in a single query
    const documentCounts = await prisma.document.groupBy({
      by: ['driverId'],
      where: {
        driverId: {
          in: drivers.map(d => d.id),
        },
      },
      _count: {
        id: true,
      },
    });

    // Create a map of driverId -> count
    const countsMap = {};
    documentCounts.forEach(({ driverId, _count }) => {
      countsMap[driverId] = _count.id;
    });

    // Ensure all drivers are in the map (even those with 0 documents)
    drivers.forEach(driver => {
      if (!countsMap[driver.id]) {
        countsMap[driver.id] = 0;
      }
    });

    return res.status(200).json({
      success: true,
      data: countsMap,
    });
  } catch (error) {
    console.error("Error fetching document counts:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
