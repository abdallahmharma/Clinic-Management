import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest, sendWhatsAppCloudMessage } from '@/lib/whatsapp-server';

const sendMessageSchema = z.object({
  to: z.string().trim().min(7, 'رقم الهاتف مطلوب').max(30),
  message: z.string().trim().min(1, 'نص الرسالة مطلوب').max(4096, 'الرسالة طويلة جداً'),
  patientId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden origin.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'صيغة JSON غير صالحة.' }, { status: 400 });
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || 'بيانات الإرسال غير صالحة.',
      },
      { status: 400 }
    );
  }

  const result = await sendWhatsAppCloudMessage({
    to: parsed.data.to,
    text: parsed.data.message,
    patientId: parsed.data.patientId,
  });

  return NextResponse.json(result, { status: result.status });
}
