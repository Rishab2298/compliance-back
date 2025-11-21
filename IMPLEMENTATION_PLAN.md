# 📋 DYNAMIC DOCUMENT TYPE CONFIGURATION - IMPLEMENTATION GUIDE

**Project:** LogiLink Backend - Document Upload & AI Extraction System
**Date Created:** November 17, 2025
**Author:** Claude (AI Assistant)
**Status:** IMPLEMENTATION PENDING

---

## 📖 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Proposed Changes](#proposed-changes)
4. [Implementation Phases](#implementation-phases)
5. [Detailed Step-by-Step Guide](#detailed-step-by-step-guide)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)
8. [Deployment Checklist](#deployment-checklist)

---

## 🎯 EXECUTIVE SUMMARY

### Objectives
- Enable dynamic document type configuration per company
- Support custom document types with configurable fields
- Implement AI extraction modes: field extraction vs classification-only
- Build bulk AI scan functionality for multiple documents
- Optimize OpenAI token usage with dynamic prompting
- Ensure backward compatibility with existing data

### Key Features
1. **8 Default Document Types** with predefined field configurations
2. **Custom Document Types** - unlimited user-defined types
3. **AI Extraction Toggle** - per document type ON/OFF
4. **Dynamic Field Selection** - choose which fields to extract
5. **Bulk AI Scan** - one-click processing of all pending documents
6. **Smart Credit Management** - charge only when AI is used

### Impact Areas
- ✅ Database Schema (Prisma)
- ✅ AI Extraction Service (textractService.js)
- ✅ Document Controller (documentController.js)
- ✅ Document Type Controller (documentTypeController.js)
- ✅ Routes (documentTypeRoutes.js, documentRoutes.js)
- ✅ Billing Service (credit deduction logic)
- ✅ Audit Service (logging)
- ✅ Frontend Integration Points

---

## 🔍 CURRENT SYSTEM ANALYSIS

### Database Schema (Current)
```prisma
model Company {
  documentTypes String[] @default([])  // Just names, no configuration
}

model Document {
  type              String
  documentNumber    String?
  issueDate         DateTime?
  expiryDate        DateTime?
  aiExtractedData   Json?           // Stores all extracted data
}
```

### Current Flow
1. User uploads document → S3
2. Document created with status `PENDING`
3. User clicks "AI Scan" → Always charges 1 credit
4. Textract extracts OCR → OpenAI parses with FIXED schema
5. Returns ALL fields (even if not needed)
6. User reviews & saves

### Current Limitations
- ❌ No per-type AI configuration
- ❌ Cannot disable AI for certain document types
- ❌ Fixed extraction schema for all documents
- ❌ Wastes tokens on unused fields
- ❌ No bulk scan capability
- ❌ Cannot add custom document types with custom fields

---

## 🚀 PROPOSED CHANGES

### New Database Schema
```prisma
model Company {
  documentTypes       String[] @default([])  // Keep for backward compatibility
  documentTypeConfigs Json?    @default("{}")  // NEW: Detailed configurations
}
```

### Configuration Structure
```json
{
  "Driver's Licence": {
    "aiEnabled": true,
    "isDefault": true,
    "extractionMode": "fields",
    "fields": [
      {
        "name": "province",
        "label": "Province/State",
        "type": "text",
        "required": false,
        "aiExtractable": true
      },
      {
        "name": "class",
        "label": "License Class",
        "type": "text",
        "required": false,
        "aiExtractable": true
      },
      {
        "name": "expiryDate",
        "label": "Expiry Date",
        "type": "date",
        "required": true,
        "aiExtractable": true
      }
    ]
  },
  "WHMIS/Training Certificates": {
    "aiEnabled": true,
    "isDefault": true,
    "extractionMode": "classification-only",
    "fields": []
  }
}
```

### New Endpoints
```
GET    /api/settings/document-types              # Get all configurations
GET    /api/settings/document-types/:typeName    # Get specific config
POST   /api/settings/document-types              # Create custom type
PUT    /api/settings/document-types/:typeName    # Update configuration
DELETE /api/settings/document-types/:typeName    # Delete custom type
GET    /api/settings/field-types                 # Get available field types
POST   /api/documents/bulk-scan-all/:driverId    # Bulk scan all pending docs
```

---

## 📅 IMPLEMENTATION PHASES

### Phase 1: Database & Configuration (Days 1-2)
- Update Prisma schema
- Create migration
- Build default document type configurations
- Create utility functions

### Phase 2: Backend API - Configuration Management (Days 3-4)
- Update documentTypeController
- Add new routes for settings
- Implement CRUD operations for document type configs
- Add validation logic

### Phase 3: AI Extraction Enhancement (Days 5-6)
- Update textractService with dynamic prompting
- Add classification-only mode
- Update documentController AI scan logic
- Implement credit checking with aiEnabled flag

### Phase 4: Bulk Scan Implementation (Days 7-8)
- Build bulk scan endpoint
- Add progress tracking
- Implement parallel processing
- Add error handling

### Phase 5: Testing & Integration (Days 9-10)
- Unit tests for all new endpoints
- Integration tests for AI extraction
- Test bulk scan with mixed document types
- Test backward compatibility

### Phase 6: Documentation & Deployment (Day 11)
- API documentation
- Frontend integration guide
- Deployment to staging
- Final testing

---

## 📝 DETAILED STEP-BY-STEP GUIDE

---

### PHASE 1: DATABASE & CONFIGURATION

#### STEP 1.1: Create Utility File for Default Types
**File:** `src/utils/documentTypeDefaults.js`

**Action:** CREATE NEW FILE

```javascript
/**
 * Default Document Type Configurations
 * These are the 8 pre-configured document types for all companies
 */

export const DEFAULT_DOCUMENT_TYPES = {
  "Driver's Licence": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Driver's license or permit from any province/state",
    fields: [
      {
        name: "province",
        label: "Province/State",
        type: "text",
        required: false,
        aiExtractable: true,
        helpText: "The issuing province or state"
      },
      {
        name: "class",
        label: "License Class",
        type: "text",
        required: false,
        aiExtractable: true,
        helpText: "License class (e.g., G, D, CDL-A)"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        helpText: "When the license expires"
      }
    ]
  },
  "Driver Abstract": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Driving record abstract showing violations and points",
    fields: [
      {
        name: "nextReviewDate",
        label: "Next Review Date",
        type: "date",
        required: true,
        aiExtractable: true,
        helpText: "When the abstract should be reviewed next"
      }
    ]
  },
  "Work Eligibility": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Work permit, citizenship, or permanent residency documents",
    fields: [
      {
        name: "eligibilityStatus",
        label: "Status",
        type: "select",
        required: true,
        aiExtractable: true,
        options: ["Citizen", "Permanent Resident", "Work Permit"],
        helpText: "Type of work authorization"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: false,
        aiExtractable: true,
        helpText: "Expiry date (if applicable for permits)"
      }
    ]
  },
  "Background Check": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Criminal background check or police clearance",
    fields: [
      {
        name: "status",
        label: "Background Check Status",
        type: "select",
        required: true,
        aiExtractable: true,
        options: ["Clear", "Pending", "Conditional", "Failed"],
        helpText: "Result of the background check"
      },
      {
        name: "checkDate",
        label: "Check Date",
        type: "date",
        required: false,
        aiExtractable: true,
        helpText: "When the background check was performed"
      }
    ]
  },
  "Insurance": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Vehicle insurance policy documents",
    fields: [
      {
        name: "policyNumber",
        label: "Policy Number",
        type: "text",
        required: false,
        aiExtractable: true,
        helpText: "Insurance policy number"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        helpText: "When the insurance policy expires"
      }
    ]
  },
  "Registration": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "fields",
    description: "Vehicle registration documents",
    fields: [
      {
        name: "registrationNumber",
        label: "Registration Number",
        type: "text",
        required: false,
        aiExtractable: true,
        helpText: "Vehicle registration number"
      },
      {
        name: "expiryDate",
        label: "Expiry Date",
        type: "date",
        required: true,
        aiExtractable: true,
        helpText: "When the registration expires"
      }
    ]
  },
  "WHMIS/Training Certificates": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "classification-only",
    description: "Workplace safety and training certificates (upload only, AI classifies type)",
    fields: []
  },
  "Policy Acknowledgments": {
    aiEnabled: true,
    isDefault: true,
    extractionMode: "classification-only",
    description: "Signed policy acknowledgment documents (upload only, AI classifies type)",
    fields: []
  }
};

/**
 * Available field types for custom document types
 */
export const FIELD_TYPES = [
  {
    value: "text",
    label: "Text",
    description: "Single line text input"
  },
  {
    value: "textarea",
    label: "Long Text",
    description: "Multi-line text area"
  },
  {
    value: "number",
    label: "Number",
    description: "Numeric value"
  },
  {
    value: "date",
    label: "Date",
    description: "Date picker (YYYY-MM-DD)"
  },
  {
    value: "select",
    label: "Dropdown",
    description: "Select from predefined options"
  },
  {
    value: "boolean",
    label: "Yes/No",
    description: "Checkbox or toggle"
  }
];

/**
 * Validation rules for document type configuration
 */
export const validateDocumentTypeConfig = (config) => {
  const errors = [];

  if (!config.extractionMode || !['fields', 'classification-only'].includes(config.extractionMode)) {
    errors.push('extractionMode must be either "fields" or "classification-only"');
  }

  if (typeof config.aiEnabled !== 'boolean') {
    errors.push('aiEnabled must be a boolean');
  }

  if (config.extractionMode === 'fields' && (!config.fields || !Array.isArray(config.fields))) {
    errors.push('fields must be an array when extractionMode is "fields"');
  }

  if (config.fields) {
    config.fields.forEach((field, index) => {
      if (!field.name) {
        errors.push(`Field at index ${index} is missing a name`);
      }
      if (!field.type || !FIELD_TYPES.find(ft => ft.value === field.type)) {
        errors.push(`Field "${field.name}" has invalid type`);
      }
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        errors.push(`Field "${field.name}" is of type "select" but has no options`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
```

**Verification Checkpoint:**
```bash
# Test the utility file can be imported
node -e "import('./src/utils/documentTypeDefaults.js').then(m => console.log(Object.keys(m.DEFAULT_DOCUMENT_TYPES)))"
# Should output: [ "Driver's Licence", "Driver Abstract", ... ]
```

---

#### STEP 1.2: Update Prisma Schema
**File:** `prisma/schema.prisma`

**Action:** UPDATE EXISTING

**Find:** (Around line 60)
```prisma
  documentTypes          String[] @default([])
  reminderDays           String[] @default([])
```

**Replace with:**
```prisma
  documentTypes          String[] @default([])  // Kept for backward compatibility
  documentTypeConfigs    Json?    @default("{}")  // NEW: Detailed configurations
  reminderDays           String[] @default([])
```

**Verification Checkpoint:**
```bash
# Validate Prisma schema
npx prisma validate

# Check for syntax errors
npx prisma format
```

---

#### STEP 1.3: Create Database Migration
**Action:** CREATE MIGRATION

```bash
# Generate migration
npx prisma migrate dev --name add_document_type_configs

# This will:
# 1. Create a new migration file
# 2. Add the documentTypeConfigs column to Company table
# 3. Default value will be "{}" for existing companies
```

**Expected Output:**
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251117XXXXXX_add_document_type_configs/
    └─ migration.sql
```

**Verification Checkpoint:**
```bash
# Check migration was created
ls -la prisma/migrations/

# Verify database schema
npx prisma db pull

# Test Prisma Client generation
npx prisma generate
```

---

#### STEP 1.4: Create Data Migration Script
**File:** `src/scripts/migrateDocumentTypeConfigs.js`

**Action:** CREATE NEW FILE

```javascript
import prisma from '../../prisma/client.js';
import { DEFAULT_DOCUMENT_TYPES } from '../utils/documentTypeDefaults.js';

/**
 * Data Migration Script: Populate documentTypeConfigs for existing companies
 * This script should be run ONCE after the schema migration
 *
 * Usage: node src/scripts/migrateDocumentTypeConfigs.js
 */

async function migrateDocumentTypeConfigs() {
  console.log('🔄 Starting data migration for documentTypeConfigs...\n');

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        documentTypes: true,
        documentTypeConfigs: true
      }
    });

    console.log(`📊 Found ${companies.length} companies to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const company of companies) {
      // Skip if already has documentTypeConfigs
      if (company.documentTypeConfigs &&
          Object.keys(company.documentTypeConfigs).length > 0) {
        console.log(`⏭️  Skipping ${company.name} - already has configurations`);
        skippedCount++;
        continue;
      }

      // Build config from existing documentTypes or use defaults
      const config = { ...DEFAULT_DOCUMENT_TYPES };

      // If company has custom documentTypes in the old array, preserve them
      if (company.documentTypes && company.documentTypes.length > 0) {
        company.documentTypes.forEach(typeName => {
          if (!config[typeName]) {
            // Add as custom type with basic configuration
            config[typeName] = {
              aiEnabled: true,
              isDefault: false,
              extractionMode: "fields",
              description: `Custom document type: ${typeName}`,
              fields: [
                {
                  name: "expiryDate",
                  label: "Expiry Date",
                  type: "date",
                  required: false,
                  aiExtractable: true
                }
              ]
            };
          }
        });
      }

      // Update company with new configuration
      await prisma.company.update({
        where: { id: company.id },
        data: {
          documentTypeConfigs: config
        }
      });

      console.log(`✅ Migrated ${company.name} - Added ${Object.keys(config).length} document types`);
      migratedCount++;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} companies`);
    console.log(`   ⏭️  Skipped: ${skippedCount} companies (already configured)`);
    console.log(`   📁 Total: ${companies.length} companies\n`);

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateDocumentTypeConfigs()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
```

**Verification Checkpoint:**
```bash
# Run the migration script
node src/scripts/migrateDocumentTypeConfigs.js

# Verify in database
npx prisma studio
# Check a company's documentTypeConfigs field - should have 8 default types
```

---

### PHASE 2: BACKEND API - CONFIGURATION MANAGEMENT

#### STEP 2.1: Update Document Type Controller
**File:** `src/controllers/documentTypeController.js`

**Action:** REPLACE ENTIRE FILE

```javascript
import prisma from '../../prisma/client.js';
import { DEFAULT_DOCUMENT_TYPES, FIELD_TYPES, validateDocumentTypeConfig } from '../utils/documentTypeDefaults.js';

/**
 * ========================================
 * DOCUMENT TYPE CONFIGURATION CONTROLLER
 * ========================================
 * Manages document type configurations including:
 * - Default 8 document types
 * - Custom user-defined types
 * - Field configurations
 * - AI extraction settings
 */

/**
 * Get all document type configurations for a company
 * GET /api/settings/document-types
 */
export const getAllDocumentTypeConfigs = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get company configurations
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true }
    });

    const configs = company?.documentTypeConfigs || DEFAULT_DOCUMENT_TYPES;

    return res.status(200).json({
      success: true,
      data: configs
    });

  } catch (error) {
    console.error('Error fetching document type configurations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get a specific document type configuration
 * GET /api/settings/document-types/:typeName
 */
export const getDocumentTypeConfig = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { typeName } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true }
    });

    const configs = company?.documentTypeConfigs || {};
    const config = configs[typeName];

    if (!config) {
      return res.status(404).json({
        error: 'Document type not found',
        message: `No configuration found for "${typeName}"`
      });
    }

    return res.status(200).json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Error fetching document type configuration:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Create a new custom document type
 * POST /api/settings/document-types
 * Body: { name, aiEnabled, extractionMode, fields, description }
 */
