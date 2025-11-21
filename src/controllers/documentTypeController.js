import prisma from '../../prisma/client.js';
import {
  DEFAULT_DOCUMENT_TYPES,
  FIELD_TYPES,
  validateDocumentTypeConfig,
  validateDocumentTypeConfigStrict,
  mergeWithDefaults,
  isDefaultType,
  documentTypeConfigSchema,
  documentTypeNameSchema,
} from '../utils/documentTypeDefaults.js';

/**
 * Get all document type configurations for a company
 * Returns merged configurations: defaults + custom types
 */
export const getAllDocumentTypeConfigs = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user.companyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        documentTypeConfigs: true,
        documentTypes: true, // Keep for backward compatibility
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Merge default configurations with company's custom configurations
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    // Convert to array format for frontend
    const configsArray = Object.entries(mergedConfigs).map(([name, config]) => ({
      name,
      ...config,
    }));

    res.status(200).json({
      success: true,
      data: {
        documentTypes: configsArray,
        totalCount: configsArray.length,
        defaultCount: Object.keys(DEFAULT_DOCUMENT_TYPES).length,
        customCount: configsArray.length - Object.keys(DEFAULT_DOCUMENT_TYPES).length,
      },
    });
  } catch (error) {
    console.error('Error fetching document type configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type configurations',
      error: error.message,
    });
  }
};

/**
 * Get a specific document type configuration by name
 */
export const getDocumentTypeConfig = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.params;

    if (!user || !user.companyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Merge defaults with custom configs
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    // Decode URI component (handles spaces and special characters)
    const decodedName = decodeURIComponent(name);
    const config = mergedConfigs[decodedName];

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        name: decodedName,
        ...config,
      },
    });
  } catch (error) {
    console.error('Error fetching document type configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type configuration',
      error: error.message,
    });
  }
};

/**
 * Create a new custom document type
 */
export const createCustomDocumentType = async (req, res) => {
  try {
    const user = req.user;
    const { name, aiEnabled, extractionMode, fields, description } = req.body;

    if (!user || !user.companyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate document type name first
    const nameValidation = documentTypeNameSchema.safeParse(name);
    if (!nameValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type name',
        errors: nameValidation.error.errors.map(err => err.message),
      });
    }

    const trimmedName = name.trim();

    // Build configuration object with defaults
    const config = {
      aiEnabled: aiEnabled !== undefined ? aiEnabled : false,
      isDefault: false, // Custom types are never defaults
      isActive: false, // New custom types start as inactive
      extractionMode: extractionMode || 'classification-only',
      fields: fields || [],
      description: description || undefined,
    };

    // Validate configuration using comprehensive Zod validation
    const validation = validateDocumentTypeConfig(config, trimmedName);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type configuration',
        errors: validation.errors,
        details: {
          hint: 'Field names must start with a letter and contain only letters, numbers, and underscores. All required properties must be provided.',
        },
      });
    }

    // Use the validated and sanitized configuration
    const validatedConfig = validation.data;

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if document type already exists (including defaults)
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    if (mergedConfigs[trimmedName]) {
      return res.status(409).json({
        success: false,
        message: 'A document type with this name already exists',
        conflict: trimmedName,
      });
    }

    // Add new custom type to company's configurations using validated config
    const updatedConfigs = {
      ...customConfigs,
      [trimmedName]: validatedConfig,
    };

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Custom document type created successfully',
      data: {
        name: trimmedName,
        ...validatedConfig,
      },
    });
  } catch (error) {
    console.error('Error creating custom document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom document type',
      error: error.message,
    });
  }
};

/**
 * Update a document type configuration
 * Can update default types (customize them) or custom types
 */
export const updateDocumentTypeConfig = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.params;
    const { aiEnabled, extractionMode, fields, description } = req.body;

    if (!user || !user.companyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Decode URI component
    const decodedName = decodeURIComponent(name);

    // Check if document type exists (in defaults or custom)
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    if (!mergedConfigs[decodedName]) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Get current config (from custom or defaults)
    const currentConfig = mergedConfigs[decodedName];

    // Build updated configuration
    const updatedConfig = {
      ...currentConfig,
      aiEnabled: aiEnabled !== undefined ? aiEnabled : currentConfig.aiEnabled,
      extractionMode: extractionMode || currentConfig.extractionMode,
      fields: fields !== undefined ? fields : currentConfig.fields,
      description: description !== undefined ? description : currentConfig.description,
    };

    // Validate updated configuration
    const validation = validateDocumentTypeConfig(updatedConfig, decodedName);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type configuration',
        errors: validation.errors,
      });
    }

    // Use the validated and sanitized configuration
    const validatedConfig = validation.data;

    // Update in company's custom configurations using validated config
    const updatedConfigs = {
      ...customConfigs,
      [decodedName]: validatedConfig,
    };

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Document type configuration updated successfully',
      data: {
        name: decodedName,
        ...validatedConfig,
      },
    });
  } catch (error) {
    console.error('Error updating document type configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document type configuration',
      error: error.message,
    });
  }
};

