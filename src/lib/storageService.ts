import { Storage } from '@google-cloud/storage';
import { getAppConfig } from './config';
import crypto from 'crypto';

export interface UploadValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB limit

/**
 * Validates uploaded image content, size, and MIME type
 */
export function validateImageUpload(
  buffer: Buffer,
  providedMimeType?: string,
  originalFilename?: string
): UploadValidationResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'Empty file provided' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: `File exceeds maximum size of 8MB (${Math.round(buffer.length / 1024 / 1024)}MB)` };
  }

  // Basic Magic Number check for JPEG, PNG, WEBP
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

  let detectedMime = providedMimeType || '';
  if (isJpeg) detectedMime = 'image/jpeg';
  else if (isPng) detectedMime = 'image/png';
  else if (isWebp) detectedMime = 'image/webp';
  else if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
    return { isValid: false, error: 'Unsupported file format. Please upload JPEG, PNG, or WEBP image.' };
  }

  const extension = detectedMime === 'image/png' ? 'png' : detectedMime === 'image/webp' ? 'webp' : 'jpg';
  const uniqueId = crypto.randomUUID();
  const sanitizedFileName = `assessments/${Date.now()}_${uniqueId}.${extension}`;

  return {
    isValid: true,
    sanitizedFileName,
    mimeType: detectedMime,
    sizeBytes: buffer.length
  };
}

/**
 * Storage Service:
 * In Live Mode, uploads to Google Cloud Storage bucket with private ACLs and generates short-lived signed URLs.
 * In Demo Mode, stores in temporary local memory buffer with data URI.
 */
class CloudStorageService {
  private storage: Storage | null = null;
  private demoMemoryStore: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  constructor() {
    const config = getAppConfig();
    if (!config.DEMO_MODE && config.GCS_BUCKET_NAME) {
      this.storage = new Storage();
    }
  }

  async uploadItemPhoto(
    buffer: Buffer,
    destinationPath: string,
    mimeType: string
  ): Promise<{ objectPath: string; url: string }> {
    const config = getAppConfig();

    if (config.DEMO_MODE || !this.storage || !config.GCS_BUCKET_NAME) {
      // Demo Mode / In-memory storage
      this.demoMemoryStore.set(destinationPath, { buffer, mimeType });
      const base64 = buffer.toString('base64');
      return {
        objectPath: `demo://${destinationPath}`,
        url: `data:${mimeType};base64,${base64}`
      };
    }

    // Live Google Cloud Storage
    const bucket = this.storage.bucket(config.GCS_BUCKET_NAME);
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          retentionPolicy: 'delete-after-30-days',
          uploadedAt: new Date().toISOString()
        }
      },
      resumable: false,
      validation: 'crc32c'
    });

    // Generate short-lived read URL (valid for 15 minutes)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });

    return {
      objectPath: destinationPath,
      url: signedUrl
    };
  }

  async getSignedUrl(objectPath: string): Promise<string | null> {
    const config = getAppConfig();
    if (config.DEMO_MODE || objectPath.startsWith('demo://')) {
      const demoPath = objectPath.replace('demo://', '');
      const item = this.demoMemoryStore.get(demoPath);
      if (!item) return null;
      return `data:${item.mimeType};base64,${item.buffer.toString('base64')}`;
    }

    if (!this.storage || !config.GCS_BUCKET_NAME) return null;
    const bucket = this.storage.bucket(config.GCS_BUCKET_NAME);
    const file = bucket.file(objectPath);
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000
    });
    return signedUrl;
  }
}

export const cloudStorageService = new CloudStorageService();
