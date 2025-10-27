import { z } from 'zod';

export const onboardingSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companySize: z.string().min(1, 'Company size is required'),
  operatingRegion: z.string().min(1, 'Operating region is required'),
  statesProvinces: z.array(z.string()).min(1, 'At least one state/province is required'),
  industryType: z.string().optional(),
  documents: z.array(z.string()).min(1, 'At least one document type is required'),
  reminderDays: z.array(z.string()),
  notificationMethod: z.enum(['email', 'sms', 'both']),
  notificationRecipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  adminEmail: z.string().email().optional().or(z.literal('')),
  adminPhone: z.string().optional().or(z.literal('')),
  teamMembers: z.array(
    z.object({
      email: z.string().email(),
      role: z.string(),
      name: z.string().optional(),
    })
  ).optional(),
  firstDriverName: z.string().optional(),
  firstDriverContact: z.string().optional(),
}).refine(
  (data) => {
    if (data.notificationMethod === 'email' || data.notificationMethod === 'both') {
      return data.adminEmail && data.adminEmail.length > 0 && z.string().email().safeParse(data.adminEmail).success;
    }
    return true;
  },
  {
    message: 'Valid admin email is required for email notifications',
    path: ['adminEmail'],
  }
).refine(
  (data) => {
    if (data.notificationMethod === 'sms' || data.notificationMethod === 'both') {
      return data.adminPhone && data.adminPhone.length > 0;
    }
    return true;
  },
  {
    message: 'Admin phone is required for SMS notifications',
    path: ['adminPhone'],
  }
);
