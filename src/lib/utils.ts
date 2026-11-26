
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

/**
 * Formats a Jordanian phone number into international WhatsApp format without "+" or spaces:
 * - "07XXXXXXXX" or "7XXXXXXXX" -> "9627XXXXXXXX"
 * - "+962..." / "00962..." / "962..." -> "962..."
 * Returns null if the number is missing or invalid.
 */
export function formatJordanPhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('9620') && digits.length >= 12) {
    digits = `962${digits.slice(4)}`;
  }

  if (digits.startsWith('962')) {
    return digits.length >= 11 && digits.length <= 13 ? digits : null;
  }

  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return `962${digits.slice(1)}`;
  }

  if (digits.startsWith('7') && digits.length === 9) {
    return `962${digits}`;
  }

  return null;
}

export interface BuildWhatsAppUrlParams {
  phone?: string | null;
  patientName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  sessionType?: string;
  customMessage?: string;
}

/**
 * Builds a direct https://wa.me/<phone>?text=<encodedMessage> link with a clean Arabic reminder or contact message.
 * Returns null if the phone number cannot be formatted to a valid Jordanian number.
 */
export function buildWhatsAppUrl({
  phone,
  patientName,
  appointmentDate,
  appointmentTime,
  sessionType,
  customMessage,
}: BuildWhatsAppUrlParams): string | null {
  const formattedPhone = formatJordanPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const recipient = patientName?.trim() || 'مريضنا الكريم';
  let message = customMessage?.trim();

  if (!message) {
    if (appointmentDate || appointmentTime || sessionType) {
      const lines = [`مرحباً ${recipient}، نود تذكيرك بموعدك في العيادة:`];
      if (appointmentDate) lines.push(`التاريخ: ${appointmentDate}`);
      if (appointmentTime) lines.push(`الوقت: ${appointmentTime}`);
      if (sessionType) lines.push(`نوع الجلسة: ${sessionType}`);
      lines.push('نرجو التواصل معنا في حال الرغبة بتعديل الموعد. نتمنى لك دوام الصحة والعافية.');
      message = lines.join('\n');
    } else {
      message = `مرحباً ${recipient}، نتواصل معك من العيادة بخصوص متابعتك الطبية.`;
    }
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}


