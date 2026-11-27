import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import type {
  WhatsAppChecklistState,
  WhatsAppConnectionConfig,
  WhatsAppConnectionMode,
  WhatsAppConnectionStatus,
  WhatsAppEnvReadiness,
  WhatsAppMessageDirection,
  WhatsAppMessageRecord,
  WhatsAppMessageRequestStatus,
} from './types';
import { formatJordanPhoneForWhatsApp } from './utils';

export const DEFAULT_CHECKLIST_STATE: WhatsAppChecklistState = {
  meta_business: false,
  phone_prepared: false,
  webhook_verified: false,
  payment_later: false,
};

export const DEFAULT_WHATSAPP_CONNECTION: WhatsAppConnectionConfig = {
  id: 'default',
  connectionMode: 'new_cloud_number',
  connectionStatus: 'pending_setup',
  displayPhoneNumber: '',
  businessName: '',
  checklistState: DEFAULT_CHECKLIST_STATE,
};

function sanitizeEnvValue(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/^[\["']+/, '').replace(/[\]"']+$/, '').trim();
  return cleaned || undefined;
}

function isValidHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getServerSupabaseClient() {
  const supabaseUrl = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = sanitizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const keyToUse = serviceKey || anonKey;

  if (
    !supabaseUrl ||
    !keyToUse ||
    !isValidHttpUrl(supabaseUrl) ||
    supabaseUrl.includes('your_supabase_url') ||
    keyToUse.includes('your_supabase_anon_key')
  ) {
    return null;
  }

  return createClient<Database>(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isMissingWhatsAppTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find the table');
}

export function getWhatsAppEnvReadiness(): WhatsAppEnvReadiness {
  const hasAccessToken = Boolean(sanitizeEnvValue(process.env.WHATSAPP_ACCESS_TOKEN));
  const hasPhoneNumberId = Boolean(sanitizeEnvValue(process.env.WHATSAPP_PHONE_NUMBER_ID));
  const hasVerifyToken = Boolean(sanitizeEnvValue(process.env.WHATSAPP_VERIFY_TOKEN));
  const hasAppSecret = Boolean(sanitizeEnvValue(process.env.WHATSAPP_APP_SECRET));
  const hasWabaId = Boolean(sanitizeEnvValue(process.env.WHATSAPP_WABA_ID));

  return {
    hasAccessToken,
    hasPhoneNumberId,
    hasVerifyToken,
    hasAppSecret,
    hasWabaId,
    isReadyToSend: hasAccessToken && hasPhoneNumberId,
    isWebhookConfigured: hasVerifyToken,
  };
}

export function getVerifyTokenFromEnv(): string | undefined {
  return sanitizeEnvValue(process.env.WHATSAPP_VERIFY_TOKEN);
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): { ok: boolean; enforced: boolean } {
  const appSecret = sanitizeEnvValue(process.env.WHATSAPP_APP_SECRET);
  if (!appSecret) {
    return { ok: true, enforced: false };
  }

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, enforced: true };
  }

  const expectedHex = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  const providedHex = signatureHeader.slice('sha256='.length).trim();

  if (!/^[0-9a-f]{64}$/i.test(providedHex)) {
    return { ok: false, enforced: true };
  }

  const bufExpected = Buffer.from(expectedHex, 'hex');
  const bufProvided = Buffer.from(providedHex.toLowerCase(), 'hex');
  return {
    ok: bufExpected.length === bufProvided.length && crypto.timingSafeEqual(bufExpected, bufProvided),
    enforced: true,
  };
}

export function normalizeOutboundWhatsAppNumber(rawPhone: string): string | null {
  const jordanFormatted = formatJordanPhoneForWhatsApp(rawPhone);
  if (jordanFormatted) return jordanFormatted;

  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (/^[1-9]\d{7,14}$/.test(digits)) {
    return digits;
  }
  return null;
}

export function normalizeChecklistState(raw: unknown): WhatsAppChecklistState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_CHECKLIST_STATE };
  }
  const obj = raw as Record<string, unknown>;
  return {
    meta_business: Boolean(obj.meta_business),
    phone_prepared: Boolean(obj.phone_prepared),
    webhook_verified: Boolean(obj.webhook_verified),
    payment_later: Boolean(obj.payment_later),
  };
}

