/**
 * Default Document Type Configurations
 *
 * This file defines the 8 default document types and their extraction configurations.
 * Each document type specifies:
 * - aiEnabled: Whether AI extraction is available for this type
 * - isDefault: Whether this is a system default (cannot be deleted)
 * - extractionMode: "fields" (extract specific fields) or "classification-only" (just identify type)
 * - fields: Array of extractable fields with their properties
 */

import { z } from 'zod';

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiline', label: 'Multi-line Text' }
];

/**
 * Zod Schema for Field Validation
 * Validates individual fields in a document type configuration
 */
export const fieldSchema = z.object({
  name: z.string()
    .min(1, 'Field name is required')
    .max(50, 'Field name must be 50 characters or less')
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      'Field name must start with a letter and contain only letters, numbers, and underscores'
    ),
  label: z.string()
    .min(1, 'Field label is required')
    .max(100, 'Field label must be 100 characters or less'),
  type: z.enum(['text', 'date', 'number', 'boolean', 'select', 'multiline'], {
    errorMap: () => ({ message: 'Invalid field type. Must be one of: text, date, number, boolean, select, multiline' })
  }),
  required: z.boolean({
    errorMap: () => ({ message: 'Field "required" must be a boolean' })
  }),
  aiExtractable: z.boolean({
    errorMap: () => ({ message: 'Field "aiExtractable" must be a boolean' })
  }),
  description: z.string()
    .max(500, 'Field description must be 500 characters or less')
    .optional(),
  options: z.array(z.string())
    .optional()
    .refine(
      (options) => !options || options.length === 0 || options.every(opt => opt.trim().length > 0),
      'Options must not contain empty strings'
    ),
}).strict();

/**
 * Zod Schema for Document Type Configuration
 * Validates the entire document type configuration object
 */
export const documentTypeConfigSchema = z.object({
  aiEnabled: z.boolean({
    errorMap: () => ({ message: '"aiEnabled" must be a boolean' })
  }),
  isDefault: z.boolean({
    errorMap: () => ({ message: '"isDefault" must be a boolean' })
  }).optional(),
  isActive: z.boolean({
    errorMap: () => ({ message: '"isActive" must be a boolean' })
  }).optional(),
  extractionMode: z.enum(['fields', 'classification-only'], {
    errorMap: () => ({ message: 'Extraction mode must be either "fields" or "classification-only"' })
  }),
  fields: z.array(fieldSchema)
    .min(1, 'At least one field is required'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
})
.strict()
.refine(
  (config) => {
    // If extractionMode is 'fields' and AI is enabled, must have fields
    if (config.extractionMode === 'fields' && config.aiEnabled) {
      return config.fields.length > 0;
    }
    return true;
  },
  {
    message: 'Fields extraction mode with AI enabled must have at least one field',
  }
)
.refine(
  (config) => {
    // Check for duplicate field names
    const fieldNames = config.fields.map(f => f.name);
    const uniqueNames = new Set(fieldNames);
    return fieldNames.length === uniqueNames.size;
  },
  {
    message: 'Duplicate field names are not allowed',
  }
)
.refine(
  (config) => {
    // Check select fields have options
    const selectFields = config.fields.filter(f => f.type === 'select');
    return selectFields.every(field => field.options && field.options.length > 0);
  },
  {
    message: 'Select fields must have at least one option',
  }
);

/**
 * Zod Schema for Document Type Name Validation
 */
export const documentTypeNameSchema = z.string()
  .min(1, 'Document type name is required')
  .max(100, 'Document type name must be 100 characters or less')
  .refine(
    (name) => name.trim().length > 0,
    'Document type name cannot be empty or whitespace only'
  );

export const DEFAULT_DOCUMENT_TYPES = {
  "Driver's Licence": {
    aiEnabled: true,
    isDefault: true,
    isActive: true,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Driver's Licence')"
      },
      {
        name: "province",
        label: "Province/State",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The province or state that issued the license"
      },
      {
        name: "class",
        label: "License Class",
        type: "text",
        required: false,
        aiExtractable: true,
        description: "The class or category of the driver's license (e.g., Class 1, Class 5, CDL-A)"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        description: "The expiration date of the driver's license"
      }
    ]
  },

  "Driver Abstract": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Driver Abstract')"
      },
      {
        name: "issueDate",
        label: "Issue Date",
        type: "date",
        required: true,
        aiExtractable: true,
        description: "The date this driver abstract was issued"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: false,
        description: "Calculated as issue date + 30 days (auto-calculated by system)"
      }
    ]
  },

  "Work Eligibility": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Work Eligibility')"
      },
      {
        name: "documentSubType",
        label: "Document Sub-Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The specific document type: 'Passport', 'PR Card', or 'Work Permit'"
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        aiExtractable: true,
        options: ["Citizen", "Permanent Resident", "Work Permit"],
        description: "Work eligibility status - If Passport detected use 'Citizen', if PR Card use 'Permanent Resident', if Work Permit use 'Work Permit'"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        description: "Expiry date of the passport, PR card, or work permit"
      }
    ]
  },

  "Background Check": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Background Check')"
      },
      {
        name: "status",
        label: "Status",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "Background check status (e.g., Clear, Pending, Issues Found)"
      }
    ]
  },

  "Insurance": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Insurance')"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        description: "The expiration date of the insurance policy"
      }
    ]
  },

  "Registration": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "fields",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Registration')"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        description: "The expiration date of the registration"
      }
    ]
  },

  "WHMIS/Training Certificates": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "classification-only",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'WHMIS/Training Certificates')"
      }
    ],
    description: "WHMIS training certificates and workplace safety training documents - upload only, just classify document type"
  },

  "Policy Acknowledgments": {
    aiEnabled: true,
    isDefault: true,
    isActive: false,
    extractionMode: "classification-only",
    fields: [
      {
        name: "documentType",
        label: "Document Type",
        type: "text",
        required: true,
        aiExtractable: true,
        description: "The type of document (AI should identify this as 'Policy Acknowledgments')"
      }
    ],
    description: "Policy acknowledgment documents - upload only, just classify document type"
  },

  "Other": {
    aiEnabled: false,
    isDefault: true,
    isActive: false,
    extractionMode: "classification-only",
    fields: [],
    description: "Miscellaneous documents that don't fit other categories - no AI extraction"
  }
};