/**
 * Delete a custom document type
 * Cannot delete default types
 */
export const deleteCustomDocumentType = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.params;

    if (!user || !user.companyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Decode URI component
    const decodedName = decodeURIComponent(name);

    // Check if it's a default type (cannot delete defaults)
    if (isDefaultType(decodedName)) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete default document types. You can only customize them.',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    const customConfigs = company.documentTypeConfigs || {};

    // Check if custom type exists
    if (!customConfigs[decodedName]) {
      return res.status(404).json({
        success: false,
        message: 'Custom document type not found',
      });
    }

    // Remove from custom configurations
    const updatedConfigs = { ...customConfigs };
    delete updatedConfigs[decodedName];

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Custom document type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting custom document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom document type',
      error: error.message,
    });
  }
};

/**
 * Get available field types for the UI
 */
export const getAvailableFieldTypes = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: FIELD_TYPES,
    });
  } catch (error) {
    console.error('Error fetching available field types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available field types',
      error: error.message,
    });
  }
};

/**
 * Toggle active status of a document type
 * With plan restrictions: Free plan can only have 1 active document type
 */
export const toggleDocumentTypeActive = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.params;
    const { isActive } = req.body;

    console.log('🔄 Toggle Active Request:', { name, isActive, userId: user?.id, companyId: user?.companyId });

    if (!user || !user.companyId) {
      console.error('❌ No user or companyId found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (typeof isActive !== 'boolean') {
      console.error('❌ isActive is not boolean:', typeof isActive);
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        documentTypeConfigs: true,
        plan: true, // Plan is stored directly on Company model
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Decode URI component
    const decodedName = decodeURIComponent(name);

    // Get current configurations
    const customConfigs = company.documentTypeConfigs || {};
    const mergedConfigs = mergeWithDefaults(customConfigs);

    if (!mergedConfigs[decodedName]) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Check plan restrictions when activating a new document type
    if (isActive) {
      const planType = company.plan || 'Free';

      // Get plan limits
      const { getPlanLimits } = await import('../config/planLimits.js');
      const planLimits = getPlanLimits(planType);
      const maxActiveTypes = planLimits.maxDocumentsPerDriver;

      // Count currently active document types
      const activeCount = Object.values(mergedConfigs).filter(
        config => config.isActive === true
      ).length;

      console.log('Plan check:', { planType, maxActiveTypes, activeCount, currentDocIsActive: mergedConfigs[decodedName].isActive });

      // Check if limit is reached (skip check if document is already active - just toggling off)
      if (maxActiveTypes !== -1 && activeCount >= maxActiveTypes) {
        // Check if the document being activated is already active
        if (!mergedConfigs[decodedName].isActive) {
          return res.status(403).json({
            success: false,
            message: `${planType} plan allows only ${maxActiveTypes} active document ${maxActiveTypes === 1 ? 'type' : 'types'}`,
            errorCode: 'PLAN_LIMIT_REACHED',
            upgradeRequired: true,
            currentActive: activeCount,
            limit: maxActiveTypes,
            planType,
          });
        }
      }
    }

    // Get current config
    const currentConfig = mergedConfigs[decodedName];

    // Update the isActive status
    // Ensure we preserve all fields from currentConfig
    const updatedConfig = {
      aiEnabled: currentConfig.aiEnabled,
      isDefault: currentConfig.isDefault,
      extractionMode: currentConfig.extractionMode,
      fields: currentConfig.fields || [],
      description: currentConfig.description,
      isActive,
    };

    // Update in company's configurations
    const updatedConfigs = {
      ...customConfigs,
      [decodedName]: updatedConfig,
    };

    console.log('💾 Updating company with configs:', JSON.stringify(updatedConfigs, null, 2));

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs,
      },
    });

    console.log('✅ Toggle successful');

    res.status(200).json({
      success: true,
      message: `Document type "${decodedName}" ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        name: decodedName,
        ...updatedConfig,
      },
    });
  } catch (error) {
    console.error('❌ Error toggling document type active status:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle document type active status',
      error: error.message,
    });
  }
};

// ====================================================================================
// LEGACY FUNCTIONS - Keep for backward compatibility with old documentTypes array
// ====================================================================================

/**
 * Get all document types (legacy - returns simple string array)
 * @deprecated Use getAllDocumentTypeConfigs instead
 */
export const getDocumentTypes = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { includeFields } = req.query; // Query parameter to include full field configurations

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        documentTypes: true,
        documentTypeConfigs: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // If using new system
    if (company.documentTypeConfigs && Object.keys(company.documentTypeConfigs).length > 0) {
      const customConfigs = company.documentTypeConfigs || {};
      const mergedConfigs = mergeWithDefaults(customConfigs);

      // If includeFields=true, return full configurations for ACTIVE document types only
      if (includeFields === 'true') {
        const documentTypesWithFields = Object.entries(mergedConfigs)
          .filter(([_, config]) => config.isActive) // Only active types
          .map(([name, config]) => ({
            name,
            aiEnabled: config.aiEnabled,
            isDefault: config.isDefault,
            isActive: config.isActive,
            extractionMode: config.extractionMode,
            fields: config.fields,
            description: config.description
          }));

        return res.status(200).json({
          success: true,
          data: documentTypesWithFields,
        });
      }

      // Default: return just names for backward compatibility (only ACTIVE ones)
      const activeConfigs = Object.entries(mergedConfigs).filter(([_, config]) => config.isActive);
      const typeNames = activeConfigs.map(([name, _]) => name);

      return res.status(200).json({
        success: true,
        data: typeNames,
      });
    }

    // Fallback to old documentTypes array (just names)
    res.status(200).json({
      success: true,
      data: company.documentTypes || [],
    });
  } catch (error) {
    console.error('Error fetching document types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document types',
      error: error.message,
    });
  }
};

/**
 * Get a single document type by name (legacy)
 * @deprecated Use getDocumentTypeConfig instead
 */
export const getDocumentType = async (req, res) => {
  try {
    const { companyId, name } = req.params;
    const { includeFields } = req.query; // Query parameter to include full field configurations

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        documentTypes: true,
        documentTypeConfigs: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // If using new system
    if (company.documentTypeConfigs && Object.keys(company.documentTypeConfigs).length > 0) {
      const customConfigs = company.documentTypeConfigs || {};
      const mergedConfigs = mergeWithDefaults(customConfigs);

      const documentTypeConfig = mergedConfigs[name];

      if (!documentTypeConfig) {
        return res.status(404).json({
          success: false,
          message: 'Document type not found',
        });
      }

      // If includeFields=true, return full configuration with fields
      if (includeFields === 'true') {
        return res.status(200).json({
          success: true,
          data: {
            name,
            aiEnabled: documentTypeConfig.aiEnabled,
            isDefault: documentTypeConfig.isDefault,
            extractionMode: documentTypeConfig.extractionMode,
            fields: documentTypeConfig.fields,
            description: documentTypeConfig.description
          }
        });
      }

      // Default: return just the name for backward compatibility
      return res.status(200).json({
        success: true,
        data: name,
      });
    }

    // Fallback to old array (just the name)
    const documentType = company.documentTypes.find(dt => dt === name);

    if (!documentType) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    res.status(200).json({
      success: true,
      data: documentType,
    });
  } catch (error) {
    console.error('Error fetching document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document type',
      error: error.message,
    });
  }
};

/**
 * Create a new document type (legacy - simple string)
 * @deprecated Use createCustomDocumentType instead
 */
export const createDocumentType = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Document type name is required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if document type with same name already exists
    if (company.documentTypes.includes(name.trim())) {
      return res.status(409).json({
        success: false,
        message: 'A document type with this name already exists',
      });
    }

    // Add new document type to array
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: {
          push: name.trim(),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Document type created successfully',
      data: updatedCompany.documentTypes,
    });
  } catch (error) {
    console.error('Error creating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create document type',
      error: error.message,
    });
  }
};

/**
 * Update a document type (legacy - rename)
 * @deprecated Use updateDocumentTypeConfig instead
 */
export const updateDocumentType = async (req, res) => {
  try {
    const { companyId, oldName } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New document type name is required',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if old name exists
    if (!company.documentTypes.includes(oldName)) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Check if new name already exists
    if (company.documentTypes.includes(newName.trim()) && newName.trim() !== oldName) {
      return res.status(409).json({
        success: false,
        message: 'A document type with this name already exists',
      });
    }

    // Update the array
    const updatedTypes = company.documentTypes.map(type =>
      type === oldName ? newName.trim() : type
    );

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: updatedTypes,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Document type updated successfully',
      data: updatedCompany.documentTypes,
    });
  } catch (error) {
    console.error('Error updating document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document type',
      error: error.message,
    });
  }
};

/**
 * Delete a document type (legacy)
 * @deprecated Use deleteCustomDocumentType instead
 */
export const deleteDocumentType = async (req, res) => {
  try {
    const { companyId, name } = req.params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { documentTypes: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Check if document type exists
    if (!company.documentTypes.includes(name)) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found',
      });
    }

    // Remove the document type from array
    const updatedTypes = company.documentTypes.filter(type => type !== name);

    await prisma.company.update({
      where: { id: companyId },
      data: {
        documentTypes: updatedTypes,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Document type deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document type',
      error: error.message,
    });
  }
};
