
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the storage path inside a Supabase bucket from either:
 * - a full Supabase Storage URL (public, signed, or authenticated)
 * - or a direct relative storage path like "public/image.webp"
 */
export function getStoragePathFromUrl(urlOrPath: string, bucketName = 'patient-images'): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return null;
  }

  // Handle direct relative storage path (e.g. "public/patient-123.webp" or "/patient-images/public/...")
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const withoutLeadingSlashes = trimmed.replace(/^\/+/, '');
    if (withoutLeadingSlashes.startsWith(`${bucketName}/`)) {
      return withoutLeadingSlashes.slice(bucketName.length + 1) || null;
    }
    return withoutLeadingSlashes;
  }

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.indexOf(bucketName);

    if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
      return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
    }

    return null;
  } catch (error) {
    console.error("Error parsing URL to get storage path:", urlOrPath, error);
    return null;
  }
}

export function isDisplayableImageSrc(src?: string | null): boolean {
  if (!src) return false;
  return (
    src.startsWith('https://') ||
    src.startsWith('http://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('/')
  );
}

/**
 * Compresses and resizes an image File in the browser to WebP format.
 * Falls back to the original file if running outside a browser or on error.
 */
export async function compressImageToWebP(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  try {
    const imageBitmap = await createImageBitmap(file);
    const originalWidth = imageBitmap.width;
    const scale = originalWidth > maxWidth ? maxWidth / originalWidth : 1;
    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      imageBitmap.close();
      return file;
    }

    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
    imageBitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );

    if (!blob || blob.size === 0 || blob.type !== 'image/webp') {
      return file;
    }

    if (file.type === 'image/webp' && originalWidth <= maxWidth && blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } catch (error) {
    console.warn('Image compression failed, uploading original file:', error);
    return file;
  }
}

