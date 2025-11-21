import prisma from '../../prisma/client.js';
import { z } from 'zod';
import auditService from '../services/auditService.js';

// Validation schema for creating a ticket
const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'SUPPORT', 'DOCUMENTATION', 'PERFORMANCE', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  attachments: z.array(z.object({
    url: z.string(),
    key: z.string(),
    filename: z.string(),
    uploadedAt: z.string()
  })).optional(),
  metadata: z.object({
    browser: z.string().optional(),
    pageUrl: z.string().optional(),
    userAgent: z.string().optional()
  }).optional()
});

/**
 * Generate next ticket number
 */
const generateTicketNumber = async () => {
  const lastTicket = await prisma.ticket.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { ticketNumber: true }
  });

  if (!lastTicket) {
    return 'TKT-00001';
  }

  const lastNumber = parseInt(lastTicket.ticketNumber.split('-')[1]);
  const nextNumber = (lastNumber + 1).toString().padStart(5, '0');
  return `TKT-${nextNumber}`;
};

/**
 * Create a new ticket (Client)
 * POST /api/tickets
 */
export const createTicket = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Validate request body
    const validatedData = createTicketSchema.parse(req.body);

    // Get user and company
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Generate ticket number
    const ticketNumber = await generateTicketNumber();

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        companyId: user.companyId,
        reportedById: user.id,
        reporterName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        reporterEmail: user.email,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        priority: validatedData.priority,
        attachments: validatedData.attachments || [],
        metadata: validatedData.metadata || {},
        status: 'OPEN'
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    });

    // Log ticket creation
    await auditService.logTicketOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: 'TICKET_CREATED',
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      metadata: {
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get tickets for current user's company (Client)
 * GET /api/tickets?page=1&limit=20&status=OPEN&priority=HIGH&search=bug
 */
export const getTickets = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { page = 1, limit = 20, status, priority, category, search } = req.query;

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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {
      companyId: user.companyId
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch tickets and count
    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.ticket.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get single ticket by ID (Client)
 * GET /api/tickets/:id
 */
export const getTicketById = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { companyId: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Super admins don't need a company ID
    if (user.role !== 'SUPER_ADMIN' && !user.companyId) {
      return res.status(404).json({ error: 'User company not found' });
    }

    // Fetch ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        comments: {
          where: user.role === 'SUPER_ADMIN' ? {} : { isInternal: false },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify access (client can only access their company's tickets)
    if (user.role !== 'SUPER_ADMIN' && ticket.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to ticket' });
    }

    return res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Add comment to ticket
 * POST /api/tickets/:id/comments
 */
export const addComment = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id: ticketId } = req.params;
    const { comment, attachments = [], isInternal = false } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { companyId: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify access
    if (user.role !== 'SUPER_ADMIN' && ticket.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to ticket' });
    }

    // Only super admins can create internal comments
    const commentIsInternal = user.role === 'SUPER_ADMIN' ? isInternal : false;

    // Create comment
    const newComment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role,
        comment,
        attachments,
        isInternal: commentIsInternal
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Reopen a ticket (Client)
 * POST /api/tickets/:id/reopen
 */
export const reopenTicket = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    if (!user || !user.companyId) {
      return res.status(404).json({ error: 'User or company not found' });
    }

    // Get ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify access
    if (ticket.companyId !== user.companyId) {
      return res.status(403).json({ error: 'Unauthorized access to ticket' });
    }

    // Check if ticket can be reopened
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
      return res.status(400).json({ error: 'Only resolved or closed tickets can be reopened' });
    }

    // Reopen ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'REOPENED',
        resolvedAt: null,
        resolvedById: null,
        resolutionNotes: null
      }
    });

    // Add comment about reopening
    if (reason) {
      await prisma.ticketComment.create({
        data: {
          ticketId: id,
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          userRole: user.role,
          comment: `Ticket reopened: ${reason}`,
          isInternal: false
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket reopened successfully',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Error reopening ticket:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// ============= SUPER ADMIN ENDPOINTS =============

/**
 * Get all tickets across all companies (Super Admin)
 * GET /api/tickets/admin/all?page=1&limit=50&status=OPEN&priority=HIGH&companyId=xxx
 */
export const getAllTickets = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { page = 1, limit = 50, status, priority, category, companyId, search } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (companyId) where.companyId = companyId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { reporterName: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Fetch tickets and count
    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true
            }
          },
          reportedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: [
          { priority: 'desc' }, // CRITICAL first
          { createdAt: 'desc' }
        ],
        skip,
        take: limitNum
      }),
      prisma.ticket.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    return res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Update ticket status (Super Admin)
 * PUT /api/tickets/:id/status
 */
export const updateTicketStatus = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    // Validate status
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_RESPONSE', 'RESOLVED', 'CLOSED', 'REOPENED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update ticket
    const updateData = { status };

    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
      updateData.resolvedById = user.id;
      if (notes) {
        updateData.resolutionNotes = notes;
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: updateData
    });

    // Add system comment
    await prisma.ticketComment.create({
      data: {
        ticketId: id,
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userRole: user.role,
        comment: `Status changed to ${status}${notes ? `: ${notes}` : ''}`,
        isInternal: false
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Update ticket priority (Super Admin)
 * PUT /api/tickets/:id/priority
 */
export const updateTicketPriority = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { priority } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    // Validate priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: { priority }
    });

    return res.status(200).json({
      success: true,
      message: 'Ticket priority updated successfully',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket priority:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Assign ticket to admin (Super Admin)
 * PUT /api/tickets/:id/assign
 */
export const assignTicket = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { assignedToId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    // Verify assignee exists and is super admin
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { role: true }
      });

      if (!assignee || assignee.role !== 'SUPER_ADMIN') {
        return res.status(400).json({ error: 'Can only assign to super admins' });
      }
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: { assignedToId: assignedToId || null }
    });

    return res.status(200).json({
      success: true,
      message: assignedToId ? 'Ticket assigned successfully' : 'Ticket unassigned successfully',
      data: updatedTicket
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get ticket statistics (Super Admin)
 * GET /api/tickets/admin/stats
 */
export const getTicketStats = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    // Get counts by status
    const statusCounts = await prisma.ticket.groupBy({
      by: ['status'],
      _count: true
    });

    // Get counts by priority
    const priorityCounts = await prisma.ticket.groupBy({
      by: ['priority'],
      _count: true
    });

    // Get counts by category
    const categoryCounts = await prisma.ticket.groupBy({
      by: ['category'],
      _count: true
    });

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Promise.all([
      prisma.ticket.count({
        where: { createdAt: { gte: today } }
      }),
      prisma.ticket.count({
        where: {
          resolvedAt: { gte: today }
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        byPriority: priorityCounts.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
        byCategory: categoryCounts.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
        today: {
          created: todayStats[0],
          resolved: todayStats[1]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Delete ticket (Super Admin)
 * DELETE /api/tickets/:id
 */
export const deleteTicket = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID found' });
    }

    // Verify super admin
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
    }

    // Delete ticket (comments will be cascade deleted)
    await prisma.ticket.delete({
      where: { id }
    });

    return res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
