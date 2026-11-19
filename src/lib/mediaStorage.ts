import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export type MediaFolder =
  | 'products'
  | 'variants'
  | 'banners'
  | 'founder'
  | 'blogs'
  | 'reviews'
  | 'reels'
  | 'branding';

export interface UploadedMediaResult {
  url: string;
  storagePath: string;
  provider: 'firebase' | 'cloudinary';
  contentType: string;
  size: number;
}

export interface MediaUploadOptions {
  folder: MediaFolder;
  onProgress?: (percent: number) => void;
}

/**
 * Modular media storage provider interface.
 * Currently backed by Firebase Storage; designed so Cloudinary can be swapped in
 * without modifying any storefront or admin UI components.
 */
export interface MediaStorageProvider {
  readonly providerName: 'firebase' | 'cloudinary';
  upload(file: File, options: MediaUploadOptions): Promise<UploadedMediaResult>;
  delete(storagePath: string): Promise<void>;
}

function sanitizeFileName(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || 'media-file';
}

const firebaseMediaStorageProvider: MediaStorageProvider = {
  providerName: 'firebase',

  async upload(file: File, options: MediaUploadOptions): Promise<UploadedMediaResult> {
    const safeName = sanitizeFileName(file.name);
    const uniqueKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const storagePath = `zarifly/${options.folder}/${uniqueKey}`;
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000',
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            options.onProgress?.(pct);
          }
        },
        (error) => {
          const code = (error as any)?.code || '';
          if (code === 'storage/unauthorized') {
            reject(
              new Error(
                'Firebase Storage upload denied. Please ensure Firebase Storage is enabled in Firebase Console and you are signed in as Admin.'
              )
            );
          } else if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
            reject(
              new Error(
                'Firebase Storage bucket is not initialized yet. Enable Storage in your Firebase Console to upload files directly.'
              )
            );
          } else {
            reject(new Error(error.message || 'Upload failed. Please retry.'));
          }
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            options.onProgress?.(100);
            resolve({
              url,
              storagePath,
              provider: 'firebase',
              contentType: file.type || 'application/octet-stream',
              size: file.size,
            });
          } catch (err: any) {
            reject(new Error(err?.message || 'Failed to retrieve download URL.'));
          }
        }
      );
    });
  },

  async delete(storagePath: string): Promise<void> {
    if (!storagePath || storagePath.startsWith('http')) return;
    try {
      await deleteObject(ref(storage, storagePath));
    } catch {
      // Ignore missing-object errors during cleanup
    }
  },
};

// Active storage provider (swap here in future if migrating to Cloudinary)
export const activeMediaStorage: MediaStorageProvider = firebaseMediaStorageProvider;

export async function uploadMediaFile(
  file: File,
  folder: MediaFolder,
  onProgress?: (percent: number) => void
): Promise<UploadedMediaResult> {
  return activeMediaStorage.upload(file, { folder, onProgress });
}

export async function deleteMediaFile(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  return activeMediaStorage.delete(storagePath);
}
