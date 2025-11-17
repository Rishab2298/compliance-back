import auditService from "../services/auditService.js";

/**
 * Audit Log Controller
 * Handles viewing and exporting audit logs with role-based filtering
 */

/**
 * Helper function to convert BigInt fields to strings in an object
 * @param {Object} obj - Object that may contain BigInt values
 * @returns {Object} - Object with BigInt values converted to strings
 */
function convertBigIntFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const converted = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value = obj[key];
    if (typeof value === 'bigint') {
      converted[key] = value.toString();
    } else if (value && typeof value === 'object') {
      converted[key] = convertBigIntFields(value);
    } else {
      converted[key] = value;
    }
  }

  return converted;
}

/**
 * Get audit logs with role-based filtering
 * GET /api/audit-logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const user = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const {
      companyId: requestedCompanyId,
      allCompanies,
      action,
      resource,
      category,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    let finalCompanyId = null;
    let allowAllCompanies = false;

    // SUPER_ADMIN: Can view any/all companies
    if (user.role === 'SUPER_ADMIN') {
      if (allCompanies === 'true') {
        allowAllCompanies = true;
      } else if (requestedCompanyId) {
        finalCompanyId = requestedCompanyId;
      } else {
        allowAllCompanies = true; // Default to all companies for super admin
      }
    } else {
      // DSP USER: Force-scope to their company
      if (!user.companyId) {
        return res.status(403).json({
          error: "You must belong to a company to view audit logs"
        });
      }
      finalCompanyId = user.companyId;
    }

    // Role-based category filtering
    let categoryFilter = category === 'all' ? undefined : category;

    // BILLING role can only see BILLING category
    if (user.dspRole === 'BILLING' && user.role !== 'SUPER_ADMIN') {
      categoryFilter = 'BILLING';
    }

    // VIEWER role can see all but might have restricted metadata
    // (Metadata filtering would happen in frontend or response transformation)

    // Convert "all" to undefined for other filters
    const actionFilter = action === 'all' ? undefined : action;
    const severityFilter = severity === 'all' ? undefined : severity;

    // Fetch logs
    const result = await auditService.getAuditLogs({
      companyId: finalCompanyId,
      allCompanies: allowAllCompanies,
      action: actionFilter,
      resource,
      category: categoryFilter,
      severity: severityFilter,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Transform logs for VIEWER role (remove sensitive info) and convert BigInt
    let logs = result.logs.map(log => ({
      ...log,
      sequenceNum: log.sequenceNum ? log.sequenceNum.toString() : null,
    }));

    if (user.dspRole === 'VIEWER' && user.role !== 'SUPER_ADMIN') {
      logs = logs.map(log => ({
        ...log,
        ipAddress: '***REDACTED***',
        userAgent: '***REDACTED***',
      }));
    }

    // Log the audit log viewing
    await auditService.logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "AUDIT_LOG_VIEWED",
      resource: "AuditLog",
      ipAddress,
      userAgent,
      severity: "INFO",
      category: "COMPLIANCE",
      metadata: {
        viewedCompanyId: finalCompanyId,
        allCompanies: allowAllCompanies,
        recordCount: result.total,
        filters: {
          action,
          resource,
          category: categoryFilter,
          severity,
          dateRange: startDate && endDate ? `${startDate} to ${endDate}` : null,
        },
        viewerRole: user.dspRole,
      },
    });

    res.json({
      success: true,
      logs,
      total: Number(result.total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get security events with role-based filtering
 * GET /api/audit-logs/security
 */
