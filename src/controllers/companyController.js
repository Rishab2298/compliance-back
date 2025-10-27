import prisma from "../../prisma/client.js";

/**
 * Company Controller
 *
 * This file contains all controller functions for the Company resource.
 * Each function's expected payload, params, and response are described in comments.
 */

//////////////////////////////////////////////
// getCompanyById
//////////////////////////////////////////////
/**
 * Method: GET
 * URL: /api/company/:id
 * Params: id: integer (company ID)
 *
 *
 * Body: none
 * Response:
 *   200: { id, name, plan, companySize, operatingRegion, statesProvinces, industryType, documentTypes, reminderDays, notificationMethod, onboardingCompleted, createdAt, updatedAt }
 *   500: { error: "error message" }
 */

export const getCompanyById = async (req, res) => {
  try {
    // Extract ID from route params (Express)
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: "Missing company ID" });

    const company = await prisma.company.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        name: true,
        plan: true,
        companySize: true,
        operatingRegion: true,
        statesProvinces: true,
        industryType: true,
        documentTypes: true,
        reminderDays: true,
        notificationMethod: true,
        notificationRecipients: true,
        adminEmail: true,
        adminPhone: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
        // Billing fields
        aiCredits: true,
        monthlyCreditsUsed: true,
        subscriptionStatus: true,
        smsEnabled: true,
        emailEnabled: true,
      },
    });

    if (!company) return res.status(404).json({ error: "Company not found" });

    return res.status(200).json(company);
  } catch (err) {
    console.error("Error fetching company:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//////////////////////////////////////////////
// updateCompanyById
//////////////////////////////////////////////
/**
 * Method: PUT
 * URL: /api/company/:id
 * Params: id: string (company ID)
 *
 * Body: {
 *   documentTypes?: string[],
 *   reminderDays?: string[],
 *   notificationMethod?: 'email' | 'sms' | 'both',
 *   notificationRecipients?: string[],
 *   adminEmail?: string,
 *   adminPhone?: string
 * }
 *
 * Response:
 *   200: { success: true, data: updated company }
 *   400: { error: "error message" }
 *   404: { error: "Company not found" }
 *   500: { error: "error message" }
 */
export const updateCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      documentTypes,
      reminderDays,
      notificationMethod,
      notificationRecipients,
      adminEmail,
      adminPhone,
    } = req.body;

    if (!id) return res.status(400).json({ error: "Missing company ID" });

    // Check if company exists
    const existingCompany = await prisma.company.findUnique({
      where: { id: String(id) },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Build update data object
    const updateData = {};
    if (documentTypes !== undefined) updateData.documentTypes = documentTypes;
    if (reminderDays !== undefined) updateData.reminderDays = reminderDays;
    if (notificationMethod !== undefined) updateData.notificationMethod = notificationMethod;
    if (notificationRecipients !== undefined) updateData.notificationRecipients = notificationRecipients;
    if (adminEmail !== undefined) updateData.adminEmail = adminEmail;
    if (adminPhone !== undefined) updateData.adminPhone = adminPhone;

    // Update the company
    const updatedCompany = await prisma.company.update({
      where: { id: String(id) },
      data: updateData,
    });

    return res.status(200).json({
      success: true,
      message: "Company settings updated successfully",
      data: updatedCompany,
    });
  } catch (err) {
    console.error("Error updating company:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
