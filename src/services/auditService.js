import prisma from "../../prisma/client.js";
import crypto from "crypto";

/**
 * Audit Logging Service
 * Provides centralized audit logging for compliance and security
 * Features: Immutable logs, blockchain-style hash chaining, integrity verification
 */

class AuditService {
  /**
   * Calculate SHA-256 hash of log content
   */
  calculateHash(logData) {
    // Create deterministic hash from critical log fields
    const content = JSON.stringify({
      userId: logData.userId,
      userEmail: logData.userEmail,
      companyId: logData.companyId,
      action: logData.action,
      resource: logData.resource,
      resourceId: logData.resourceId,
      timestamp: logData.timestamp?.toISOString() || new Date().toISOString(),
      metadata: logData.metadata,
      oldValues: logData.oldValues,
      newValues: logData.newValues,
      ipAddress: logData.ipAddress,
    });

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get the last log entry for a company (for hash chaining)
   */
  async getLastLog(companyId, logType = 'audit') {
    if (!companyId) return null;

    try {
      if (logType === 'audit') {
        return await prisma.auditLog.findFirst({
          where: { companyId },
          orderBy: { sequenceNum: 'desc' },
          select: { hash: true, sequenceNum: true },
        });
      } else if (logType === 'security') {
        return await prisma.securityEvent.findFirst({
          where: { companyId },
          orderBy: { sequenceNum: 'desc' },
          select: { hash: true, sequenceNum: true },
        });
      } else if (logType === 'dataAccess') {
        return await prisma.dataAccessLog.findFirst({
          where: { companyId },
          orderBy: { sequenceNum: 'desc' },
          select: { hash: true, sequenceNum: true },
        });
      }
    } catch (error) {
      console.error('Error getting last log:', error);
      return null;
    }
  }
  /**
   * Log a general audit event (with immutability & hash chaining)
   */
  async logAudit({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    resource,
    resourceId,
    method,
    endpoint,
    statusCode,
    ipAddress,
    userAgent,
    region,
    oldValues,
    newValues,
    changes,
    metadata,
    errorMessage,
    severity = "INFO",
    category = "GENERAL",
  }) {
    try {
      // Get previous log for hash chaining (company-specific chain)
      const previousLog = await this.getLastLog(companyId, 'audit');

      // Prepare log data
      const timestamp = new Date();
      const logData = {
        userId,
        userEmail,
        userName,
        companyId,
        action,
        resource,
        resourceId,
        method,
        endpoint,
        statusCode,
        ipAddress,
        userAgent,
        region,
        oldValues,
        newValues,
        changes,
        metadata,
        errorMessage,
        severity,
        category,
        timestamp,
      };

      // Calculate hash for this log
      const hash = this.calculateHash(logData);
      const previousHash = previousLog?.hash || null;

      // Create immutable log entry
      await prisma.auditLog.create({
        data: {
          ...logData,
          hash,
          previousHash,
          verified: true, // Mark as verified since we just calculated the hash
        },
      });
    } catch (error) {
      // Don't throw - logging failures shouldn't break the application
      console.error("Audit logging failed:", error);
    }
  }

  /**
   * Log authentication events (login, logout, MFA)
   */
  async logAuth({
    userId,
    userEmail,
    action,
    success,
    ipAddress,
    userAgent,
    metadata,
  }) {
    const severity = success ? "INFO" : "WARNING";

    await this.logAudit({
      userId,
      userEmail,
      action,
      resource: "Authentication",
      ipAddress,
      userAgent,
      severity,
      category: "AUTHENTICATION",
      metadata,
    });
  }

  /**
   * Log MFA-specific events
   */
  async logMFA({
    userId,
    userEmail,
    action,
    method,
    success,
    ipAddress,
    userAgent,
    metadata,
  }) {
    const severity = success ? "INFO" : "WARNING";

    await this.logAudit({
      userId,
      userEmail,
      action,
      resource: "MFA",
      ipAddress,
      userAgent,
      severity,
      category: "MFA",
      metadata: {
        ...metadata,
        method,
      },
    });
  }

  /**
   * Log security events (with immutability & hash chaining)
   */
  async logSecurityEvent({
    userId,
    userEmail,
    companyId,
    eventType,
    severity = "LOW",
    ipAddress,
    userAgent,
    location,
    description,
    metadata,
    blocked = false,
    actionTaken,
  }) {
    try {
      // Get previous security event for hash chaining
      const previousLog = await this.getLastLog(companyId, 'security');

      const timestamp = new Date();
      const logData = {
        userId,
        userEmail,
        companyId,
        eventType,
        severity,
        ipAddress,
        userAgent,
        location,
        description,
        metadata,
        blocked,
        actionTaken,
        timestamp,
      };

      // Calculate hash
      const content = JSON.stringify(logData);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const previousHash = previousLog?.hash || null;

      await prisma.securityEvent.create({
        data: {
          ...logData,
          hash,
          previousHash,
          verified: true,
        },
      });
    } catch (error) {
      console.error("Security event logging failed:", error);
    }
  }

  /**
   * Log data access (for GDPR/PIPEDA compliance) with immutability
   */
  async logDataAccess({
    userId,
    userEmail,
    companyId,
    dataType,
    dataId,
    dataOwnerId,
    accessType,
    operation,
    purpose,
    ipAddress,
    endpoint,
  }) {
    try {
      // Get previous data access log for hash chaining
      const previousLog = await this.getLastLog(companyId, 'dataAccess');

      const timestamp = new Date();
      const logData = {
        userId,
        userEmail,
        companyId,
        dataType,
        dataId,
        dataOwnerId,
        accessType,
        operation,
        purpose,
        ipAddress,
        endpoint,
        timestamp,
      };

      // Calculate hash
      const content = JSON.stringify(logData);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const previousHash = previousLog?.hash || null;

      await prisma.dataAccessLog.create({
        data: {
          ...logData,
          hash,
          previousHash,
          verified: true,
        },
      });
    } catch (error) {
      console.error("Data access logging failed:", error);
    }
  }

  /**
   * Log driver-related operations
   */
  async logDriverOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    driverId,
    driverName,
    oldValues,
    newValues,
    changes,
    ipAddress,
    userAgent,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action,
      resource: "Driver",
      resourceId: driverId,
      ipAddress,
      userAgent,
      oldValues,
      newValues,
      changes,
      severity: "INFO",
      category: "DATA_MODIFICATION",
      metadata: {
        driverName,
      },
    });
  }

  /**
   * Log document operations
   */
  async logDocumentOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    documentId,
    documentType,
    driverId,
    driverName,
    ipAddress,
    userAgent,
    metadata,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action,
      resource: "Document",
      resourceId: documentId,
      ipAddress,
      userAgent,
      severity: "INFO",
      category: "DATA_MODIFICATION",
      metadata: {
        ...metadata,
        documentType,
        driverId,
        driverName,
      },
    });
  }

  /**
   * Log billing operations
   */
  async logBillingOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    oldValues,
    newValues,
    amount,
    ipAddress,
    userAgent,
    metadata,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action,
      resource: "Billing",
      resourceId: companyId,
      ipAddress,
      userAgent,
      oldValues,
      newValues,
      severity: "INFO",
      category: "BILLING",
      metadata: {
        ...metadata,
        amount,
      },
    });
  }

  /**
   * Log data exports
   */
  async logDataExport({
    userId,
    userEmail,
    userName,
    companyId,
    dataType,
    recordCount,
    format,
    ipAddress,
    userAgent,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action: "DATA_EXPORTED",
      resource: dataType,
      ipAddress,
      userAgent,
      severity: "WARNING",
      category: "COMPLIANCE",
      metadata: {
        recordCount,
        format,
      },
    });
  }

  /**
   * Get audit logs with filtering (supports company scoping for DSP users)
   */
  async getAuditLogs({
    userId,
    companyId,
    allCompanies = false, // SUPER_ADMIN only
    action,
    resource,
    category,
    severity,
    startDate,
    endDate,
    search,
    limit = 100,
    offset = 0,
  }) {
    const where = {};

    // Company scoping
    if (!allCompanies && companyId) {
      where.companyId = companyId;
    }
    // If allCompanies is true, no companyId filter (SUPER_ADMIN viewing all)

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (category) where.category = category;
    if (severity) where.severity = severity;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    // Search across multiple fields
    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get security events (supports company scoping)
   */
  async getSecurityEvents({
    userId,
    companyId,
    allCompanies = false,
    eventType,
    severity,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  }) {
    const where = {};

    // Company scoping
    if (!allCompanies && companyId) {
      where.companyId = companyId;
    }

    if (userId) where.userId = userId;
    if (eventType) where.eventType = eventType;
    if (severity) where.severity = severity;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.securityEvent.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(userId, ipAddress) {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Check for multiple failed MFA attempts
    const failedMfaAttempts = await prisma.mFAAttempt.count({
      where: {
        userId,
        success: false,
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    if (failedMfaAttempts >= 5) {
      await this.logSecurityEvent({
        userId,
        eventType: "MULTIPLE_FAILED_MFA",
        severity: "HIGH",
        ipAddress,
        description: `${failedMfaAttempts} failed MFA attempts in 15 minutes`,
        blocked: false,
      });
      return true;
    }

    return false;
  }

  /**
   * Log team management operations (DSP RBAC)
   */
  async logTeamOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    targetUserId,
    targetUserEmail,
    ipAddress,
    userAgent,
    oldValues,
    newValues,
    metadata,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action,
      resource: "TeamMember",
      resourceId: targetUserId,
      ipAddress,
      userAgent,
      oldValues,
      newValues,
      severity: action.includes('REMOVED') ? "WARNING" : "INFO",
      category: "USER_MANAGEMENT",
      metadata: {
        ...metadata,
        targetUserEmail,
      },
    });
  }

  /**
   * Log permission denied events
   */
  async logPermissionDenied({
    userId,
    userEmail,
    userName,
    companyId,
    dspRole,
    action,
    requiredCapability,
    resource,
    resourceId,
    ipAddress,
    userAgent,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action: "PERMISSION_DENIED",
      resource,
      resourceId,
      ipAddress,
      userAgent,
      severity: "WARNING",
      category: "SECURITY",
      metadata: {
        attemptedAction: action,
        requiredCapability,
        userDspRole: dspRole,
      },
    });
  }

  /**
   * Log CSV/bulk import operations
   */
  async logCSVImport({
    userId,
    userEmail,
    userName,
    companyId,
    resourceType,
    recordCount,
    successCount,
    failedCount,
    ipAddress,
    userAgent,
    metadata,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action: "CSV_IMPORTED",
      resource: resourceType,
      ipAddress,
      userAgent,
      severity: "INFO",
      category: "DATA_MODIFICATION",
      metadata: {
        ...metadata,
        totalRecords: recordCount,
        successful: successCount,
        failed: failedCount,
      },
    });
  }

  /**
   * Log reminder/compliance operations
   */
  async logReminderOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    reminderId,
    reminderType,
    ipAddress,
    userAgent,
    oldValues,
    newValues,
    metadata,
  }) {
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action,
      resource: "Reminder",
      resourceId: reminderId,
      ipAddress,
      userAgent,
      oldValues,
      newValues,
      severity: "INFO",
      category: "COMPLIANCE",
      metadata: {
        ...metadata,
        reminderType,
      },
    });
  }

  /**
   * Log document download/view operations (presigned URL generation)
   * Important for security audit trail and compliance (GDPR, PIPEDA)
   */
  async logDocumentDownload({
    userId,
    userEmail,
    userName,
    companyId,
    documentId,
    documentType,
    driverId,
    driverName,
    s3Key,
    expiresIn,
    ipAddress,
    userAgent,
    purpose = "Document view/download",
  }) {
    // Log in audit logs for general tracking
    await this.logAudit({
      userId,
      userEmail,
      userName,
      companyId,
      action: "DOCUMENT_DOWNLOAD_URL_GENERATED",
      resource: "Document",
      resourceId: documentId,
      ipAddress,
      userAgent,
      severity: "INFO",
      category: "DATA_ACCESS",
      metadata: {
        documentType,
        driverId,
        driverName,
        s3Key,
        urlExpiresInSeconds: expiresIn,
        purpose,
      },
    });

    // Also log in data access logs for compliance (GDPR/PIPEDA)
    await this.logDataAccess({
      userId,
      userEmail,
      companyId,
      dataType: "Document",
      dataId: documentId,
      dataOwnerId: driverId,
      accessType: "DOWNLOAD",
      operation: "PRESIGNED_URL_GENERATED",
      purpose,
      ipAddress,
      endpoint: "/api/documents/:documentId",
    });
  }

  /**
   * Verify integrity of log chain for a company
   * Returns { valid: true/false, error: string, tamperedLog: object }
   */
  async verifyLogIntegrity(companyId, logType = 'audit') {
    try {
      let logs = [];

      if (logType === 'audit') {
        logs = await prisma.auditLog.findMany({
          where: { companyId },
          orderBy: { sequenceNum: 'asc' },
        });
      } else if (logType === 'security') {
        logs = await prisma.securityEvent.findMany({
          where: { companyId },
          orderBy: { sequenceNum: 'asc' },
        });
      } else if (logType === 'dataAccess') {
        logs = await prisma.dataAccessLog.findMany({
          where: { companyId },
          orderBy: { sequenceNum: 'asc' },
        });
      }

      if (logs.length === 0) {
        return { valid: true, message: 'No logs to verify' };
      }

      // Check first log (should have no previousHash)
      if (logs[0].previousHash !== null) {
        return {
          valid: false,
          error: 'First log has invalid previousHash (should be null)',
          tamperedLog: logs[0],
        };
      }

      // Verify chain integrity
      for (let i = 1; i < logs.length; i++) {
        const currentLog = logs[i];
        const previousLog = logs[i - 1];

        // Check 1: Previous hash chain intact
        if (currentLog.previousHash !== previousLog.hash) {
          return {
            valid: false,
            error: `Hash chain broken at sequence ${currentLog.sequenceNum}`,
            tamperedLog: currentLog,
            previousLog,
          };
        }

        // Check 2: Sequence numbers continuous (allowing for BigInt)
        const currentSeq = Number(currentLog.sequenceNum);
        const previousSeq = Number(previousLog.sequenceNum);

        if (currentSeq !== previousSeq + 1) {
          return {
            valid: false,
            error: `Sequence gap detected between ${previousSeq} and ${currentSeq}`,
            possibleDeletion: true,
            missingSequences: currentSeq - previousSeq - 1,
          };
        }

        // Check 3: Hash matches content (if verified flag is true)
        if (currentLog.verified && logType === 'audit') {
          const recalculatedHash = this.calculateHash(currentLog);
          if (currentLog.hash !== recalculatedHash) {
            return {
              valid: false,
              error: `Log content tampered at sequence ${currentLog.sequenceNum}`,
              tamperedLog: currentLog,
              expectedHash: recalculatedHash,
              actualHash: currentLog.hash,
            };
          }
        }
      }

      return {
        valid: true,
        logsVerified: logs.length,
        firstSequence: Number(logs[0].sequenceNum),
        lastSequence: Number(logs[logs.length - 1].sequenceNum),
        message: `All ${logs.length} logs verified successfully`,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error.message}`,
      };
    }
  }

  /**
   * Get integrity status for all companies (SUPER_ADMIN only)
   */
  async verifyAllCompaniesIntegrity() {
    try {
      const companies = await prisma.company.findMany({
        select: { id: true, name: true },
      });

      const results = [];
      for (const company of companies) {
        const auditResult = await this.verifyLogIntegrity(company.id, 'audit');
        const securityResult = await this.verifyLogIntegrity(company.id, 'security');
        const dataAccessResult = await this.verifyLogIntegrity(company.id, 'dataAccess');

        results.push({
          companyId: company.id,
          companyName: company.name,
          auditLogs: auditResult,
          securityLogs: securityResult,
          dataAccessLogs: dataAccessResult,
          overallValid: auditResult.valid && securityResult.valid && dataAccessResult.valid,
        });
      }

      return results;
    } catch (error) {
      return {
        error: `Failed to verify companies: ${error.message}`,
      };
    }
  }

  /**
   * Log ticket operations
   */
  async logTicketOperation({
    userId,
    userEmail,
    userName,
    companyId,
    action,
    ticketId,
    ticketNumber,
    metadata = {},
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      const auditLog = await prisma.auditLog.create({
        data: {
          userId,
          userEmail,
          userName,
          companyId,
          action,
          resource: 'Ticket',
          resourceId: ticketId,
          metadata: {
            ticketNumber,
            ...metadata,
          },
          ipAddress,
          userAgent,
          severity: 'INFO',
          category: 'DATA_MODIFICATION',
          timestamp: new Date(),
        },
      });

      console.log('✅ Ticket operation logged:', action);
      return auditLog;
    } catch (error) {
      console.error('⚠️ Failed to log ticket operation:', error);
      // Don't throw error - logging failure shouldn't break the operation
      return null;
    }
  }
}

export default new AuditService();
