import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

/**
 * Generate presigned URL for uploading a file to S3
 * @param {string} key - S3 object key (file path)
 * @param {string} contentType - MIME type of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
 * @returns {Promise<string>} - Presigned upload URL
 */
export const generatePresignedUploadUrl = async (key, contentType, expiresIn = 300) => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Generate presigned URL for downloading/viewing a file from S3
 *
 * SECURITY CONSIDERATIONS:
 * - URLs expire after specified time to prevent unauthorized long-term access
 * - Default expiration: 15 minutes (900 seconds) for sensitive documents
 * - All URL generations are logged in audit trail for compliance
 * - URLs are single-use and cannot be renewed without re-authentication
 * - Shorter expiration times recommended for highly sensitive documents
 *
 * @param {string} key - S3 object key (file path)
 * @param {number} expiresIn - URL expiration time in seconds (default: 900 = 15 minutes)
 * @returns {Promise<string>} - Presigned download URL
 */
export const generatePresignedDownloadUrl = async (key, expiresIn = 900) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error generating presigned download URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<void>}
 */
export const deleteFile = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`Deleted file: ${key}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Generate S3 key for a document
 * @param {string} companyId - Company ID
 * @param {string} driverId - Driver ID
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
export const generateDocumentKey = (companyId, driverId, filename) => {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `companies/${companyId}/drivers/${driverId}/documents/${timestamp}_${sanitizedFilename}`;
};

/**
 * Get public S3 URL (for files with public access)
 * @param {string} key - S3 object key
 * @returns {string} - Public URL
 */
export const getPublicUrl = (key) => {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Generate S3 key for a policy PDF
 * @param {string} policyType - Policy type (e.g., 'TERMS_OF_SERVICE')
 * @param {string} version - Policy version
 * @param {string} filename - Original filename
 * @returns {string} - S3 key
 */
export const generatePolicyPdfKey = (policyType, version, filename) => {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `policies/${policyType}/${version}/${timestamp}_${sanitizedFilename}`;
};
