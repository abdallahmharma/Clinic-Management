import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Json } from '@/lib/database.types';
import {
  DEFAULT_WHATSAPP_CONNECTION,
  getServerSupabaseClient,
  getWhatsAppEnvReadiness,
  isMissingWhatsAppTableError,
  isSameOriginRequest,
  mapConnectionRow,
  mapMessageRow,
} from '@/lib/whatsapp-server';

const updateConnectionSchema = z.object({
  action: z.literal('update_connection').optional(),
  connectionMode: z.enum(['new_cloud_number', 'existing_business_app']).optional(),
  displayPhoneNumber: z.string().trim().max(30).optional(),
  businessName: z.string().trim().max(120).optional(),
  checklistState: z
    .object({
      meta_business: z.boolean(),
      phone_prepared: z.boolean(),
      webhook_verified: z.boolean(),
      payment_later: z.boolean(),
    })
    .optional(),
});

const updateMessageStatusSchema = z.object({
  action: z.literal('update_message_status'),
  messageId: z.string().uuid('معرف الرسالة غير صالح'),
  requestStatus: z.enum(['new', 'reviewed', 'converted', 'archived']),
});

export async function GET() {
  const envReadiness = getWhatsAppEnvReadiness();
  const client = getServerSupabaseClient();

  if (!client) {
    return NextResponse.json({
      envReadiness,
      connection: DEFAULT_WHATSAPP_CONNECTION,
      recentMessages: [],
      dbReady: false,
      supabaseConfigured: false,
    });
  }

  try {
    const [connRes, msgRes] = await Promise.all([
      client.from('whatsapp_connections').select('*').eq('id', 'default').maybeSingle(),
      client
        .from('whatsapp_messages')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(30),
    ]);

    if (
      isMissingWhatsAppTableError(connRes.error) ||
      isMissingWhatsAppTableError(msgRes.error)
    ) {
      return NextResponse.json({
        envReadiness,
        connection: DEFAULT_WHATSAPP_CONNECTION,
        recentMessages: [],
        dbReady: false,
        supabaseConfigured: true,
      });
    }

    if (connRes.error) throw connRes.error;
    if (msgRes.error) throw msgRes.error;

    return NextResponse.json({
      envReadiness,
      connection: mapConnectionRow(connRes.data),
      recentMessages: (msgRes.data || []).map(mapMessageRow),
      dbReady: true,
      supabaseConfigured: true,
    });
  } catch (error) {
    console.error('Error reading WhatsApp status:', error);
    return NextResponse.json(
      {
        envReadiness,
        connection: DEFAULT_WHATSAPP_CONNECTION,
        recentMessages: [],
        dbReady: false,
        supabaseConfigured: true,
        error: 'تعذر قراءة حالة ربط واتساب من قاعدة البيانات.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'صيغة JSON غير صالحة.' }, { status: 400 });
  }

  const client = getServerSupabaseClient();
  if (!client) {
    return NextResponse.json(
      { error: 'قاعدة البيانات Supabase غير مهيأة بعد.' },
      { status: 503 }
    );
  }

  if (
    body &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).action === 'update_message_status'
  ) {
    const parsedMsg = updateMessageStatusSchema.safeParse(body);
    if (!parsedMsg.success) {
      return NextResponse.json(
        { error: parsedMsg.error.issues[0]?.message || 'بيانات غير صالحة.' },
        { status: 400 }
      );
    }

    const { data, error } = await client
      .from('whatsapp_messages')
      .update({ request_status: parsedMsg.data.requestStatus })
      .eq('id', parsedMsg.data.messageId)
      .select('*')
      .single();

    if (error) {
      if (isMissingWhatsAppTableError(error)) {
        return NextResponse.json(
          { error: 'جدول whatsapp_messages غير موجود بعد. نفّذ كود SQL أولاً.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'تعذر تحديث حالة الرسالة.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: mapMessageRow(data) });
  }

  const parsedConn = updateConnectionSchema.safeParse(body);
  if (!parsedConn.success) {
    return NextResponse.json(
      { error: parsedConn.error.issues[0]?.message || 'بيانات الإعدادات غير صالحة.' },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const payloadToUpsert: {
    id: string;
    updated_at: string;
    connection_mode?: string;
    display_phone_number?: string | null;
    business_name?: string | null;
    checklist_state?: Json;
  } = {
    id: 'default',
    updated_at: nowIso,
  };

  if (parsedConn.data.connectionMode !== undefined) {
    payloadToUpsert.connection_mode = parsedConn.data.connectionMode;
  }
  if (parsedConn.data.displayPhoneNumber !== undefined) {
    payloadToUpsert.display_phone_number = parsedConn.data.displayPhoneNumber || null;
  }
  if (parsedConn.data.businessName !== undefined) {
    payloadToUpsert.business_name = parsedConn.data.businessName || null;
  }
  if (parsedConn.data.checklistState !== undefined) {
    payloadToUpsert.checklist_state = parsedConn.data.checklistState as unknown as Json;
  }

  const { data, error } = await client
    .from('whatsapp_connections')
    .upsert(payloadToUpsert, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (isMissingWhatsAppTableError(error)) {
      return NextResponse.json(
        { error: 'جدول whatsapp_connections غير موجود بعد. نفّذ كود SQL في Supabase أولاً.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'تعذر حفظ إعدادات ربط واتساب.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, connection: mapConnectionRow(data) });
}
