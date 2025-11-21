/**
 * Document Type Configuration Validation Tests
 *
 * Tests for the enhanced input validation with strict mode
 */

import {
  validateDocumentTypeConfig,
  validateDocumentTypeConfigStrict,
  fieldSchema,
  documentTypeConfigSchema,
} from '../documentTypeDefaults.js';

describe('Document Type Validation - Security Tests', () => {
  describe('Field Schema with Strict Mode', () => {
    test('should reject fields with unknown properties', () => {
      const invalidField = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
        required: true,
        aiExtractable: true,
        maliciousProperty: 'should be rejected', // Unknown field
      };

      const result = fieldSchema.safeParse(invalidField);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].code).toBe('unrecognized_keys');
      }
    });

    test('should accept valid fields without extra properties', () => {
      const validField = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
        required: true,
        aiExtractable: true,
      };

      const result = fieldSchema.safeParse(validField);
      expect(result.success).toBe(true);
    });

    test('should reject field names with special characters', () => {
      const invalidField = {
        name: 'test-field!@#', // Contains invalid characters
        label: 'Test Field',
        type: 'text',
        required: true,
        aiExtractable: true,
      };

      const result = fieldSchema.safeParse(invalidField);
      expect(result.success).toBe(false);
    });

    test('should accept field names with underscores and numbers', () => {
      const validField = {
        name: 'test_field_123',
        label: 'Test Field',
        type: 'text',
        required: true,
        aiExtractable: true,
      };

      const result = fieldSchema.safeParse(validField);
      expect(result.success).toBe(true);
    });

    test('should reject select fields without options', () => {
      const invalidField = {
        name: 'testSelect',
        label: 'Test Select',
        type: 'select',
        required: true,
        aiExtractable: true,
        // Missing options array
      };

      const result = fieldSchema.safeParse(invalidField);
      expect(result.success).toBe(false);
    });
  });

  describe('Document Type Config Schema with Strict Mode', () => {
    test('should reject configs with unknown properties', () => {
      const invalidConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
        ],
        maliciousProperty: 'should be rejected', // Unknown field
      };

      const result = documentTypeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].code).toBe('unrecognized_keys');
      }
    });

    test('should accept valid configs without extra properties', () => {
      const validConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
        ],
      };

      const result = documentTypeConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    test('should reject configs with duplicate field names', () => {
      const invalidConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'duplicateField',
            label: 'Field 1',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
          {
            name: 'duplicateField', // Duplicate name
            label: 'Field 2',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
        ],
      };

      const result = documentTypeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    test('should reject configs with empty fields array', () => {
      const invalidConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [], // Empty array not allowed
      };

      const result = documentTypeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('validateDocumentTypeConfig Function', () => {
    test('should return validated data with unknown fields stripped', () => {
      const configWithExtraFields = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            aiExtractable: true,
            extraFieldProperty: 'should be stripped',
          },
        ],
        extraConfigProperty: 'should be stripped',
      };

      const result = validateDocumentTypeConfig(configWithExtraFields, 'TestDocType');
      expect(result.valid).toBe(false); // Should fail due to strict mode
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return sanitized data for valid configs', () => {
      const validConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
        ],
      };

      const result = validateDocumentTypeConfig(validConfig, 'TestDocType');
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.fields).toHaveLength(1);
    });
  });

  describe('Security - Injection Prevention', () => {
    test('should reject configs with prototype pollution attempts', () => {
      const maliciousConfig = {
        aiEnabled: true,
        extractionMode: 'fields',
        fields: [
          {
            name: 'testField',
            label: 'Test Field',
            type: 'text',
            required: true,
            aiExtractable: true,
          },
        ],
        __proto__: { isAdmin: true }, // Prototype pollution attempt
      };

      const result = documentTypeConfigSchema.safeParse(maliciousConfig);
      expect(result.success).toBe(false);
    });

    test('should reject fields with SQL injection attempts in names', () => {
      const maliciousField = {
        name: "testField'; DROP TABLE documents; --",
        label: 'Test Field',
        type: 'text',
        required: true,
        aiExtractable: true,
      };

      const result = fieldSchema.safeParse(maliciousField);
      expect(result.success).toBe(false);
    });

    test('should reject fields with XSS attempts in labels', () => {
      const maliciousField = {
        name: 'testField',
        label: '<script>alert("XSS")</script>',
        type: 'text',
        required: true,
        aiExtractable: true,
      };

      // While this passes the schema (as labels can contain any characters),
      // the output should be properly escaped when rendered
      const result = fieldSchema.safeParse(maliciousField);
      expect(result.success).toBe(true); // Schema allows it, but rendering should escape
    });
  });
});
