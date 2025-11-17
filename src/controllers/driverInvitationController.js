import prisma from '../../prisma/client.js';
import crypto from 'crypto';
import { sendDriverInvitationEmail } from '../services/emailService.js';
import { sendDriverInvitationSMS } from '../services/smsService.js';
import { generatePresignedUploadUrl } from '../services/s3Service.js';

/**
 * Generate a secure random token for driver invitation
 */
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create driver invitation and send link
 * POST /api/driver-invitations
 */
export const createDriverInvitation = async (req, res) => {
  try {
    const {
      driverId,
      email,
      phone,
      requestedDocuments,
      sendEmail,
      sendSMS,
    } = req.body;

    // Validate required fields
    if (!driverId || !requestedDocuments || requestedDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID and requested documents are required',
      });
    }

    if (!sendEmail && !sendSMS) {
      return res.status(400).json({
        success: false,
        message: 'At least one notification method (email or SMS) must be selected',
      });
    }

    if (sendEmail && !email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required when sending email notification',
      });
    }

    if (sendSMS && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone is required when sending SMS notification',
      });
    }

    // Get driver details
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        company: true,
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    // Generate secure token
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    // Check if invitation already exists
    const existingInvitation = await prisma.driverInvitation.findUnique({
      where: { driverId },
    });

    let invitation;
    if (existingInvitation) {
      // Update existing invitation
      invitation = await prisma.driverInvitation.update({
        where: { driverId },
        data: {
          token,
          email,
          phone,
          requestedDocuments,
          status: 'PENDING',
          expiresAt,
          emailSentAt: null,
          smsSentAt: null,
        },
      });
    } else {
      // Create new invitation
      invitation = await prisma.driverInvitation.create({
        data: {
          driverId,
          token,
          email,
          phone,
          requestedDocuments,
          expiresAt,
        },
      });
    }

    // Generate upload link
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const uploadLink = `${baseUrl}/driver/upload/${token}`;

    // Send notifications
    let emailSent = false;
    let smsSent = false;
    const errors = [];

    if (sendEmail && email) {
      try {
        await sendDriverInvitationEmail({
          email,
          driverName: driver.name,
          uploadLink,
          requestedDocuments,
          companyName: driver.company.name,
        });
        emailSent = true;

        // Update email sent timestamp
        await prisma.driverInvitation.update({
          where: { id: invitation.id },
          data: {
            emailSentAt: new Date(),
            status: 'SENT',
          },
        });
      } catch (error) {
        console.error('Error sending email:', error);
        errors.push(`Email: ${error.message}`);
      }
    }

    if (sendSMS && phone) {
      try {
        await sendDriverInvitationSMS({
          phone,
          driverName: driver.name,
          uploadLink,
          companyName: driver.company.name,
        });
        smsSent = true;

        // Update SMS sent timestamp
        await prisma.driverInvitation.update({
          where: { id: invitation.id },
          data: {
            smsSentAt: new Date(),
            status: 'SENT',
          },
        });
      } catch (error) {
        console.error('Error sending SMS:', error);
        errors.push(`SMS: ${error.message}`);
      }
    }

    // Return response
    return res.status(200).json({
      success: true,
      message: 'Driver invitation created successfully',
      data: {
        invitationId: invitation.id,
        uploadLink,
        emailSent,
        smsSent,
        errors: errors.length > 0 ? errors : null,
      },
    });
  } catch (error) {
    console.error('Error creating driver invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create driver invitation',
      error: error.message,
    });
  }
};

/**
 * Get driver invitation by token
 * GET /api/driver-invitations/:token
 */
export const getDriverInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.driverInvitation.findUnique({
      where: { token },
      include: {
        driver: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      await prisma.driverInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });

      return res.status(400).json({
        success: false,
        message: 'This invitation link has expired',
      });
    }

    // Update link accessed timestamp and status
    if (!invitation.linkAccessedAt) {
      await prisma.driverInvitation.update({
        where: { id: invitation.id },
        data: {
          linkAccessedAt: new Date(),
          status: 'ACCESSED',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        driverName: invitation.driver.name,
        companyName: invitation.driver.company.name,
        requestedDocuments: invitation.requestedDocuments,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invitation',
      error: error.message,
    });
  }
};

/**
 * Get presigned URLs for driver document uploads (token-based, no auth)
 * POST /api/driver-invitations/:token/presigned-urls
 */
export const getDriverUploadPresignedUrls = async (req, res) => {
  try {
    const { token } = req.params;
    const { files } = req.body;

    // Validate token
    const invitation = await prisma.driverInvitation.findUnique({
      where: { token },
      include: { driver: true },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation token',
      });
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link has expired',
      });
    }

    // Check if already completed
    if (invitation.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been completed',
      });
    }

    // Validate files array
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Files array is required',
      });
    }

    // Generate presigned URLs for each file
    const presignedUrls = await Promise.all(
      files.map(async (file) => {
        const { filename, contentType, documentType } = file;

        // Generate unique S3 key
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `documents/${invitation.driverId}/${documentType}/${timestamp}-${randomString}-${sanitizedFilename}`;

        // Get presigned URL (expires in 15 minutes)
        const uploadUrl = await generatePresignedUploadUrl(key, contentType, 15 * 60);

        return {
          filename,
          key,
          uploadUrl,
          documentType,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: presignedUrls,
    });
  } catch (error) {
    console.error('Error generating presigned URLs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URLs',
      error: error.message,
    });
  }
};

/**
 * Create document records after driver uploads (token-based, no auth)
 * POST /api/driver-invitations/:token/documents
 */
export const createDriverDocuments = async (req, res) => {
  try {
    const { token } = req.params;
    const { documents } = req.body;

    // Validate token
    const invitation = await prisma.driverInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invitation token',
      });
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This invitation link has expired',
      });
    }

    // Validate documents array
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Documents array is required',
      });
    }

    // Create document records
    const createdDocuments = await Promise.all(
      documents.map(async (doc) => {
        const { key, filename, contentType, size, documentType } = doc;

        return await prisma.document.create({
          data: {
            driverId: invitation.driverId,
            s3Key: key,
            fileName: filename,
            fileSize: size,
            mimeType: contentType,
            type: documentType,
            status: 'PENDING', // Will be updated after manual entry or AI scan
            uploadedAt: new Date(),
          },
        });
      })
    );

    return res.status(201).json({
      success: true,
      message: 'Documents created successfully',
      data: {
        documents: createdDocuments,
      },
    });
  } catch (error) {
    console.error('Error creating documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create document records',
      error: error.message,
    });
  }
};

/**
 * Complete driver invitation (after documents are uploaded)
 * PUT /api/driver-invitations/:token/complete
 */
export const completeDriverInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.driverInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    // Update invitation status
    await prisma.driverInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        documentsUploadedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Invitation completed successfully',
    });
  } catch (error) {
    console.error('Error completing invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete invitation',
      error: error.message,
    });
  }
};
