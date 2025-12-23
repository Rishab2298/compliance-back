import policyService from "../services/policyService.js";
import prisma from "../../prisma/client.js";
import { getIPAddress, getRegionFromIP } from "../utils/geoip.js";
import crypto from "crypto";
import { clerkClient } from "@clerk/express";
import { sendWelcomeEmail } from "../services/emailService.js";

/**
 * Policy Controller
 * Handles HTTP requests for policy management
 */

/**
 * Create a new policy version
 * POST /api/policies
 * Body: { type, content, isPublished, isMajorVersion }
 */
export const createPolicy = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { type, content, isPublished, isMajorVersion } = req.body;

    // Validation
    if (!type || !content) {
      return res.status(400).json({
        error: "Policy type and content are required",
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can create policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can manage policies",
      });
    }

    const policy = await policyService.createPolicy({
      type,
      content,
      createdById: user.id,
      isPublished: isPublished || false,
      isMajorVersion: isMajorVersion || false,
    });

    res.status(201).json({
      success: true,
      policy,
      message: `Policy version ${policy.version} created successfully`,
    });
  } catch (error) {
    console.error("Create policy error:", error);
    res.status(500).json({
      error: error.message || "Failed to create policy",
    });
  }
};

/**
 * Update a policy (creates new version)
 * PUT /api/policies/:type
 * Body: { content, isPublished, isMajorVersion }
 */
export const updatePolicy = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { type } = req.params;
    const { content, isPublished, isMajorVersion } = req.body;

    // Validation
    if (!content) {
      return res.status(400).json({
        error: "Policy content is required",
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can update policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can manage policies",
      });
    }

    const policy = await policyService.updatePolicy({
      type: type.toUpperCase(),
      content,
      userId: user.id,
      isPublished: isPublished || false,
      isMajorVersion: isMajorVersion || false,
    });

    res.json({
      success: true,
      policy,
      message: `Policy updated to version ${policy.version}`,
    });
  } catch (error) {
    console.error("Update policy error:", error);
    res.status(500).json({
      error: error.message || "Failed to update policy",
    });
  }
};

/**
 * Publish a specific policy version
 * PUT /api/policies/:id/publish
 */
export const publishPolicy = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can publish policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can publish policies",
      });
    }

    const policy = await policyService.publishPolicy(id, user.id);

    res.json({
      success: true,
      policy,
      message: `Policy version ${policy.version} published successfully`,
    });
  } catch (error) {
    console.error("Publish policy error:", error);
    res.status(500).json({
      error: error.message || "Failed to publish policy",
    });
  }
};

/**
 * Unpublish a policy version
 * PUT /api/policies/:id/unpublish
 */
export const unpublishPolicy = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can unpublish policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can unpublish policies",
      });
    }

    const policy = await policyService.unpublishPolicy(id, user.id);

    res.json({
      success: true,
      policy,
      message: "Policy unpublished successfully",
    });
  } catch (error) {
    console.error("Unpublish policy error:", error);
    res.status(500).json({
      error: error.message || "Failed to unpublish policy",
    });
  }
};

/**
 * Get latest published policy by type (PUBLIC ENDPOINT for onboarding)
 * GET /api/policies/latest/:type
 */
export const getLatestPublishedPolicy = async (req, res) => {
  try {
    const { type } = req.params;

    const policy = await policyService.getLatestPublishedPolicy(
      type.toUpperCase()
    );

    if (!policy) {
      return res.status(404).json({
        error: "No published policy found for this type",
      });
    }

    // Return only necessary fields for public consumption
    res.json({
      type: policy.type,
      version: policy.version,
      content: policy.content,
      contentHash: policy.contentHash,
      publishedAt: policy.publishedAt,
    });
  } catch (error) {
    console.error("Get latest policy error:", error);
    res.status(500).json({
      error: error.message || "Failed to get latest policy",
    });
  }
};

/**
 * Get all latest published policies (PUBLIC ENDPOINT for onboarding)
 * GET /api/policies/latest
 */
