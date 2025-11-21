import express from 'express';
import {
  createDriverInvitation,
  getDriverInvitationByToken,
  getDriverUploadPresignedUrls,
  createDriverDocuments,
  completeDriverInvitation,
} from '../controllers/driverInvitationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create driver invitation and send link (requires authentication)
router.post('/', requireAuth, createDriverInvitation);

// Get invitation by token (public route - no auth required)
router.get('/:token', getDriverInvitationByToken);

// Get presigned URLs for document uploads (public route - token auth)
router.post('/:token/presigned-urls', getDriverUploadPresignedUrls);

// Create document records after upload (public route - token auth)
router.post('/:token/documents', createDriverDocuments);

// Complete invitation after document upload
router.put('/:token/complete', completeDriverInvitation);

export default router;