export const createCustomDocumentType = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { name, aiEnabled, extractionMode, fields, description } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Document type name is required'
      });
    }

    // Build configuration object
    const newConfig = {
      aiEnabled: aiEnabled !== undefined ? aiEnabled : true,
      isDefault: false,  // Custom types are never default
      extractionMode: extractionMode || 'fields',
      description: description || `Custom document type: ${name}`,
      fields: fields || []
    };

    // Validate configuration
    const validation = validateDocumentTypeConfig(newConfig);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document type configuration',
        errors: validation.errors
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get current configurations
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true }
    });

    const currentConfigs = company?.documentTypeConfigs || {};

    // Check if type already exists
    if (currentConfigs[name.trim()]) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Document type "${name.trim()}" already exists`
      });
    }

    // Add new type
    const updatedConfigs = {
      ...currentConfigs,
      [name.trim()]: newConfig
    };

    // Update company
    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Custom document type created successfully',
      data: {
        name: name.trim(),
        config: newConfig
      }
    });

  } catch (error) {
    console.error('Error creating custom document type:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Update a document type configuration
 * PUT /api/settings/document-types/:typeName
 * Body: { aiEnabled, extractionMode, fields, description }
 */
export const updateDocumentTypeConfig = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { typeName } = req.params;
    const { aiEnabled, extractionMode, fields, description } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true }
    });

    const currentConfigs = company?.documentTypeConfigs || {};

    if (!currentConfigs[typeName]) {
      return res.status(404).json({
        error: 'Not found',
        message: `Document type "${typeName}" not found`
      });
    }

    // Build updated configuration
    const updatedConfig = {
      ...currentConfigs[typeName],
      ...(aiEnabled !== undefined && { aiEnabled }),
      ...(extractionMode && { extractionMode }),
      ...(fields && { fields }),
      ...(description && { description })
    };

    // Validate updated configuration
    const validation = validateDocumentTypeConfig(updatedConfig);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid document type configuration',
        errors: validation.errors
      });
    }

    // Update
    const updatedConfigs = {
      ...currentConfigs,
      [typeName]: updatedConfig
    };

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: updatedConfigs
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Document type configuration updated successfully',
      data: updatedConfig
    });

  } catch (error) {
    console.error('Error updating document type configuration:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Delete a custom document type
 * DELETE /api/settings/document-types/:typeName
 * Note: Cannot delete default types
 */
export const deleteCustomDocumentType = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { typeName } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { documentTypeConfigs: true }
    });

    const currentConfigs = company?.documentTypeConfigs || {};

    if (!currentConfigs[typeName]) {
      return res.status(404).json({
        error: 'Not found',
        message: `Document type "${typeName}" not found`
      });
    }

    // Prevent deletion of default types
    if (currentConfigs[typeName].isDefault) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot delete default document types. You can only disable them.'
      });
    }

    // Remove the type
    const { [typeName]: removed, ...remainingConfigs } = currentConfigs;

    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        documentTypeConfigs: remainingConfigs
      }
    });

    return res.status(200).json({
      success: true,
      message: `Document type "${typeName}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting document type:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get available field types
 * GET /api/settings/field-types
 */