export const getAllLatestPublishedPolicies = async (req, res) => {
  try {
    const policies = await policyService.getAllLatestPublishedPolicies();

    // Return only necessary fields for public consumption
    const publicPolicies = policies.map((policy) => ({
      id: policy.id,
      type: policy.type,
      version: policy.version,
      content: policy.content,
      contentHash: policy.contentHash,
      publishedAt: policy.publishedAt,
    }));

    res.json({
      success: true,
      policies: publicPolicies,
    });
  } catch (error) {
    console.error("Get all latest policies error:", error);
    res.status(500).json({
      error: error.message || "Failed to get policies",
    });
  }
};

/**
 * Get policy history (all versions of a type)
 * GET /api/policies/history/:type
 */
export const getPolicyHistory = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { type } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can view policy history
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can view policy history",
      });
    }

    const policies = await policyService.getPolicyHistory(type.toUpperCase());

    res.json({
      success: true,
      policies,
      total: policies.length,
    });
  } catch (error) {
    console.error("Get policy history error:", error);
    res.status(500).json({
      error: error.message || "Failed to get policy history",
    });
  }
};

/**
 * Get a specific policy by ID
 * GET /api/policies/:id
 */
export const getPolicyById = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can view specific policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can view policies",
      });
    }

    const policy = await policyService.getPolicyById(id);

    res.json({
      success: true,
      policy,
    });
  } catch (error) {
    console.error("Get policy error:", error);
    res.status(404).json({
      error: error.message || "Policy not found",
    });
  }
};

/**
 * Delete a policy version (only if not published)
 * DELETE /api/policies/:id
 */
export const deletePolicy = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can delete policies
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can delete policies",
      });
    }

    await policyService.deletePolicy(id, user.id);

    res.json({
      success: true,
      message: "Policy deleted successfully",
    });
  } catch (error) {
    console.error("Delete policy error:", error);
    res.status(400).json({
      error: error.message || "Failed to delete policy",
    });
  }
};

/**
 * Get all policy types with their current status
 * GET /api/policies/status
 */
export const getPolicyStatus = async (req, res) => {
  try {
    const userId = req.auth.userId;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only SUPER_ADMIN can view policy status
    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        error: "Forbidden: Only super admins can view policy status",
      });
    }

    const policyTypes = [
      "TERMS_OF_SERVICE",
      "PRIVACY_POLICY",
      "DATA_PROCESSING_AGREEMENT",
      "SMS_CONSENT",
      "COOKIE_PREFERENCES",
      "SUPPORT_ACCESS",
      "AI_FAIR_USE_POLICY",
      "GDPR_DATA_PROCESSING_ADDENDUM",
      "COMPLAINTS_POLICY",
    ];

    const statusData = await Promise.all(
      policyTypes.map(async (type) => {
        const latest = await policyService.getLatestPublishedPolicy(type);
        const allVersions = await policyService.getPolicyHistory(type);

        return {
          type,
          hasPublished: !!latest,
          latestVersion: latest?.version || null,
          totalVersions: allVersions.length,
          lastUpdated: latest?.publishedAt || allVersions[0]?.createdAt || null,
        };
      })
    );

    res.json({
      success: true,
      policies: statusData,
    });
  } catch (error) {
    console.error("Get policy status error:", error);
    res.status(500).json({
      error: error.message || "Failed to get policy status",
    });
  }
};

/**
 * Accept policies (for team members after MFA)
 * POST /api/policies/accept
 */
