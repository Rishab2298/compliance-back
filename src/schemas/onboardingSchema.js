import { z } from 'zod';

// Validation helpers
const einRegex = /^\d{2}-\d{7}$/; // Format: XX-XXXXXXX
const canadaBusinessNumberRegex = /^\d{9}$/; // Format: 9 digits

export const onboardingSchema = z.object({
  // Step 1 - Company Information
  legalCompanyName: z.string().min(1, 'Legal company name is required'),
  operatingName: z.string().min(1, 'Operating name (DBA) is required'),
  country: z.enum(['United States', 'Canada'], {
    required_error: 'Please select a country',
  }),
  entityType: z.enum(['Corp', 'Inc', 'LLC', 'Ltd', 'Partnership'], {
    required_error: 'Please select an entity type',
  }),
  businessRegistrationNumber: z.string().min(1, 'Business registration number is required'),
  registeredAddress: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    stateProvince: z.string().min(1, 'State/Province is required'),
    zipPostalCode: z.string().min(1, 'ZIP/Postal code is required'),
  }),
  operatingAddresses: z.array(z.object({
    street: z.string(),
    city: z.string(),
    stateProvince: z.string(),
    zipPostalCode: z.string(),
  })).optional().default([]),
  sameAsRegistered: z.boolean().optional().default(true),
  companyWebsite: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  companySize: z.string().optional(),
  statesProvinces: z.array(z.string()).optional().default([]),
  industryType: z.string().optional(),

  // Step 2 - DSP Verification
  isAmazonDSP: z.boolean(),
  dspCompanyName: z.string().optional(),
  stationCodes: z.array(z.string()).optional().default([]),
  dspOwnerName: z.string().optional(),
  opsManagerName: z.string().optional(),
  dspId: z.string().optional(),
  documents: z.array(z.string()).optional().default(["Driver's License"]),
  reminderDays: z.array(z.string()).optional().default(["90d", "30d", "7d"]),

  // Step 3 - Primary Admin Account
  adminFullName: z.string().min(1, 'Full name is required'),
  adminEmail: z.string().email('Valid email is required'),
  adminPhone: z.string().min(1, 'Mobile number is required'),

  // Step 4 - Billing Setup
  plan: z.enum(['Free', 'Starter', 'Professional', 'Enterprise'], {
    required_error: 'Please select a plan',
  }),
  billingFrequency: z.enum(['monthly', 'yearly']).optional(),
  paymentMethod: z.enum(['card', 'ach', 'pad', 'invoice']).optional(),
  billingContactName: z.string().optional(),
  billingContactEmail: z.string().email('Valid email is required').optional().or(z.literal('')),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    stateProvince: z.string().optional(),
    zipPostalCode: z.string().optional(),
  }).optional(),

  // Step 5 - Legal Consents
  agreeToTerms: z.boolean(),
  agreeToPrivacy: z.boolean(),
  agreeToDataProcessing: z.boolean().optional(),
  agreeToSmsConsent: z.boolean().optional(),
  agreeToSupportAccess: z.boolean().optional().default(false),
  consentTimestamp: z.string().optional(),
  consentIpAddress: z.string().optional(),
  consentVersion: z.string().optional().default('1.0'),
});
