import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryStatus {
  configured: boolean;
  cloudName: string;
  apiKey: string;
  folder: string;
}

export function getCloudinaryConfig(): CloudinaryStatus {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = (process.env.CLOUDINARY_UPLOAD_FOLDER || 'zarifly').trim();

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  return {
    configured: Boolean(cloudName && apiKey && apiSecret),
    cloudName,
    apiKey,
    folder,
  };
}

export function generateCloudinaryUploadSignature(subfolder = 'products') {
  const cfg = getCloudinaryConfig();
  if (!cfg.configured) {
    return null;
  }
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${cfg.folder}/${subfolder}`;
  const paramsToSign = {
    timestamp,
    folder,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!.trim()
  );

  return {
    signature,
    timestamp,
    folder,
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
  };
}

export function optimizeCloudinaryUrl(url: string, width = 900): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
}
