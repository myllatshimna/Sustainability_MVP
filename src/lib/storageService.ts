import { Storage } from '@google-cloud/storage';
import { getAppConfig } from './config';
import crypto from 'crypto';

export interface UploadValidationResult {
  isValid: boolean;
  error?: string;
  extension?: string;
  mimeType?: string;
  sizeBytes?: number;
  sanitizedFileName?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB limit

/**
 * Validates uploaded image content, size, and magic bytes.
 * Strictly preserves genuine image extension: never renames JPEG/PNG to .webp unless converted.
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
    return {
      isValid: false,
      error: `File exceeds maximum size of 8MB (${Math.round(buffer.length / 1024 / 1024)}MB)`
    };
  }

  // Exact Magic Number check for JPEG, PNG, WEBP
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp = buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

  let detectedMime = '';
  let extension = '';

  if (isJpeg) {
    detectedMime = 'image/jpeg';
    extension = originalFilename?.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'jpg';
  } else if (isPng) {
    detectedMime = 'image/png';
    extension = 'png';
  } else if (isWebp) {
    detectedMime = 'image/webp';
    extension = 'webp';
  } else {
    return {
      isValid: false,
      error: 'Unsupported file format. Please upload JPEG, PNG, or WEBP image.'
    };
  }

  const uniqueId = crypto.randomUUID();
  const sanitizedFileName = `drafts/${Date.now()}_${uniqueId}.${extension}`;

  return {
    isValid: true,
    extension,
    sanitizedFileName,
    mimeType: detectedMime,
    sizeBytes: buffer.length
  };
}

/**
 * Generates structured, collision-resistant object path within bucket
 */
export function generateObjectPath(
  namespace: 'assessments' | 'listings' | 'drafts',
  recordId: string,
  extension: string
): string {
  const uniqueId = crypto.randomUUID();
  return `${namespace}/${recordId}/${uniqueId}.${extension}`;
}

/**
 * Storage Service:
 * In Live Mode, streams photos to Google Cloud Storage bucket with private ACLs
 * and serves them through the backend media endpoint (/api/media/...) with service account auth.
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

  private getStorageClient(): Storage | null {
    if (!this.storage) {
      const config = getAppConfig();
      if (!config.DEMO_MODE && config.GCS_BUCKET_NAME) {
        this.storage = new Storage();
      }
    }
    return this.storage;
  }

  /**
   * Uploads photo to Cloud Storage or demo store.
   * Returns objectPath and the backend media serving URL.
   */
  async uploadPhoto(
    buffer: Buffer,
    destinationPath: string,
    mimeType: string
  ): Promise<{ objectPath: string; mediaUrl: string; signedUrl?: string }> {
    const config = getAppConfig();
    const storageClient = this.getStorageClient();

    if (config.DEMO_MODE || !storageClient || !config.GCS_BUCKET_NAME) {
      if (!config.DEMO_MODE && process.env.NODE_ENV !== 'test') {
        throw new Error(
          'Live Configuration Error: Cloud Storage bucket is unconfigured. Set GCS_BUCKET_NAME in your environment to enable live file uploads, or enable DEMO_MODE=true.'
        );
      }
      // Demo Mode / In-memory storage
      this.demoMemoryStore.set(destinationPath, { buffer, mimeType });
      const base64 = buffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;
      return {
        objectPath: `demo://${destinationPath}`,
        mediaUrl: dataUri,
        signedUrl: dataUri
      };
    }

    // Live Google Cloud Storage
    const bucket = storageClient.bucket(config.GCS_BUCKET_NAME);
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      },
      resumable: false,
      validation: 'crc32c'
    });

    // Backend media URL served via Cloud Run service account
    const mediaUrl = `/api/media/${destinationPath}`;

    return {
      objectPath: destinationPath,
      mediaUrl
    };
  }

  /**
   * Backward-compatible alias for uploadPhoto
   */
  async uploadItemPhoto(
    buffer: Buffer,
    destinationPath: string,
    mimeType: string
  ): Promise<{ objectPath: string; url: string }> {
    const res = await this.uploadPhoto(buffer, destinationPath, mimeType);
    return {
      objectPath: res.objectPath,
      url: res.mediaUrl
    };
  }

  /**
   * Deletes a photo from Cloud Storage (used for rollback on failed database writes or cleanup).
   */
  async deletePhoto(objectPath: string): Promise<boolean> {
    const config = getAppConfig();
    if (config.DEMO_MODE || objectPath.startsWith('demo://')) {
      const demoPath = objectPath.replace('demo://', '');
      return this.demoMemoryStore.delete(demoPath);
    }

    const storageClient = this.getStorageClient();
    if (!storageClient || !config.GCS_BUCKET_NAME) return false;

    try {
      const bucket = storageClient.bucket(config.GCS_BUCKET_NAME);
      const file = bucket.file(objectPath);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`Failed to delete object ${objectPath}:`, err);
      return false;
    }
  }

  /**
   * Downloads photo buffer and metadata from Cloud Storage or demo store.
   */
  async getPhotoStream(
    objectPath: string
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const config = getAppConfig();

    if (config.DEMO_MODE || objectPath.startsWith('demo://')) {
      const demoPath = objectPath.replace('demo://', '');
      const item = this.demoMemoryStore.get(demoPath);
      if (!item) return null;
      return { buffer: item.buffer, contentType: item.mimeType };
    }

    const storageClient = this.getStorageClient();
    if (!storageClient || !config.GCS_BUCKET_NAME) return null;

    try {
      const bucket = storageClient.bucket(config.GCS_BUCKET_NAME);
      const file = bucket.file(objectPath);
      const [exists] = await file.exists();
      if (!exists) return null;

      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();

      return {
        buffer,
        contentType: (metadata.contentType as string) || 'image/jpeg'
      };
    } catch (err) {
      console.error(`Error reading object ${objectPath} from GCS:`, err);
      return null;
    }
  }

  /**
   * Generates signed URL if explicitly needed
   */
  async getSignedUrl(objectPath: string): Promise<string | null> {
    const config = getAppConfig();
    if (config.DEMO_MODE || objectPath.startsWith('demo://')) {
      const demoPath = objectPath.replace('demo://', '');
      const item = this.demoMemoryStore.get(demoPath);
      if (!item) return null;
      return `data:${item.mimeType};base64,${item.buffer.toString('base64')}`;
    }

    const storageClient = this.getStorageClient();
    if (!storageClient || !config.GCS_BUCKET_NAME) return null;

    try {
      const bucket = storageClient.bucket(config.GCS_BUCKET_NAME);
      const file = bucket.file(objectPath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000
      });
      return signedUrl;
    } catch {
      return null;
    }
  }
}

export const cloudStorageService = new CloudStorageService();