export const acceptPolicies = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { policyIds } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return res.status(400).json({
        error: "Invalid request - policyIds array is required"
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        role: true,
        companyId: true,
        policiesAccepted: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is admin (admins accept policies during onboarding)
    if (!user.companyId || user.role === 'SUPER_ADMIN') {
      return res.status(400).json({
        error: "Policy acceptance is only for team members"
      });
    }

    // Get IP address, region, and user agent for consent logging
    const ipAddress = getIPAddress(req);
    const region = await getRegionFromIP(ipAddress);
    const userAgent = req.headers["user-agent"];

    // Get user email from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress || null;

    // Fetch all policies to accept
    const policies = await prisma.policy.findMany({
      where: {
        id: { in: policyIds },
        isPublished: true,
      },
    });

    if (policies.length !== policyIds.length) {
      return res.status(400).json({
        error: "Some policies not found or not published"
      });
    }

    // Create acceptance records with full consent logging
    const acceptances = await Promise.all(
      policies.map(async (policy) => {
        // Generate SHA-256 hash of policy content
        const contentHash = crypto.createHash('sha256').update(policy.content).digest('hex');

        return prisma.userPolicyAcceptance.upsert({
          where: {
            userId_policyId: {
              userId: user.id,
              policyId: policy.id,
            },
          },
          create: {
            userId: user.id,
            policyId: policy.id,
            policyType: policy.type,
            policyVersion: policy.version,
            contentHash,
            ipAddress,
            region,
            userAgent,
            userEmail,
            companyId: user.companyId,
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

    // Verify all 6 mandatory policies are accepted
    const requiredPolicies = [
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
      'DATA_PROCESSING_AGREEMENT',
      'SMS_CONSENT',
      'COOKIE_PREFERENCES',
      'SUPPORT_ACCESS',
    ];

    const userAcceptances = await prisma.userPolicyAcceptance.findMany({
      where: {
        userId: user.id,
      },
      select: {
        policyType: true,
      },
    });

    const acceptedTypes = userAcceptances.map(a => a.policyType);
    const allAccepted = requiredPolicies.every(type => acceptedTypes.includes(type));

    // Update user's policiesAccepted flag
    if (allAccepted) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          policiesAccepted: true,
          policiesAcceptedAt: new Date(),
        },
      });

      // Send welcome email after all policies are accepted
      try {
        const userWithCompany = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            company: {
              select: { name: true },
            },
          },
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const dashboardUrl = `${frontendUrl}/client/dashboard`;

        await sendWelcomeEmail({
          email: userEmail || clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName || 'there',
          companyName: userWithCompany?.company?.name || 'your company',
          role: user.role,
          dashboardUrl,
        });

        console.log('✅ Welcome email sent successfully to:', userEmail);
      } catch (emailError) {
        // Log error but don't fail the request
        console.error('❌ Failed to send welcome email:', emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Policies accepted successfully",
      allAccepted,
      acceptedCount: acceptances.length,
    });
  } catch (error) {
    console.error("Error accepting policies:", error);
    return res.status(500).json({
      error: "Failed to accept policies",
      message: error.message,
    });
  }
};

/**
 * Check if user has accepted all required policies
 * GET /api/policies/acceptance-status
 */
export const getAcceptanceStatus = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user ID found" });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        role: true,
        companyId: true,
        policiesAccepted: true,
        policiesAcceptedAt: true,
        policyAcceptances: {
          select: {
            policyType: true,
            policyVersion: true,
            acceptedAt: true,
          },
          orderBy: {
            acceptedAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Admins don't need to accept policies (they do it during onboarding)
    if (!user.companyId || user.role === 'SUPER_ADMIN') {
      return res.status(200).json({
        success: true,
        needsPolicyAcceptance: false,
        reason: "Admin users accept policies during onboarding",
      });
    }

    const requiredPolicies = [
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
      'DATA_PROCESSING_AGREEMENT',
      'SMS_CONSENT',
      'COOKIE_PREFERENCES',
      'SUPPORT_ACCESS',
    ];

    const acceptedTypes = user.policyAcceptances.map(a => a.policyType);
    const pendingPolicies = requiredPolicies.filter(type => !acceptedTypes.includes(type));

    return res.status(200).json({
      success: true,
      needsPolicyAcceptance: !user.policiesAccepted,
      policiesAccepted: user.policiesAccepted,
      policiesAcceptedAt: user.policiesAcceptedAt,
      acceptedPolicies: user.policyAcceptances,
      pendingPolicies,
    });
  } catch (error) {
    console.error("Error checking acceptance status:", error);
    return res.status(500).json({
      error: "Failed to check acceptance status",
      message: error.message,
    });
  }
};

export default {
  createPolicy,
  updatePolicy,
  publishPolicy,
  unpublishPolicy,
  getLatestPublishedPolicy,
  getAllLatestPublishedPolicies,
  getPolicyHistory,
  getPolicyById,
  deletePolicy,
  getPolicyStatus,
  acceptPolicies,
  getAcceptanceStatus,
};