export const getAvailableFieldTypes = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: FIELD_TYPES
    });
  } catch (error) {
    console.error('Error fetching field types:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// ========================================
// LEGACY ENDPOINTS (Keep for backward compatibility)
// ========================================

export const getDocumentTypes = async (req, res) => {
  // Redirect to new endpoint
  return getAllDocumentTypeConfigs(req, res);
};

export const getDocumentType = async (req, res) => {
  // Redirect to new endpoint
  return getDocumentTypeConfig(req, res);
};

export const createDocumentType = async (req, res) => {
  // Redirect to new endpoint
  return createCustomDocumentType(req, res);
};

export const updateDocumentType = async (req, res) => {
  // Redirect to new endpoint
  return updateDocumentTypeConfig(req, res);
};

export const deleteDocumentType = async (req, res) => {
  // Redirect to new endpoint
  return deleteCustomDocumentType(req, res);
};
```

**Verification Checkpoint:**
```bash
# Check for syntax errors
node --check src/controllers/documentTypeController.js

# Restart server and test
npm run dev

# Test endpoint (replace with actual auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5003/api/settings/document-types
```

---

### CONTINUE ON NEXT RESPONSE...

This document continues with:
- STEP 2.2: Update Routes
- STEP 2.3: Add Settings Routes
- PHASE 3: AI Extraction Enhancement
- PHASE 4: Bulk Scan Implementation
- PHASE 5: Testing Strategy
- PHASE 6: Deployment Checklist

Should I continue writing the rest of the implementation document?

#### STEP 2.2: Create Settings Routes
**File:** `src/routes/settingsRoutes.js`

**Action:** CREATE NEW FILE

```javascript
import express from 'express';
import {
  getAllDocumentTypeConfigs,
  getDocumentTypeConfig,
  createCustomDocumentType,
  updateDocumentTypeConfig,
  deleteCustomDocumentType,
  getAvailableFieldTypes
} from '../controllers/documentTypeController.js';
import { requireCapability } from '../middleware/dspPermissionMiddleware.js';

const router = express.Router();

/**
 * Settings Routes - Document Type Configuration
 * All routes require authentication and manage_company_settings capability
 */

// Get all document type configurations
router.get('/document-types', requireCapability("manage_company_settings"), getAllDocumentTypeConfigs);

// Get available field types
router.get('/field-types', requireCapability("manage_company_settings"), getAvailableFieldTypes);

// Get specific document type configuration
router.get('/document-types/:typeName', requireCapability("manage_company_settings"), getDocumentTypeConfig);

// Create custom document type
router.post('/document-types', requireCapability("manage_company_settings"), createCustomDocumentType);

// Update document type configuration
router.put('/document-types/:typeName', requireCapability("manage_company_settings"), updateDocumentTypeConfig);

// Delete custom document type
router.delete('/document-types/:typeName', requireCapability("manage_company_settings"), deleteCustomDocumentType);

export default router;
```

**Verification Checkpoint:**
```bash
node --check src/routes/settingsRoutes.js
```

---

#### STEP 2.3: Register Settings Routes in Server
**File:** `src/server.js`

**Action:** UPDATE EXISTING

**Find:** (Around line 22)
```javascript
import auditLogRoutes from "./routes/auditLogRoutes.js";
import systemMetricsRoutes from "./routes/systemMetricsRoutes.js";
```

**Add After:**
```javascript
import settingsRoutes from "./routes/settingsRoutes.js";
```

**Find:** (Around line 110)
```javascript
// Audit log routes (protected by auth + DSP permissions + policies)
app.use("/api/audit-logs", authMiddleware, requirePolicyAcceptance, auditLogRoutes);
```

**Add After:**
```javascript
// Settings routes (protected by auth + DSP permissions + policies)
app.use("/api/settings", authMiddleware, requirePolicyAcceptance, settingsRoutes);
```

**Verification Checkpoint:**
```bash
# Restart server
npm run dev

# Check routes are registered
curl http://localhost:5003/api/settings/field-types
# Should return 401 (not authenticated) - this is correct
```

---

### PHASE 3: AI EXTRACTION ENHANCEMENT

#### STEP 3.1: Create Dynamic Prompt Builder
**File:** `src/services/promptBuilder.js`

**Action:** CREATE NEW FILE

```javascript
/**
 * Dynamic OpenAI Prompt Builder
 * Generates optimized prompts based on document type configuration
 */

/**
 * Build a customized OpenAI prompt for document extraction
 * @param {Object} documentTypeConfig - Configuration for the document type
 * @param {string} documentTypeName - Name of the document type
 * @returns {Object} { systemPrompt, userPrompt (function) }
 */
export const buildDynamicPrompt = (documentTypeConfig, documentTypeName) => {
  const { extractionMode, fields } = documentTypeConfig;

  // MODE 1: Classification only (minimal extraction)
  if (extractionMode === "classification-only") {
    return {
      systemPrompt: `You are a document classifier specialized in identifying ${documentTypeName} documents.

Your task is to analyze OCR text and confirm the document type.

IMPORTANT:
- Be precise in identifying the exact document type
- Look for key indicators like headers, logos, official stamps
- Return ONLY the document type classification

Return JSON format: { "type": "exact document type name" }`,
      
      userPrompt: (textractData) => 
        `Document OCR Text:\n${JSON.stringify(textractData, null, 2)}\n\nClassify this document and return ONLY JSON with the type.`
    };
  }

  // MODE 2: Field extraction (dynamic based on configured fields)
  if (extractionMode === "fields") {
    // Build field descriptions for the prompt
    const fieldDescriptions = fields
      .filter(f => f.aiExtractable)
      .map((field, index) => {
        let description = `${index + 1}. ${field.name}`;
        
        // Add type-specific instructions
        if (field.type === 'date') {
          description += ` (date in YYYY-MM-DD format)`;
        } else if (field.type === 'number') {
          description += ` (numeric value only, no units)`;
        } else if (field.type === 'select' && field.options) {
          description += ` (must be one of: ${field.options.join(', ')})`;
        } else if (field.type === 'boolean') {
          description += ` (true or false)`;
        } else {
          description += ` (text)`;
        }
        
        // Add label as hint
        description += `: ${field.label}`;
        
        // Add help text if available
        if (field.helpText) {
          description += `\n   Hint: ${field.helpText}`;
        }
        
        return description;
      })
      .join('\n');

    // Build schema for JSON output
    const schema = {};
    fields.forEach(field => {
      if (field.aiExtractable) {
        if (field.type === 'number') {
          schema[field.name] = 0;
        } else if (field.type === 'boolean') {
          schema[field.name] = false;
        } else {
          schema[field.name] = '';
        }
      }
    });

    return {
      systemPrompt: `You are a data extraction specialist for ${documentTypeName} documents.

Extract ONLY the following ${fields.filter(f => f.aiExtractable).length} field(s):

${fieldDescriptions}

CRITICAL RULES:
- Use YYYY-MM-DD format for ALL dates
- Return ONLY the requested fields, nothing extra
- If a field is not found in the document, use empty string for text, 0 for numbers, false for booleans
- For select fields, MUST use one of the provided options exactly as written
- Be precise and extract exactly what is shown in the document
- Do not infer or guess - only extract visible information

The document type is: ${documentTypeName}`,

      userPrompt: (textractData) => 
        `Expected JSON schema:
${JSON.stringify(schema, null, 2)}

OCR Data extracted from the document:
${JSON.stringify(textractData, null, 2)}

Extract the specified fields and return ONLY valid JSON matching the schema above.`
    };
  }

  // Fallback (should never reach here)
  throw new Error(`Invalid extraction mode: ${extractionMode}`);
};

/**
 * Calculate estimated tokens for a prompt
 * Rough estimation: 1 token ≈ 4 characters
 */
export const estimateTokens = (text) => {
  return Math.ceil(text.length / 4);
};
```

**Verification Checkpoint:**
```bash
node --check src/services/promptBuilder.js
```

---

#### STEP 3.2: Update Textract Service
**File:** `src/services/textractService.js`

**Action:** REPLACE WITH UPDATED VERSION

```javascript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { buildDynamicPrompt, estimateTokens } from './promptBuilder.js';

// Initialize Lambda client
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION,
  endpoint: `https://lambda.${process.env.AWS_REGION}.amazonaws.com`,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Invoke AWS Textract Lambda to extract document data
 * @param {string} s3Key - S3 object key
 * @returns {Promise<Object>} Extracted text data from Textract
 */
export const extractDocumentData = async (s3Key) => {
  try {
    console.log(`📄 Starting Textract extraction for: ${s3Key}`);
    
    const lambdaResponse = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        Payload: Buffer.from(
          JSON.stringify({
            bucket: process.env.AWS_S3_BUCKET_NAME,
            key: s3Key,
          })
        ),
      })
    );

    const result = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());
    const textractData = JSON.parse(result.body);

    console.log(`✅ Textract extraction complete`);
    return textractData;
    
  } catch (error) {
    console.error('❌ Textract extraction error:', error);
    throw new Error(`Failed to extract document data: ${error.message}`);
  }
};

