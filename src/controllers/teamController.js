import prisma from "../../prisma/client.js";
import auditService from "../services/auditService.js";
import { clerkClient } from "@clerk/express";
import { sendTeamInvitationEmail } from "../services/emailService.js";

/**
 * Team Management Controller
 * Handles DSP team member operations (invite, update role, remove)
 * Only accessible to users with 'manage_users' capability (DSP ADMIN)
 */

/**
 * Invite a new team member or update existing user's role
 * POST /api/team/invite
 */
export const inviteTeamMember = async (req, res) => {
  try {
    const { email, firstName, lastName, dspRole } = req.body;
    const inviter = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    console.log('\n🔔 ===== TEAM MEMBER INVITATION STARTED =====');
    console.log('📧 Email:', email);
    console.log('👤 Name:', firstName, lastName);
    console.log('🎭 Role:', dspRole);
    console.log('👮 Invited by:', inviter.email);

    // Validation
    if (!email || !firstName || !lastName || !dspRole) {
      return res.status(400).json({
        error: "Email, firstName, lastName, and dspRole are required"
      });
    }

    // Validate dspRole
    const validRoles = ['ADMIN', 'COMPLIANCE_MANAGER', 'HR_LEAD', 'VIEWER', 'BILLING'];
    if (!validRoles.includes(dspRole)) {
      return res.status(400).json({
        error: `Invalid DSP role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Check if inviter has a company
    if (!inviter.companyId) {
      return res.status(403).json({
        error: "You must belong to a company to invite team members"
      });
    }

    // Check team member limit (5 members max per company)
    const teamMemberCount = await prisma.user.count({
      where: {
        companyId: inviter.companyId,
        role: { not: 'SUPER_ADMIN' }
      }
    });

    if (teamMemberCount >= 5) {
      return res.status(403).json({
        error: "Team member limit reached",
        message: "You can only have up to 5 team members. Please remove a member before inviting a new one."
      });
    }

    // Check if user already exists in the system
    let targetUser = await prisma.user.findUnique({
      where: { email },
    });

    let isNewUser = false;
    let oldRole = null;

    if (targetUser) {
      // User exists in database - this is a re-invitation or role update
      if (targetUser.id === inviter.id) {
        return res.status(400).json({
          error: "You cannot modify your own role"
        });
      }

      // Check if user belongs to a different company
      if (targetUser.companyId && targetUser.companyId !== inviter.companyId) {
        return res.status(403).json({
          error: "This user belongs to a different company"
        });
      }

      console.log('👤 User already exists in database:', targetUser.email);
      console.log('   Clerk User ID:', targetUser.clerkUserId);
      console.log('   Current Role:', targetUser.dspRole, '→ New Role:', dspRole);

      // Check if the Clerk user still exists
      let clerkUserExists = false;
      if (targetUser.clerkUserId) {
        try {
          await clerkClient.users.getUser(targetUser.clerkUserId);
          clerkUserExists = true;
          console.log('✅ Clerk user exists');
        } catch (error) {
          console.log('⚠️  Clerk user not found - will create new one');
          clerkUserExists = false;
        }
      }

      // If Clerk user doesn't exist, treat this as a new invitation
      if (!clerkUserExists) {
        console.log('🔄 Creating new Clerk account for existing database user');
        isNewUser = true; // Fall through to create new Clerk user below
        // Don't return here - fall through to creation logic
      } else {
        // Update existing user in database and Clerk
        oldRole = targetUser.dspRole;

        targetUser = await prisma.user.update({
          where: { id: targetUser.id },
          data: {
            dspRole,
            firstName: firstName,
            lastName: lastName,
            companyId: inviter.companyId,
          },
        });

        // Update Clerk metadata
        try {
          await clerkClient.users.updateUserMetadata(targetUser.clerkUserId, {
            publicMetadata: {
              role: targetUser.role,
              dspRole: dspRole,
              companyId: inviter.companyId,
            },
          });
          console.log('✅ Clerk metadata updated');
        } catch (clerkError) {
          console.error("❌ Failed to update Clerk metadata:", clerkError);
        }

        // Log role update
        await auditService.logTeamOperation({
          userId: inviter.id,
          userEmail: inviter.email,
          userName: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim(),
          companyId: inviter.companyId,
          action: "TEAM_MEMBER_ROLE_UPDATED",
          targetUserId: targetUser.id,
          targetUserEmail: email,
          ipAddress,
          userAgent,
          oldValues: { dspRole: oldRole },
          newValues: { dspRole },
          metadata: {
            updatedBy: inviter.email,
            oldRole,
            newRole: dspRole,
          },
        });

        return res.json({
          success: true,
          message: "Team member role updated successfully",
          user: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            dspRole: targetUser.dspRole,
            role: targetUser.role,
          },
        });
      }
    } else {
      // Truly new user - not in database at all
      isNewUser = true;
    }

    if (isNewUser) {
      // New user - create account in both Clerk and Database
      console.log('🆕 Creating brand new user account');

      // Get company details for email
      const company = await prisma.company.findUnique({
        where: { id: inviter.companyId },
        select: { name: true },
      });

      let clerkUser = null;
      let passwordResetUrl = null;
      let emailSent = false;
      let teamInvitation = null;
      let emailError = null;

      try {
        // Step 1: Create user directly in Clerk with role metadata
        clerkUser = await clerkClient.users.createUser({
          emailAddress: [email],
          firstName: firstName,
          lastName: lastName,
          publicMetadata: {
            role: 'ADMIN',              // System role
            dspRole: dspRole,           // DSP-specific role (HR_LEAD, BILLING, etc.)
            companyId: inviter.companyId, // Link to company
            invitedBy: inviter.id,      // Track who invited them
            mfaEnabled: false,          // MFA not enabled initially
          },
          skipPasswordRequirement: true, // User will set password via reset link
        });

        console.log('✅ Clerk user created:', clerkUser.id);

        // Step 2: Create or update user in database with Clerk ID
        if (targetUser && targetUser.id) {
          // User exists in DB but had stale Clerk ID - update it
          targetUser = await prisma.user.update({
            where: { id: targetUser.id },
            data: {
              firstName,
              lastName,
              dspRole,
              companyId: inviter.companyId,
              clerkUserId: clerkUser.id, // ✅ Update with new Clerk ID
            },
          });
          console.log('✅ Database user updated with new Clerk ID:', targetUser.id);
        } else {
          // Truly new user - create in database
          targetUser = await prisma.user.create({
            data: {
              email,
              firstName,
              lastName,
              dspRole,
              role: 'ADMIN',
              companyId: inviter.companyId,
              clerkUserId: clerkUser.id, // ✅ Link Clerk account immediately
            },
          });
          console.log('✅ Database user created:', targetUser.id);
        }

        // Step 3: Generate sign-in token from Clerk
        const signInToken = await clerkClient.signInTokens.createSignInToken({
          userId: clerkUser.id,
          expiresInSeconds: 604800, // 7 days
        });

        passwordResetUrl = signInToken.url;
        console.log('✅ Sign-in token generated');

        // Step 4: Create TeamInvitation record
        teamInvitation = await prisma.teamInvitation.create({
          data: {
            companyId: inviter.companyId,
            email,
            firstName,
            lastName,
            dspRole,
            invitedById: inviter.id,
            clerkSignInToken: passwordResetUrl,
            clerkUserId: clerkUser.id,
            userId: targetUser.id,
            expiresAt: new Date(Date.now() + 604800 * 1000), // 7 days
            status: 'PENDING',
          },
        });

        console.log('✅ Team invitation record created:', teamInvitation.id);

        // Step 5: Send custom email with password setup link
        try {
          await sendTeamInvitationEmail({
            email,
            firstName,
            lastName,
            inviterName: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email,
            companyName: company?.name || 'Your Company',
            role: dspRole,
            invitationUrl: passwordResetUrl, // Password setup link
          });

          emailSent = true;

          // Update invitation status to SENT
          await prisma.teamInvitation.update({
            where: { id: teamInvitation.id },
            data: {
              status: 'SENT',
              emailSentAt: new Date(),
            },
          });

          console.log('✅ Team invitation email sent to:', email);
        } catch (emailErr) {
          console.error('❌ Failed to send email:', emailErr);
          emailError = emailErr.message;

          // Update invitation status to FAILED
          await prisma.teamInvitation.update({
            where: { id: teamInvitation.id },
            data: {
              status: 'FAILED',
              errorMessage: emailErr.message,
            },
          });
        }
      } catch (createError) {
        console.error('❌ Failed to create user:', createError);

        // Cleanup: If Clerk user was created but DB failed, delete Clerk user
        if (clerkUser && !targetUser) {
          try {
            await clerkClient.users.deleteUser(clerkUser.id);
            console.log('🧹 Cleaned up Clerk user after DB failure');
          } catch (cleanupError) {
            console.error('⚠️ Failed to cleanup Clerk user:', cleanupError);
          }
        }

        throw new Error(`Failed to create user: ${createError.message}`);
      }

      // Log invitation
      await auditService.logTeamOperation({
        userId: inviter.id,
        userEmail: inviter.email,
        userName: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim(),
        companyId: inviter.companyId,
        action: "TEAM_MEMBER_INVITED",
        targetUserId: targetUser.id,
        targetUserEmail: email,
        ipAddress,
        userAgent,
        metadata: {
          invitedBy: inviter.email,
          assignedDspRole: dspRole,
          isNewUser: true,
          clerkUserId: clerkUser.id,
          passwordResetSent: !!passwordResetUrl,
          emailSent,
        },
      });

      console.log('\n✅ ===== TEAM MEMBER INVITATION COMPLETED =====');
      console.log('   User ID:', targetUser.id);
      console.log('   Clerk ID:', clerkUser.id);
      console.log('   Invitation ID:', teamInvitation?.id);
      console.log('   Email Sent:', emailSent);
      console.log('================================================\n');

      return res.json({
        success: true,
        message: emailSent
          ? "Team member invited successfully. They will receive an email to set their password."
          : "Team member created but invitation email failed. Please check the invitation history for details.",
        user: {
          id: targetUser.id,
          email: targetUser.email,
          dspRole: targetUser.dspRole,
          role: targetUser.role,
          clerkUserId: clerkUser.id,
        },
        invitationSent: emailSent,
        emailError: emailError,
        invitationId: teamInvitation?.id,
      });
    }
  } catch (error) {
    console.error('\n❌ ===== TEAM MEMBER INVITATION FAILED =====');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('================================================\n');

    // Log failure
    await auditService.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.companyId,
      action: "TEAM_MEMBER_INVITED",
      resource: "TeamMember",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      severity: "ERROR",
      category: "USER_MANAGEMENT",
      errorMessage: error.message,
      metadata: {
        attemptedEmail: req.body.email,
        attemptedRole: req.body.dspRole,
      },
    });

    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all team members for the current user's company
 * GET /api/team
 */
export const getTeamMembers = async (req, res) => {
  try {
    const user = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    if (!user.companyId) {
      return res.status(403).json({
        error: "You must belong to a company"
      });
    }

    // Get all users in the same company
    const teamMembers = await prisma.user.findMany({
      where: {
        companyId: user.companyId,
        role: { not: 'SUPER_ADMIN' }, // Exclude super admins
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        dspRole: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Log team list view
    await auditService.logTeamOperation({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "TEAM_LIST_VIEWED",
      targetUserId: null,
      targetUserEmail: null,
      ipAddress,
      userAgent,
      metadata: {
        recordCount: teamMembers.length,
        viewedBy: user.email,
      },
    });

    res.json({
      success: true,
      teamMembers,
      total: teamMembers.length,
    });
  } catch (error) {
    console.error("Get team members error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update a team member's DSP role
 * PUT /api/team/:userId
 */
export const updateTeamMemberRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { dspRole } = req.body;
    const updater = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Validation
    if (!dspRole) {
      return res.status(400).json({ error: "dspRole is required" });
    }

    const validRoles = ['ADMIN', 'COMPLIANCE_MANAGER', 'HR_LEAD', 'VIEWER', 'BILLING'];
    if (!validRoles.includes(dspRole)) {
      return res.status(400).json({
        error: `Invalid DSP role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Cannot update your own role
    if (userId === updater.id) {
      return res.status(400).json({
        error: "You cannot modify your own role"
      });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify same company
    if (targetUser.companyId !== updater.companyId) {
      return res.status(403).json({
        error: "You can only update team members in your company"
      });
    }

    // Prevent updating ADMIN users' roles
    if (targetUser.dspRole === 'ADMIN') {
      return res.status(403).json({
        error: "Cannot modify admin role",
        message: "Admin users' roles cannot be changed."
      });
    }

    // Prevent assigning ADMIN role to team members
    if (dspRole === 'ADMIN') {
      return res.status(403).json({
        error: "Cannot assign admin role",
        message: "The ADMIN role is reserved for the company owner only."
      });
    }

    const oldRole = targetUser.dspRole;

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { dspRole },
    });

    // Update Clerk metadata
    if (updatedUser.clerkUserId) {
      try {
        await clerkClient.users.updateUserMetadata(updatedUser.clerkUserId, {
          publicMetadata: {
            role: updatedUser.role,
            dspRole: dspRole,
            companyId: updatedUser.companyId,
          },
        });
      } catch (clerkError) {
        console.error("Failed to update Clerk metadata:", clerkError);
      }
    }

    // Log role update
    await auditService.logTeamOperation({
      userId: updater.id,
      userEmail: updater.email,
      userName: `${updater.firstName || ''} ${updater.lastName || ''}`.trim(),
      companyId: updater.companyId,
      action: "TEAM_MEMBER_ROLE_UPDATED",
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      ipAddress,
      userAgent,
      oldValues: { dspRole: oldRole },
      newValues: { dspRole },
      metadata: {
        updatedBy: updater.email,
        oldRole,
        newRole: dspRole,
      },
    });

    res.json({
      success: true,
      message: "Team member role updated successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        dspRole: updatedUser.dspRole,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Update team member role error:", error);

    // Log failure
    await auditService.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.companyId,
      action: "TEAM_MEMBER_ROLE_UPDATED",
      resource: "TeamMember",
      resourceId: req.params.userId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      severity: "ERROR",
      category: "USER_MANAGEMENT",
      errorMessage: error.message,
    });

    res.status(500).json({ error: error.message });
  }
};

/**
 * Get team invitation history for the current user's company
 * GET /api/team/invitations
 */
export const getTeamInvitations = async (req, res) => {
  try {
    const user = req.user;

    if (!user.companyId) {
      return res.status(403).json({
        error: "You must belong to a company"
      });
    }

    // Get all team invitations for this company
    const invitations = await prisma.teamInvitation.findMany({
      where: {
        companyId: user.companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      invitations,
      total: invitations.length,
    });
  } catch (error) {
    console.error("Get team invitations error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Remove a team member from the company
 * DELETE /api/team/:userId
 */
export const removeTeamMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const remover = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Cannot remove yourself
    if (userId === remover.id) {
      return res.status(400).json({
        error: "You cannot remove yourself from the team"
      });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify same company
    if (targetUser.companyId !== remover.companyId) {
      return res.status(403).json({
        error: "You can only remove team members from your company"
      });
    }

    // Prevent removing ADMIN users
    if (targetUser.dspRole === 'ADMIN') {
      return res.status(403).json({
        error: "Cannot remove admin from team",
        message: "Admin users cannot be removed from the team. Only the admin can delete their own account."
      });
    }

    // Remove company association (soft delete - keep user record)
    await prisma.user.update({
      where: { id: userId },
      data: {
        companyId: null,
        dspRole: null,
      },
    });

    // Update Clerk metadata
    if (targetUser.clerkUserId) {
      try {
        await clerkClient.users.updateUserMetadata(targetUser.clerkUserId, {
          publicMetadata: {
            role: targetUser.role,
            dspRole: null,
            companyId: null,
          },
        });
      } catch (clerkError) {
        console.error("Failed to update Clerk metadata:", clerkError);
      }
    }

    // Log removal
    await auditService.logTeamOperation({
      userId: remover.id,
      userEmail: remover.email,
      userName: `${remover.firstName || ''} ${remover.lastName || ''}`.trim(),
      companyId: remover.companyId,
      action: "TEAM_MEMBER_REMOVED",
      targetUserId: userId,
      targetUserEmail: targetUser.email,
      ipAddress,
      userAgent,
      metadata: {
        removedBy: remover.email,
        removedUserEmail: targetUser.email,
        removedUserRole: targetUser.dspRole,
      },
    });

    res.json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error("Remove team member error:", error);

    // Log failure
    await auditService.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      companyId: req.user?.companyId,
      action: "TEAM_MEMBER_REMOVED",
      resource: "TeamMember",
      resourceId: req.params.userId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      severity: "ERROR",
      category: "USER_MANAGEMENT",
      errorMessage: error.message,
    });

    res.status(500).json({ error: error.message });
  }
};
