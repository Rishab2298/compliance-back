import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import {
  createTicket,
  getTickets,
  getTicketById,
  addComment,
  reopenTicket,
  getAllTickets,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
  getTicketStats,
  deleteTicket
} from '../controllers/ticketController.js';
import { superAdminMiddleware } from '../middleware/superAdminMiddleware.js';

const router = express.Router();

// Apply Clerk authentication to all routes
router.use(clerkMiddleware());

// ============= CLIENT ROUTES =============
router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.post('/:id/comments', addComment);
router.post('/:id/reopen', reopenTicket);

// ============= SUPER ADMIN ROUTES =============
router.get('/admin/all', superAdminMiddleware, getAllTickets);
router.get('/admin/stats', superAdminMiddleware, getTicketStats);
router.get('/admin/:id', superAdminMiddleware, getTicketById);
router.put('/:id/status', superAdminMiddleware, updateTicketStatus);
router.put('/:id/priority', superAdminMiddleware, updateTicketPriority);
router.put('/:id/assign', superAdminMiddleware, assignTicket);
router.delete('/:id', superAdminMiddleware, deleteTicket);

export default router;
