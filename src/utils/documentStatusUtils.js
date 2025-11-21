/**
 * Utility functions for calculating document status consistently across the application
 */

/**
 * Calculate the display status of a document based on its database status and expiry date
 *
 * @param {Object} document - The document object
 * @param {string} document.status - The database status (PENDING, ACTIVE, EXPIRED, EXPIRING_SOON, etc.)
 * @param {Date|string|null} document.expiryDate - The expiry date of the document
 * @returns {string} - The display status: 'pending', 'expired', 'expiring', or 'verified'
 */
export const calculateDocumentStatus = (document) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiringThreshold = new Date(today);
  expiringThreshold.setDate(expiringThreshold.getDate() + 30);

  // If status is PENDING (document uploaded but data not filled), show as pending
  if (document.status === 'PENDING') {
    return 'pending';
  }

  // If no expiry date exists, determine based on document status
  if (!document.expiryDate) {
    // Documents without expiry dates: ACTIVE = verified, others = pending
    return document.status === 'ACTIVE' ? 'verified' : 'pending';
  }

  // For documents with expiry dates, calculate based on the date
  const expiryDate = new Date(document.expiryDate);
  const diffTime = expiryDate - today;
  const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    return 'expired';
  } else if (daysUntilExpiry <= 30) {
    return 'expiring';
  } else {
    // Expires after 30 days - only verified if ACTIVE
    return document.status === 'ACTIVE' ? 'verified' : 'pending';
  }
};

/**
 * Calculate document status counts for a list of documents
 *
 * @param {Array} documents - Array of document objects
 * @returns {Object} - Object with counts: { pending, expired, expiring, verified, total }
 */
export const calculateDocumentStatusCounts = (documents) => {
  const counts = {
    pending: 0,
    expired: 0,
    expiring: 0,
    verified: 0,
    total: documents.length,
  };

  documents.forEach(doc => {
    const status = calculateDocumentStatus(doc);
    counts[status]++;
  });

  return counts;
};

/**
 * Calculate compliance status for a driver based on their documents
 * Used in storage.jsx and dashboard
 *
 * @param {Array} documents - Array of document objects for the driver
 * @param {number} totalDocuments - Total number of documents for the driver
 * @returns {string} - Compliance status: 'No Documents', 'Critical', 'Warning', or 'Compliant'
 */
export const calculateDriverComplianceStatus = (documents, totalDocuments = 0) => {
  // If no documents, status is critical
  if (!documents || documents.length === 0 || totalDocuments === 0) {
    return 'No Documents';
  }

  const counts = calculateDocumentStatusCounts(documents);

  // If any expired documents, status is critical
  if (counts.expired > 0) {
    return 'Critical';
  }

  // If any expiring documents, status is warning
  if (counts.expiring > 0) {
    return 'Warning';
  }

  // If any pending documents, status is warning
  if (counts.pending > 0) {
    return 'Warning';
  }

  return 'Compliant';
};

/**
 * Get days until expiry for a document
 *
 * @param {Date|string|null} expiryDate - The expiry date
 * @returns {number|null} - Number of days until expiry, or null if no expiry date
 */
export const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};
