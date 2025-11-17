import crypto from "crypto";
import prisma from "../../prisma/client.js";
import auditService from "./auditService.js";

/**
 * Policy Service
 * Handles policy management, versioning, hashing, and publishing
 */

/**
 * Generate SHA-256 hash of content
 * @param {string} content - The policy content
 * @returns {string} - The SHA-256 hash
 */
function generateContentHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Generate next version number
 * @param {string} policyType - The type of policy
 * @param {boolean} isMajor - If true, increment major version; otherwise increment patch
 * @returns {Promise<string>} - The next version number (e.g., "1.0.1")
 */
async function generateNextVersion(policyType, isMajor = false) {
  const latestPolicy = await prisma.policy.findFirst({
    where: { type: policyType },
    orderBy: { createdAt: "desc" },
  });

  if (!latestPolicy) {
    return "1.0.0";
  }

  const [major, minor, patch] = latestPolicy.version.split(".").map(Number);

  if (isMajor) {
    return `${major + 1}.0.0`;
  } else {
    return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Create a new policy version
 * @param {Object} data - Policy data
 * @param {string} data.type - Policy type
 * @param {string} data.content - Policy content (rich text HTML)
 * @param {string} data.createdById - User ID creating the policy
 * @param {boolean} data.isPublished - Whether to publish immediately
 * @param {boolean} data.isMajorVersion - Whether this is a major version change
 * @returns {Promise<Object>} - The created policy
 */
export async function createPolicy({
  type,
  content,
  createdById,
  isPublished = false,
  isMajorVersion = false,
}) {
  const contentHash = generateContentHash(content);
  const version = await generateNextVersion(type, isMajorVersion);

  // If publishing this version, unpublish previous ones
  if (isPublished) {
    await prisma.policy.updateMany({
      where: { type, isPublished: true },
      data: { isPublished: false },
    });
  }

  const policy = await prisma.policy.create({
    data: {
      type,
      version,
      content,
      contentHash,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      createdById,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditService.logAudit({
    userId: createdById,
    action: "CREATE",
    resource: "Policy",
    resourceId: policy.id,
    newValues: {
      type: policy.type,
      version: policy.version,
      isPublished: policy.isPublished,
    },
    severity: "INFO",
    category: "COMPLIANCE",
  });

  return policy;
}

/**
 * Update a policy (creates a new version)
 * @param {Object} data - Update data
 * @param {string} data.type - Policy type to update
 * @param {string} data.content - New content
 * @param {string} data.userId - User ID making the update
 * @param {boolean} data.isPublished - Whether to publish immediately
 * @param {boolean} data.isMajorVersion - Whether this is a major version change
 * @returns {Promise<Object>} - The new policy version
 */
export async function updatePolicy({
  type,
  content,
  userId,
  isPublished = false,
  isMajorVersion = false,
}) {
  // Get current published version
  const currentPolicy = await prisma.policy.findFirst({
    where: { type, isPublished: true },
  });

  // Create new version (this is an update pattern - always create new version)
  const newPolicy = await createPolicy({
    type,
    content,
    createdById: userId,
    isPublished,
    isMajorVersion,
  });

  // Audit log the update
  await auditService.logAudit({
    userId,
    action: "UPDATE",
    resource: "Policy",
    resourceId: newPolicy.id,
    oldValues: currentPolicy
      ? {
          version: currentPolicy.version,
          contentHash: currentPolicy.contentHash,
        }
      : null,
    newValues: {
      version: newPolicy.version,
      contentHash: newPolicy.contentHash,
    },
    changes: ["version", "content", "contentHash"],
    severity: "INFO",
    category: "COMPLIANCE",
  });

  return newPolicy;
}

/**
 * Publish a specific policy version
 * @param {string} policyId - The policy ID to publish
 * @param {string} userId - User ID publishing the policy
 * @returns {Promise<Object>} - The published policy
 */
export async function publishPolicy(policyId, userId) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
  });

  if (!policy) {
    throw new Error("Policy not found");
  }

  // Unpublish all other versions of this type
  await prisma.policy.updateMany({
    where: { type: policy.type, isPublished: true },
    data: { isPublished: false },
  });

  // Publish this version
  const publishedPolicy = await prisma.policy.update({
    where: { id: policyId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
    },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditService.logAudit({
    userId,
    action: "UPDATE",
    resource: "Policy",
    resourceId: policyId,
    newValues: {
      isPublished: true,
      publishedAt: publishedPolicy.publishedAt,
    },
    changes: ["isPublished", "publishedAt"],
    severity: "INFO",
    category: "COMPLIANCE",
  });

  return publishedPolicy;
}

/**
 * Unpublish a policy version
 * @param {string} policyId - The policy ID to unpublish
 * @param {string} userId - User ID unpublishing the policy
 * @returns {Promise<Object>} - The unpublished policy
 */
export async function unpublishPolicy(policyId, userId) {
  const policy = await prisma.policy.update({
    where: { id: policyId },
    data: {
      isPublished: false,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Audit log
  await auditService.logAudit({
    userId,
    action: "UPDATE",
    resource: "Policy",
    resourceId: policyId,
    newValues: {
      isPublished: false,
    },
    changes: ["isPublished"],
    severity: "INFO",
    category: "COMPLIANCE",
  });

  return policy;
}

/**
 * Get latest published policy by type
 * @param {string} type - Policy type
 * @returns {Promise<Object|null>} - The latest published policy or null
 */
export async function getLatestPublishedPolicy(type) {
  return await prisma.policy.findFirst({
    where: {
      type,
      isPublished: true,
    },
    orderBy: { publishedAt: "desc" },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Get all versions of a policy type
 * @param {string} type - Policy type
 * @returns {Promise<Array>} - All policy versions ordered by creation date (newest first)
 */
export async function getPolicyHistory(type) {
  return await prisma.policy.findMany({
    where: { type },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Get a specific policy by ID
 * @param {string} policyId - The policy ID
 * @returns {Promise<Object>} - The policy
 */
export async function getPolicyById(policyId) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!policy) {
    throw new Error("Policy not found");
  }

  return policy;
}

/**
 * Get all latest published policies (one for each type)
 * @returns {Promise<Array>} - Array of latest published policies
 */
export async function getAllLatestPublishedPolicies() {
  const policyTypes = [
    "TERMS_OF_SERVICE",
    "PRIVACY_POLICY",
    "DATA_PROCESSING_AGREEMENT",
    "SMS_CONSENT",
    "COOKIE_PREFERENCES",
    "SUPPORT_ACCESS",
  ];

  const policies = await Promise.all(
    policyTypes.map((type) => getLatestPublishedPolicy(type))
  );

  // Filter out null values (policies that don't exist yet)
  return policies.filter((policy) => policy !== null);
}

/**
 * Delete a policy version (only if not published)
 * @param {string} policyId - The policy ID to delete
 * @param {string} userId - User ID deleting the policy
 * @returns {Promise<Object>} - The deleted policy
 */
export async function deletePolicy(policyId, userId) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
  });

  if (!policy) {
    throw new Error("Policy not found");
  }

  if (policy.isPublished) {
    throw new Error("Cannot delete a published policy. Unpublish it first.");
  }

  const deletedPolicy = await prisma.policy.delete({
    where: { id: policyId },
  });

  // Audit log
  await auditService.logAudit({
    userId,
    action: "DELETE",
    resource: "Policy",
    resourceId: policyId,
    oldValues: {
      type: deletedPolicy.type,
      version: deletedPolicy.version,
    },
    severity: "WARNING",
    category: "COMPLIANCE",
  });

  return deletedPolicy;
}

/**
 * Verify content hash matches
 * @param {string} policyId - The policy ID
 * @param {string} content - The content to verify
 * @returns {Promise<boolean>} - True if hash matches
 */
export async function verifyPolicyIntegrity(policyId, content) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    select: { contentHash: true },
  });

  if (!policy) {
    throw new Error("Policy not found");
  }

  const computedHash = generateContentHash(content);
  return computedHash === policy.contentHash;
}

export default {
  createPolicy,
  updatePolicy,
  publishPolicy,
  unpublishPolicy,
  getLatestPublishedPolicy,
  getPolicyHistory,
  getPolicyById,
  getAllLatestPublishedPolicies,
  deletePolicy,
  verifyPolicyIntegrity,
  generateContentHash,
};