/**
 * Validates a document type configuration object using Zod schemas
 * @param {Object} config - The document type configuration to validate
 * @param {string} documentTypeName - The name of the document type
 * @returns {Object} { valid: boolean, errors: string[], data?: Object }
 */
export function validateDocumentTypeConfig(config, documentTypeName) {
  const errors = [];

  // Basic structure validation
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  // Validate document type name first
  const nameValidation = documentTypeNameSchema.safeParse(documentTypeName);
  if (!nameValidation.success) {
    errors.push(...nameValidation.error.errors.map(err => err.message));
  }

  // Validate configuration using Zod schema
  const configValidation = documentTypeConfigSchema.safeParse(config);
  if (!configValidation.success) {
    // Format Zod errors for better readability
    configValidation.error.errors.forEach((err) => {
      const path = err.path.join('.');
      const message = err.message;

      // Add field index for array errors
      if (err.path.includes('fields') && err.path.length > 1) {
        const fieldIndex = err.path[1];
        if (typeof fieldIndex === 'number') {
          errors.push(`Field ${fieldIndex + 1}: ${message}`);
        } else {
          errors.push(path ? `${path}: ${message}` : message);
        }
      } else {
        errors.push(path ? `${path}: ${message}` : message);
      }
    });
  }

  // Additional logical validation for classification-only mode
  if (config.extractionMode === 'classification-only' && config.fields) {
    const nonDocTypeFields = config.fields.filter(f => f.name !== 'documentType');
    if (nonDocTypeFields.length > 0) {
      errors.push('classification-only mode should only have documentType field');
    }
  }

  // Check for duplicate field names (enhanced error message)
  if (config.fields && Array.isArray(config.fields)) {
    const fieldNames = config.fields.map(f => f.name).filter(Boolean);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      errors.push(`Duplicate field names found: ${uniqueDuplicates.join(', ')}`);
    }
  }

  // Return validated and sanitized data if successful
  if (errors.length === 0 && configValidation.success) {
    return {
      valid: true,
      errors: [],
      data: configValidation.data // Return sanitized data with unknown fields stripped
    };
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Enhanced validation function that throws on error (for use with try/catch)
 * @param {Object} config - The document type configuration to validate
 * @param {string} documentTypeName - The name of the document type
 * @throws {Error} If validation fails
 * @returns {Object} The validated configuration
 */
export function validateDocumentTypeConfigStrict(config, documentTypeName) {
  // Validate document type name (throws on error)
  documentTypeNameSchema.parse(documentTypeName);

  // Validate configuration
  const validatedConfig = documentTypeConfigSchema.parse(config);

  // Additional logical validation for classification-only mode
  if (validatedConfig.extractionMode === 'classification-only') {
    const nonDocTypeFields = validatedConfig.fields.filter(f => f.name !== 'documentType');
    if (nonDocTypeFields.length > 0) {
      throw new Error('classification-only mode should only have documentType field');
    }
  }

  return validatedConfig;
}

/**
 * Gets the default configuration for a document type by name
 * @param {string} documentTypeName - The name of the document type
 * @returns {Object|null} The default configuration or null if not found
 */
export function getDefaultConfig(documentTypeName) {
  return DEFAULT_DOCUMENT_TYPES[documentTypeName] || null;
}

/**
 * Checks if a document type is a default system type
 * @param {string} documentTypeName - The name of the document type
 * @returns {boolean} True if it's a default type
 */
export function isDefaultType(documentTypeName) {
  return Object.keys(DEFAULT_DOCUMENT_TYPES).includes(documentTypeName);
}

/**
 * Gets all default document type names
 * @returns {string[]} Array of default document type names
 */
export function getAllDefaultTypeNames() {
  return Object.keys(DEFAULT_DOCUMENT_TYPES);
}

/**
 * Merges custom configurations with defaults
 * Used when retrieving company configurations
 * @param {Object} customConfigs - Company's custom configurations
 * @returns {Object} Merged configurations (defaults + custom)
 */
export function mergeWithDefaults(customConfigs = {}) {
  // Start with defaults
  const merged = { ...DEFAULT_DOCUMENT_TYPES };

  // Override with custom configurations
  Object.keys(customConfigs).forEach(typeName => {
    merged[typeName] = customConfigs[typeName];
  });

  return merged;
}
