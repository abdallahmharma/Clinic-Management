
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts the storage path from a Supabase public URL.
 * @param publicUrl The public URL of the file in Supabase Storage.
 * @param bucketName The name of the bucket.
 * @returns The file path within the bucket, or null if parsing fails.
 * Example: "public/image.jpg"
 */
export function getStoragePathFromUrl(publicUrl: string, bucketName: string): string | null {
  try {
    const url = new URL(publicUrl);
    // Expected pathname format: /storage/v1/object/public/bucketName/path/to/file.jpg
    // Or for non-public files (if used, though typically these are public URLs):
    // /storage/v1/object/authenticated/bucketName/path/to/file.jpg
    const pathParts = url.pathname.split('/');
    
    // Find the index of the bucket name in the path
    const bucketIndex = pathParts.indexOf(bucketName);

    if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
      // The actual file path is everything after the bucket name
      return decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'));
    }
    
    console.warn(`Could not extract storage path from URL: ${publicUrl}. Bucket name "${bucketName}" not found or path is incomplete.`);
    return null;
  } catch (error) {
    console.error("Error parsing URL to get storage path:", publicUrl, error);
    return null;
  }
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

