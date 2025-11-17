/**
 * GeoIP Utility
 * Detects region from IP address for consent logging
 */

/**
 * Get region from IP address
 * Uses a simple country/region detection
 * @param {string} ipAddress - The IP address to lookup
 * @returns {Promise<string>} - Region string (e.g., "United States", "Canada", "Unknown")
 */
export async function getRegionFromIP(ipAddress) {
  // Handle localhost and private IPs
  if (!ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return 'Local/Private Network';
  }

  try {
    // Use ip-api.com free API (no key required, 45 requests/min limit)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,regionName,status,message`);

    if (!response.ok) {
      console.warn(`GeoIP API error: ${response.status}`);
      return 'Unknown';
    }

    const data = await response.json();

    if (data.status === 'fail') {
      console.warn(`GeoIP lookup failed: ${data.message}`);
      return 'Unknown';
    }

    // Return "Country, Region" format
    if (data.regionName && data.regionName !== data.country) {
      return `${data.country}, ${data.regionName}`;
    }

    return data.country || 'Unknown';
  } catch (error) {
    console.error('GeoIP lookup error:', error);
    return 'Unknown';
  }
}

/**
 * Extract IP address from Express request
 * Handles proxies and various header formats
 * @param {object} req - Express request object
 * @returns {string} - IP address
 */
export function getIPAddress(req) {
  // Check various headers for the real IP (in case of proxies)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwarded.split(',')[0].trim();
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown';
}

export default {
  getRegionFromIP,
  getIPAddress,
};