export function mapConnectionRow(
  row: Database['public']['Tables']['whatsapp_connections']['Row'] | null | undefined
): WhatsAppConnectionConfig {
  if (!row) return { ...DEFAULT_WHATSAPP_CONNECTION };
  const mode: WhatsAppConnectionMode =
    row.connection_mode === 'existing_business_app'
      ? 'existing_business_app'
      : 'new_cloud_number';
  const validStatuses: WhatsAppConnectionStatus[] = [
    'pending_setup',
    'webhook_verified',
    'connected',
    'error',
  ];
  const status: WhatsAppConnectionStatus = validStatuses.includes(
    row.connection_status as WhatsAppConnectionStatus
  )
    ? (row.connection_status as WhatsAppConnectionStatus)
    : 'pending_setup';

  return {
    id: row.id,
    connectionMode: mode,
    connectionStatus: status,
    displayPhoneNumber: row.display_phone_number || '',
    businessName: row.business_name || '',
    checklistState: normalizeChecklistState(row.checklist_state),
    lastWebhookAt: row.last_webhook_at || undefined,
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function mapMessageRow(
  row: Database['public']['Tables']['whatsapp_messages']['Row']
): WhatsAppMessageRecord {
  const direction: WhatsAppMessageDirection =
    row.direction === 'outbound' ? 'outbound' : 'inbound';
  const validStatuses: WhatsAppMessageRequestStatus[] = [
    'new',
    'reviewed',
    'converted',
    'archived',
    'sent',
    'failed',
  ];
  const requestStatus: WhatsAppMessageRequestStatus = validStatuses.includes(
    row.request_status as WhatsAppMessageRequestStatus
  )
    ? (row.request_status as WhatsAppMessageRequestStatus)
    : direction === 'outbound'
      ? 'sent'
      : 'new';

  return {
    id: row.id,
    waMessageId: row.wa_message_id || undefined,
    direction,
    fromPhone: row.from_phone,
    toPhone: row.to_phone || undefined,
    contactName: row.contact_name || undefined,
    patientId: row.patient_id || undefined,
    messageType: row.message_type || 'text',
    messageBody: row.message_body,
    requestStatus,
    receivedAt: row.received_at,
  };
}

export async function findPatientIdByPhone(
  client: NonNullable<ReturnType<typeof getServerSupabaseClient>>,
  rawPhone: string
): Promise<string | null> {
  const digits = rawPhone.replace(/\D/g, '');
  const tailDigits = digits.slice(-9);
  if (!/^\d{7,12}$/.test(tailDigits)) {
    return null;
  }

  try {
    const { data, error } = await client
      .from('patients')
      .select('id')
      .ilike('phone', `%${tailDigits}`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }
    return data[0].id;
  } catch {
    return null;
  }
}

export interface SendWhatsAppCloudResult {
  ok: boolean;
  configured: boolean;
  status: number;
  messageId?: string;
  to?: string;
  error?: string;
  storedInDb?: boolean;
}

export async function sendWhatsAppCloudMessage(input: {
  to: string;
  text: string;
  patientId?: string;
}): Promise<SendWhatsAppCloudResult> {
  const accessToken = sanitizeEnvValue(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = sanitizeEnvValue(process.env.WHATSAPP_PHONE_NUMBER_ID);

  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      configured: false,
      status: 503,
      error:
        'إعدادات WhatsApp Cloud API غير مكتملة على الخادم (يرجى ضبط WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID في متغيرات البيئة).',
    };
  }

  const normalizedTo = normalizeOutboundWhatsAppNumber(input.to);
  if (!normalizedTo) {
    return {
      ok: false,
      configured: true,
      status: 400,
      error: 'رقم الهاتف غير صالح للإرسال عبر WhatsApp Cloud API.',
    };
  }

  const trimmedText = input.text.trim();
  if (!trimmedText || trimmedText.length > 4096) {
    return {
      ok: false,
      configured: true,
      status: 400,
      error: 'نص الرسالة يجب أن يكون بين 1 و 4096 حرفاً.',
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;

  let metaResponseData: Record<string, unknown> | null = null;
  let metaOk = false;
  let metaErrorMessage = '';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizedTo,
        type: 'text',
        text: {
          preview_url: false,
          body: trimmedText,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    metaResponseData = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.ok) {
      metaOk = true;
    } else {
      const apiErr = metaResponseData?.error as { message?: string; code?: number } | undefined;
      metaErrorMessage =
        apiErr?.message || `فشل الإرسال من خادم Meta (HTTP ${response.status}).`;
    }
  } catch (err) {
    metaErrorMessage =
      err instanceof Error
        ? `تعذر الاتصال بخادم WhatsApp Cloud API: ${err.message}`
        : 'تعذر الاتصال بخادم WhatsApp Cloud API.';
  }

  const messagesArr = metaResponseData?.messages as Array<{ id?: string }> | undefined;
  const waMessageId = messagesArr?.[0]?.id || undefined;

  let storedInDb = false;
  const client = getServerSupabaseClient();
  if (client) {
    try {
      const resolvedPatientId =
        input.patientId || (await findPatientIdByPhone(client, normalizedTo));
      const { error: dbErr } = await client.from('whatsapp_messages').insert({
        wa_message_id: waMessageId || null,
        direction: 'outbound',
        from_phone: phoneNumberId,
        to_phone: normalizedTo,
        patient_id: resolvedPatientId || null,
        message_type: 'text',
        message_body: trimmedText,
        request_status: metaOk ? 'sent' : 'failed',
        raw_payload: (metaResponseData as Json) || null,
        received_at: new Date().toISOString(),
      });
      if (!dbErr) {
        storedInDb = true;
      } else if (!isMissingWhatsAppTableError(dbErr)) {
        console.warn('Warning storing outbound WhatsApp message:', dbErr.message);
      }
    } catch {
      // Never mask Cloud API result due to optional log insert
    }
  }

  if (!metaOk) {
    return {
      ok: false,
      configured: true,
      status: 502,
      to: normalizedTo,
      error: metaErrorMessage,
      storedInDb,
    };
  }

  return {
    ok: true,
    configured: true,
    status: 200,
    messageId: waMessageId,
    to: normalizedTo,
    storedInDb,
  };
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return true;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}
