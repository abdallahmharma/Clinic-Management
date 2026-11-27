import { NextRequest, NextResponse } from 'next/server';
import type { Json } from '@/lib/database.types';
import {
  findPatientIdByPhone,
  getServerSupabaseClient,
  getVerifyTokenFromEnv,
  isMissingWhatsAppTableError,
  timingSafeStringEqual,
  verifyMetaWebhookSignature,
} from '@/lib/whatsapp-server';

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string; payload?: string };
          interactive?: {
            type?: string;
            button_reply?: { title?: string; id?: string };
            list_reply?: { title?: string; id?: string };
          };
          image?: { caption?: string };
          document?: { caption?: string; filename?: string };
          audio?: Record<string, unknown>;
          video?: { caption?: string };
          location?: { name?: string; address?: string };
        }>;
      };
    }>;
  }>;
}

function extractReadableMessageBody(
  msg: NonNullable<
    NonNullable<
      NonNullable<MetaWebhookPayload['entry']>[number]['changes']
    >[number]['value']
  >['messages'] extends Array<infer T> | undefined
    ? T
    : never
): string {
  if (!msg) return '';
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.image?.caption) return `[صورة] ${msg.image.caption}`;
  if (msg.document?.filename || msg.document?.caption) {
    return `[ملف] ${msg.document.caption || msg.document.filename}`;
  }
  if (msg.video?.caption) return `[فيديو] ${msg.video.caption}`;
  if (msg.location?.name || msg.location?.address) {
    return `[موقع] ${msg.location.name || msg.location.address}`;
  }
  return `[رسالة ${msg.type || 'غير نصية'}]`;
}

/**
 * GET /api/whatsapp/webhook
 * Meta Cloud API Webhook Verification endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedVerifyToken = getVerifyTokenFromEnv();
  if (!expectedVerifyToken) {
    return NextResponse.json(
      {
        error: 'WHATSAPP_VERIFY_TOKEN is not configured on the server.',
      },
      { status: 503 }
    );
  }

  if (
    mode === 'subscribe' &&
    token &&
    challenge &&
    timingSafeStringEqual(token, expectedVerifyToken)
  ) {
    const client = getServerSupabaseClient();
    if (client) {
      try {
        const nowIso = new Date().toISOString();
        const { data: existing } = await client
          .from('whatsapp_connections')
          .select('connection_status')
          .eq('id', 'default')
          .maybeSingle();

        const nextStatus =
          existing?.connection_status === 'connected' ? 'connected' : 'webhook_verified';

        await client.from('whatsapp_connections').upsert(
          {
            id: 'default',
            connection_status: nextStatus,
            last_webhook_at: nowIso,
            last_error: null,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        );
      } catch {
        // Do not fail Meta verification if optional DB table is not migrated yet
      }
    }

    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return NextResponse.json({ error: 'Invalid webhook verification token.' }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages / booking requests from Meta Cloud API
 */
export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request body.' }, { status: 400 });
  }

  const signatureCheck = verifyMetaWebhookSignature(
    rawBody,
    request.headers.get('x-hub-signature-256')
  );
  if (!signatureCheck.ok) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }

  const client = getServerSupabaseClient();
  const nowIso = new Date().toISOString();
  let storedCount = 0;
  let dbWarning: string | undefined;

  if (client && Array.isArray(payload.entry)) {
    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
          continue;
        }

        const contactsMap = new Map<string, string>();
        for (const contact of value.contacts || []) {
          if (contact.wa_id && contact.profile?.name) {
            contactsMap.set(contact.wa_id, contact.profile.name);
          }
        }

        const recipientPhone =
          value.metadata?.display_phone_number || value.metadata?.phone_number_id || null;

        for (const msg of value.messages) {
          if (!msg.from) continue;

          const bodyText = extractReadableMessageBody(msg).slice(0, 4000);
          const timestampSec = msg.timestamp ? Number(msg.timestamp) : NaN;
          const receivedAt = Number.isFinite(timestampSec)
            ? new Date(timestampSec * 1000).toISOString()
            : nowIso;
          const patientId = await findPatientIdByPhone(client, msg.from);
          const contactName = contactsMap.get(msg.from) || null;

          const recordToSave = {
            wa_message_id: msg.id || null,
            direction: 'inbound',
            from_phone: msg.from,
            to_phone: recipientPhone,
            contact_name: contactName,
            patient_id: patientId,
            message_type: msg.type || 'text',
            message_body: bodyText,
            request_status: 'new',
            raw_payload: msg as unknown as Json,
            received_at: receivedAt,
          };

          const { error: insertErr } = msg.id
            ? await client
                .from('whatsapp_messages')
                .upsert(recordToSave, { onConflict: 'wa_message_id' })
            : await client.from('whatsapp_messages').insert(recordToSave);

          if (insertErr) {
            if (isMissingWhatsAppTableError(insertErr)) {
              dbWarning = 'whatsapp_messages table is not created yet.';
              break;
            }
            console.warn('Error storing incoming WhatsApp message:', insertErr.message);
          } else {
            storedCount += 1;
          }
        }
      }
    }

    try {
      await client.from('whatsapp_connections').upsert(
        {
          id: 'default',
          connection_status: 'connected',
          last_webhook_at: nowIso,
          last_error: null,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
    } catch {
      // Ignore connection status update failure if DB table is not created yet
    }
  } else if (!client) {
    dbWarning = 'Supabase client is not configured.';
  }

  return NextResponse.json(
    {
      ok: true,
      received: true,
      storedCount,
      ...(dbWarning ? { warning: dbWarning } : {}),
    },
    { status: 200 }
  );
}