/**
 * Parse Textract data using OpenAI with dynamic prompting
 * @param {Object} textractData - Raw Textract output
 * @param {Object} documentTypeConfig - Configuration for this document type
 * @param {string} documentTypeName - Name of the document type
 * @returns {Promise<Object>} { parsedData, usage }
 */
export const parseWithAIDynamic = async (textractData, documentTypeConfig, documentTypeName) => {
  try {
    // Import OpenAI dynamically
    const { default: OpenAI } = await import('openai');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build custom prompt for this document type configuration
    const { systemPrompt, userPrompt } = buildDynamicPrompt(documentTypeConfig, documentTypeName);

    // Log token estimation
    const estimatedPromptTokens = estimateTokens(systemPrompt + userPrompt(textractData));
    console.log(`📊 Estimated prompt tokens: ~${estimatedPromptTokens}`);

    const startTime = Date.now();

    // Call OpenAI with dynamic prompts
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt(textractData)
        }
      ],
      temperature: 0,  // Deterministic output
      response_format: { type: 'json_object' }
    });

    const requestDuration = Date.now() - startTime;
    const parsedData = JSON.parse(gptResponse.choices[0].message.content);

    // Log extraction results
    console.log(`✅ AI Extraction Complete for ${documentTypeName}:`, {
      mode: documentTypeConfig.extractionMode,
      fieldsExtracted: Object.keys(parsedData).length,
      promptTokens: gptResponse.usage.prompt_tokens,
      completionTokens: gptResponse.usage.completion_tokens,
      totalTokens: gptResponse.usage.total_tokens,
      duration: `${requestDuration}ms`
    });

    return {
      parsedData,
      usage: {
        promptTokens: gptResponse.usage.prompt_tokens,
        completionTokens: gptResponse.usage.completion_tokens,
        totalTokens: gptResponse.usage.total_tokens,
        model: gptResponse.model,
        requestDuration
      }
    };

  } catch (error) {
    console.error('❌ AI parsing error:', error);
    throw new Error(`Failed to parse document data: ${error.message}`);
  }
};

