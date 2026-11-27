"use client";

import Link from 'next/link';
import { ArrowRight, CalendarDays, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WhatsAppConnectPanel } from '@/components/whatsapp/WhatsAppConnectPanel';

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2.5">
            <MessageSquare className="h-8 w-8 text-emerald-600" />
            ربط واتساب (WhatsApp Cloud API)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تجهيز الربط الرسمي مع Meta لاستقبال طلبات الحجز وإرسال تذكيرات المواعيد، مع إبقاء جميع المفاتيح السرية على الخادم.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" asChild>
            <Link href="/appointments">
              <CalendarDays className="ms-2 h-4 w-4" />
              المواعيد
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/patients">
              <Users className="ms-2 h-4 w-4" />
              المرضى
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowRight className="ms-2 h-4 w-4" />
              لوحة التحكم
            </Link>
          </Button>
        </div>
      </div>

      <WhatsAppConnectPanel showInboxAndTester={true} />
    </div>
  );
}
