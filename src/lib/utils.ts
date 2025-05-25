
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
      return pathParts.slice(bucketIndex + 1).join('/');
    }
    
    console.warn(`Could not extract storage path from URL: ${publicUrl}. Bucket name "${bucketName}" not found or path is incomplete.`);
    return null;
  } catch (error) {
    console.error("Error parsing URL to get storage path:", publicUrl, error);
    return null;
  }
}
