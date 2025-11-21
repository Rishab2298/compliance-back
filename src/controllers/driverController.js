import prisma from "../../prisma/client.js";
import { z } from "zod";
import { checkLimit } from '../services/billingService.js';
import { getPlanLimits } from '../config/planLimits.js';
import auditService from '../services/auditService.js';

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
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User not found or not associated with a company" });
    }

    // Get the company
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
    });

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

    // Log the driver creation
    await auditService.logDriverOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: company.id,
      action: "DRIVER_CREATED",
      driverId: driver.id,
      driverName: driver.name,
      newValues: {
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        contact: driver.contact,
      },
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

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
    const { page = 1, limit = 50, includeDocuments = 'false' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User not found" });
    }

    const companyId = user.companyId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const shouldIncludeDocs = includeDocuments === 'true';

    // Fetch drivers with optional documents
    const [drivers, totalCount] = await Promise.all([
      prisma.driver.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contact: true,
          createdAt: true,
          updatedAt: true,
          ...(shouldIncludeDocs && {
            documents: {
              select: {
                id: true,
                type: true,
                status: true,
                expiryDate: true,
                uploadedAt: true,
              },
              orderBy: { uploadedAt: 'desc' },
              take: 10, // Limit to 10 most recent documents per driver
            },
          }),
          // Always include document count
          _count: {
            select: { documents: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.driver.count({ where: { companyId } }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      drivers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
      },
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
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User or company not found" });
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyId,
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
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Verify the driver belongs to this company
    const existingDriver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyId,
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

    // Log the driver update
    await auditService.logDriverOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "DRIVER_UPDATED",
      driverId: id,
      driverName: updatedDriver.name,
      oldValues: {
        name: existingDriver.name,
        email: existingDriver.email,
        phone: existingDriver.phone,
        contact: existingDriver.contact,
      },
      newValues: {
        name: updatedDriver.name,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        contact: updatedDriver.contact,
      },
      changes: Object.keys(updateData),
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
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
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Verify the driver belongs to this company
    const existingDriver = await prisma.driver.findFirst({
      where: {
        id,
        companyId: user.companyId,
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

    // Log the driver deletion
    await auditService.logDriverOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "DRIVER_DELETED",
      driverId: id,
      driverName: existingDriver.name,
      oldValues: {
        name: existingDriver.name,
        email: existingDriver.email,
        phone: existingDriver.phone,
        contact: existingDriver.contact,
      },
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
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
 * Bulk create drivers from CSV import
 * POST /api/drivers/bulk-import
 */
export const bulkImportDrivers = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { drivers } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user found" });
    }

    if (!Array.isArray(drivers) || drivers.length === 0) {
      return res.status(400).json({ error: "Invalid request - drivers array is required" });
    }

    // Validate batch size - maximum 100 drivers per import
    const MAX_BATCH_SIZE = 100;
    if (drivers.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Batch size limit exceeded",
        message: `Cannot import more than ${MAX_BATCH_SIZE} drivers at once. You tried to import ${drivers.length} drivers.`,
        limit: MAX_BATCH_SIZE,
        attempted: drivers.length,
      });
    }

    // Find the user in the database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User not found or not associated with a company" });
    }

    // Get the company with driver count
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        _count: {
          select: { drivers: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found. Please complete onboarding first." });
    }

    // Upfront validation: Check if user has plan capacity for the entire batch
    const currentDriverCount = company._count.drivers;
    const planLimits = getPlanLimits(company.plan);
    const maxDrivers = planLimits.maxDrivers;

    if (maxDrivers !== -1 && (currentDriverCount + drivers.length) > maxDrivers) {
      return res.status(403).json({
        error: "Driver limit exceeded",
        message: `Your ${company.plan} plan allows ${maxDrivers} drivers. You currently have ${currentDriverCount} drivers and are trying to add ${drivers.length} more. Please upgrade your plan or reduce the number of drivers in this import.`,
        current: currentDriverCount,
        limit: maxDrivers,
        attempted: drivers.length,
        available: maxDrivers - currentDriverCount,
        upgradeRequired: true,
        currentPlan: company.plan,
        errorCode: 'BULK_IMPORT_EXCEEDS_PLAN_LIMIT'
      });
    }

    const results = {
      successful: [],
      failed: [],
      limitReached: false,
    };

    // Process each driver
    for (const driverData of drivers) {
      try {
        // Validate driver data
        const validatedData = createDriverSchema.parse(driverData);

        // Check driver limit
        const limitCheck = await checkLimit(company.id, 'drivers');
        if (!limitCheck.allowed) {
          results.limitReached = true;
          results.failed.push({
            ...driverData,
            error: limitCheck.message,
          });
          break;
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

        results.successful.push({
          id: driver.id,
          name: driver.name,
          email: driver.email,
        });
      } catch (error) {
        results.failed.push({
          ...driverData,
          error: error.message,
        });
      }
    }

    // Log the CSV import
    await auditService.logCSVImport({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: company.id,
      resourceType: "Driver",
      recordCount: drivers.length,
      successCount: results.successful.length,
      failedCount: results.failed.length,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({
      message: `Bulk import completed. ${results.successful.length} drivers created, ${results.failed.length} failed.`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk import:", error);
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
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: "User or company not found" });
    }

    // Get all drivers for this company
    const drivers = await prisma.driver.findMany({
      where: { companyId: user.companyId },
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