/**
 * LEGACY FUNCTION - Keep for backward compatibility
 * @deprecated Use parseWithAIDynamic instead
 */
export const parseWithAI = async (textractData, documentType = 'Driver\'s License') => {
  console.warn('⚠️  Using legacy parseWithAI function. Consider migrating to parseWithAIDynamic.');
  
  // Use a basic default configuration for legacy calls
  const legacyConfig = {
    extractionMode: 'fields',
    fields: [
      { name: 'type', type: 'text', aiExtractable: true, label: 'Document Type' },
      { name: 'documentNumber', type: 'text', aiExtractable: true, label: 'Document Number' },
      { name: 'issuedDate', type: 'date', aiExtractable: true, label: 'Issue Date' },
      { name: 'expiryDate', type: 'date', aiExtractable: true, label: 'Expiry Date' },
      { name: 'firstName', type: 'text', aiExtractable: true, label: 'First Name' },
      { name: 'lastName', type: 'text', aiExtractable: true, label: 'Last Name' }
    ]
  };

  return parseWithAIDynamic(textractData, legacyConfig, documentType);
};
```

**Verification Checkpoint:**
```bash
node --check src/services/textractService.js
node --check src/services/promptBuilder.js
```

---

CONTINUE TO NEXT MESSAGE FOR PHASE 4 (BULK SCAN) AND TESTING...