export const getSecurityEvents = async (req, res) => {
  try {
    const user = req.user;
    const {
      companyId: requestedCompanyId,
      allCompanies,
      eventType,
      severity,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    let finalCompanyId = null;
    let allowAllCompanies = false;

    // SUPER_ADMIN: Can view any/all companies
    if (user.role === 'SUPER_ADMIN') {
      if (allCompanies === 'true') {
        allowAllCompanies = true;
      } else if (requestedCompanyId) {
        finalCompanyId = requestedCompanyId;
      } else {
        allowAllCompanies = true;
      }
    } else {
      // DSP USER: Force-scope to their company
      if (!user.companyId) {
        return res.status(403).json({
          error: "You must belong to a company"
        });
      }
      finalCompanyId = user.companyId;
    }

    // Fetch security events
    const result = await auditService.getSecurityEvents({
      companyId: finalCompanyId,
      allCompanies: allowAllCompanies,
      eventType,
      severity,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Transform events to convert BigInt fields
    const events = result.events.map(event => ({
      ...event,
      sequenceNum: event.sequenceNum ? event.sequenceNum.toString() : null,
    }));

    res.json({
      success: true,
      events,
      total: Number(result.total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Get security events error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify audit log integrity for current company
 * GET /api/audit-logs/verify-integrity
 */
export const verifyIntegrity = async (req, res) => {
  try {
    const user = req.user;
    const { logType = 'audit' } = req.query;

    let companyId = user.companyId;

    // SUPER_ADMIN can check specific company or all companies
    if (user.role === 'SUPER_ADMIN') {
      const { companyId: requestedCompanyId, allCompanies } = req.query;

      if (allCompanies === 'true') {
        // Verify all companies
        const results = await auditService.verifyAllCompaniesIntegrity();
        return res.json({
          success: true,
          results: convertBigIntFields(results),
        });
      } else if (requestedCompanyId) {
        companyId = requestedCompanyId;
      }
    }

    if (!companyId) {
      return res.status(400).json({
        error: "Company ID required"
      });
    }

    // Verify integrity
    const result = await auditService.verifyLogIntegrity(companyId, logType);

    // Convert any BigInt fields in the result
    const convertedResult = convertBigIntFields(result);

    res.json({
      success: convertedResult.valid,
      ...convertedResult,
    });
  } catch (error) {
    console.error("Verify integrity error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Export audit logs (CSV/JSON)
 * GET /api/audit-logs/export
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const user = req.user;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const {
      format = 'json',
      companyId: requestedCompanyId,
      action,
      resource,
      category,
      severity,
      startDate,
      endDate,
    } = req.query;

    let finalCompanyId = user.companyId;

    // SUPER_ADMIN can export any company
    if (user.role === 'SUPER_ADMIN' && requestedCompanyId) {
      finalCompanyId = requestedCompanyId;
    }

    if (!finalCompanyId) {
      return res.status(400).json({
        error: "Company ID required"
      });
    }

    // Fetch all logs for export (no limit)
    const result = await auditService.getAuditLogs({
      companyId: finalCompanyId,
      action,
      resource,
      category,
      severity,
      startDate,
      endDate,
      limit: 10000, // Max export limit
      offset: 0,
    });

    // Log export action
    await auditService.logAudit({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      companyId: user.companyId,
      action: "AUDIT_LOG_EXPORTED",
      resource: "AuditLog",
      ipAddress,
      userAgent,
      severity: "WARNING",
      category: "COMPLIANCE",
      metadata: {
        exportedCompanyId: finalCompanyId,
        recordCount: result.total,
        format,
        filters: { action, resource, category, severity, startDate, endDate },
      },
    });

    if (format === 'csv') {
      // Convert to CSV
      const csvHeaders = [
        'Timestamp',
        'User Email',
        'Action',
        'Resource',
        'Category',
        'Severity',
        'IP Address',
        'Status',
      ].join(',');

      const csvRows = result.logs.map(log => [
        log.timestamp,
        log.userEmail || '',
        log.action,
        log.resource || '',
        log.category,
        log.severity,
        log.ipAddress || '',
        log.errorMessage ? 'FAILURE' : 'SUCCESS',
      ].join(',')).join('\n');

      const csv = `${csvHeaders}\n${csvRows}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        companyId: finalCompanyId,
        totalRecords: result.total,
        logs: result.logs,
      });
    }
  } catch (error) {
    console.error("Export audit logs error:", error);
    res.status(500).json({ error: error.message });
  }
};
