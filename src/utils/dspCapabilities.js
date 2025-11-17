/**
 * DSP Role-Based Access Control (RBAC) Capabilities
 * Defines what each DSP role can do
 */

export const DSP_CAPABILITIES = {
  ADMIN: {
    manage_users: true,
    manage_billing: true,
    view_audit_logs: true,
    create_edit_drivers: true,
    upload_documents: true,
    delete_documents: true,
    configure_reminders: true,
    view_dashboard: true,
    access_settings: true,
  },
  COMPLIANCE_MANAGER: {
    manage_users: false,
    manage_billing: false,
    view_audit_logs: false,
    create_edit_drivers: true,
    upload_documents: true,
    delete_documents: true,
    configure_reminders: true,
    view_dashboard: false,
    access_settings: false,
  },
  HR_LEAD: {
    manage_users: false,
    manage_billing: false,
    view_audit_logs: false,
    create_edit_drivers: true,
    upload_documents: true,
    delete_documents: false,
    configure_reminders: true,
    view_dashboard: false,
    access_settings: false,
  },
  VIEWER: {
    manage_users: false,
    manage_billing: false,
    view_audit_logs: false,
    create_edit_drivers: false,
    upload_documents: false,
    delete_documents: false,
    configure_reminders: false,
    view_dashboard: false,
    access_settings: false,
  },
  BILLING: {
    manage_users: false,
    manage_billing: true,
    view_audit_logs: false,
    create_edit_drivers: false,
    upload_documents: false,
    delete_documents: false,
    configure_reminders: false,
    view_dashboard: false,
    access_settings: false,
  },
};

/**
 * Check if a user has a specific capability
 * @param {Object} user - User object with role and dspRole
 * @param {string} capability - Capability to check
 * @returns {boolean} - True if user has the capability
 */
export function hasDSPCapability(user, capability) {
  // SUPER_ADMIN bypasses all checks
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // If no dspRole is set, deny access (safety default)
  if (!user.dspRole) {
    return false;
  }

  // Check capability in mapping
  const capabilities = DSP_CAPABILITIES[user.dspRole];
  if (!capabilities) {
    return false;
  }

  return capabilities[capability] === true;
}

/**
 * Get all capabilities for a user
 * @param {Object} user - User object with role and dspRole
 * @returns {Object} - Object with all capabilities
 */
export function getUserCapabilities(user) {
  // SUPER_ADMIN gets all capabilities
  if (user.role === "SUPER_ADMIN") {
    return {
      manage_users: true,
      manage_billing: true,
      view_audit_logs: true,
      create_edit_drivers: true,
      upload_documents: true,
      delete_documents: true,
      configure_reminders: true,
      view_dashboard: true,
      access_settings: true,
    };
  }

  // Return capabilities for dspRole
  if (user.dspRole) {
    return DSP_CAPABILITIES[user.dspRole] || {};
  }

  // Default: no capabilities
  return {
    manage_users: false,
    manage_billing: false,
    view_audit_logs: false,
    create_edit_drivers: false,
    upload_documents: false,
    delete_documents: false,
    configure_reminders: false,
    view_dashboard: false,
    access_settings: false,
  };
}

export default {
  DSP_CAPABILITIES,
  hasDSPCapability,
  getUserCapabilities,
};
