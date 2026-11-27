"use client";

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Webhook,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type {
  WhatsAppChecklistState,
  WhatsAppConnectionConfig,
  WhatsAppConnectionMode,
  WhatsAppConnectionStatus,
  WhatsAppEnvReadiness,
  WhatsAppMessageRecord,
  WhatsAppMessageRequestStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface WhatsAppStatusApiResponse {
  envReadiness: WhatsAppEnvReadiness;
  connection: WhatsAppConnectionConfig;
  recentMessages: WhatsAppMessageRecord[];
  dbReady: boolean;
  supabaseConfigured: boolean;
  error?: string;
}

interface WhatsAppConnectPanelProps {
  showInboxAndTester?: boolean;
  onNavigateAway?: () => void;
}

const DEFAULT_CHECKLIST: WhatsAppChecklistState = {
  meta_business: false,
  phone_prepared: false,
  webhook_verified: false,
  payment_later: false,
};

const DEFAULT_ENV_READINESS: WhatsAppEnvReadiness = {
  hasAccessToken: false,
  hasPhoneNumberId: false,
  hasVerifyToken: false,
  hasAppSecret: false,
  hasWabaId: false,
  isReadyToSend: false,
  isWebhookConfigured: false,
};

const CHECKLIST_ITEMS: Array<{
  key: keyof WhatsAppChecklistState;
  title: string;
  description: string;
}> = [
  {
    key: 'meta_business',
    title: 'تجهيز حساب Meta Business وتطبيق WhatsApp في Meta Developers',
    description: 'إنشاء تطبيق Business وإضافة منتج WhatsApp للحصول على معرف الرقم ورمز الوصول.',
  },
  {
    key: 'phone_prepared',
    title: 'اختيار وتجهيز رقم الهاتف المخصص للعيادة',
    description: 'تحديد ما إذا كنت ستستخدم رقماً جديداً على Cloud API أو رقم واتساب Business الحالي.',
  },
  {
    key: 'webhook_verified',
    title: 'ضبط متغيرات البيئة في الخادم وتوثيق رابط الـ Webhook',
    description: 'إدخال رابط الـ Webhook أدناه مع رمز التحقق (WHATSAPP_VERIFY_TOKEN) داخل لوحة Meta.',
  },
  {
    key: 'payment_later',
    title: 'تأجيل إضافة طريقة الدفع لما بعد نجاح الربط والتحقق',
    description: 'التأكد من نجاح التحقق من الرقم والـ Webhook قبل ربط البطاقة البنكية في Meta Business.',
  },
];

const REQUEST_STATUS_OPTIONS: Array<{
  value: 'new' | 'reviewed' | 'converted' | 'archived';
  label: string;
}> = [
  { value: 'new', label: 'طلب جديد' },
  { value: 'reviewed', label: 'تمت المراجعة' },
  { value: 'converted', label: 'تم تحويله لموعد' },
  { value: 'archived', label: 'مؤرشف' },
];

function getConnectionStatusBadge(status: WhatsAppConnectionStatus) {
  switch (status) {
    case 'connected':
      return {
        label: 'متصل ونشط',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'webhook_verified':
      return {
        label: 'تم التحقق من Webhook',
        className: 'bg-sky-100 text-sky-800 border-sky-200',
      };
    case 'error':
      return {
        label: 'يوجد خطأ في الربط',
        className: 'bg-red-100 text-red-800 border-red-200',
      };
    case 'pending_setup':
    default:
      return {
        label: 'قيد الإعداد',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
  }
}

function getMessageStatusLabel(status: WhatsAppMessageRequestStatus): string {
  switch (status) {
    case 'new':
      return 'طلب جديد';
    case 'reviewed':
      return 'تمت المراجعة';
    case 'converted':
      return 'تم تحويله لموعد';
    case 'archived':
      return 'مؤرشف';
    case 'sent':
      return 'تم الإرسال';
    case 'failed':
      return 'فشل الإرسال';
    default:
      return status;
  }
}

function formatDateTimeSafe(iso?: string): string {
  if (!iso) return 'غير مسجل بعد';
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return 'غير محدد';
    return format(parsed, 'd MMM yyyy - HH:mm', { locale: arSA });
  } catch {
    return 'غير محدد';
  }
}

export function WhatsAppConnectPanel({
  showInboxAndTester = false,
  onNavigateAway,
}: WhatsAppConnectPanelProps) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [dbReady, setDbReady] = React.useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = React.useState(true);

  const [envReadiness, setEnvReadiness] =
    React.useState<WhatsAppEnvReadiness>(DEFAULT_ENV_READINESS);
  const [connectionStatus, setConnectionStatus] =
    React.useState<WhatsAppConnectionStatus>('pending_setup');
  const [lastWebhookAt, setLastWebhookAt] = React.useState<string | undefined>(undefined);
  const [lastError, setLastError] = React.useState<string | undefined>(undefined);

  const [connectionMode, setConnectionMode] =
    React.useState<WhatsAppConnectionMode>('new_cloud_number');
  const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [checklistState, setChecklistState] =
    React.useState<WhatsAppChecklistState>(DEFAULT_CHECKLIST);

  const [recentMessages, setRecentMessages] = React.useState<WhatsAppMessageRecord[]>([]);
  const [updatingMessageId, setUpdatingMessageId] = React.useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = React.useState('/api/whatsapp/webhook');
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);

  // Outbound test/reminder sender state
  const [sendPhone, setSendPhone] = React.useState('');
  const [sendText, setSendText] = React.useState('');
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [sendFeedback, setSendFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`);
    }
  }, []);

  const loadStatus = React.useCallback(
    async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        const data = (await res.json()) as WhatsAppStatusApiResponse;

        setEnvReadiness(data.envReadiness || DEFAULT_ENV_READINESS);
        setDbReady(Boolean(data.dbReady));
        setSupabaseConfigured(Boolean(data.supabaseConfigured));

        if (data.connection) {
          setConnectionMode(data.connection.connectionMode || 'new_cloud_number');
          setConnectionStatus(data.connection.connectionStatus || 'pending_setup');
          setDisplayPhoneNumber(data.connection.displayPhoneNumber || '');
          setBusinessName(data.connection.businessName || '');
          setChecklistState(data.connection.checklistState || DEFAULT_CHECKLIST);
          setLastWebhookAt(data.connection.lastWebhookAt);
          setLastError(data.connection.lastError);
        }

        setRecentMessages(Array.isArray(data.recentMessages) ? data.recentMessages : []);
      } catch (error) {
        toast({
          title: 'تعذر تحميل حالة واتساب',
          description:
            error instanceof Error ? error.message : 'حدث خطأ أثناء الاتصال بالخادم.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [toast]
  );

  React.useEffect(() => {
    loadStatus(false);
  }, [loadStatus]);

  const handleSaveSettings = async (overrideChecklist?: WhatsAppChecklistState) => {
    const checklistToSave = overrideChecklist || checklistState;
    setIsSaving(true);
    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_connection',
          connectionMode,
          displayPhoneNumber: displayPhoneNumber.trim(),
          businessName: businessName.trim(),
          checklistState: checklistToSave,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'تعذر حفظ الإعدادات',
          description: data?.error || 'تأكد من تنفيذ كود SQL في Supabase أولاً.',
          variant: 'destructive',
        });
        return false;
      }

      if (data?.connection) {
        setConnectionMode(data.connection.connectionMode);
        setConnectionStatus(data.connection.connectionStatus);
        setDisplayPhoneNumber(data.connection.displayPhoneNumber || '');
        setBusinessName(data.connection.businessName || '');
        setChecklistState(data.connection.checklistState || DEFAULT_CHECKLIST);
      }
      setDbReady(true);

      toast({
        title: 'تم حفظ إعدادات ربط واتساب',
        description: 'تم تحديث نوع الربط وقائمة التحقق في قاعدة البيانات بنجاح.',
      });
      return true;
    } catch {
      toast({
        title: 'خطأ في الحفظ',
        description: 'تعذر الاتصال بالخادم لحفظ إعدادات واتساب.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleChecklist = async (
    key: keyof WhatsAppChecklistState,
    checked: boolean
  ) => {
    const nextChecklist: WhatsAppChecklistState = {
      ...checklistState,
      [key]: checked,
    };
    setChecklistState(nextChecklist);

    if (dbReady) {
      await handleSaveSettings(nextChecklist);
    }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast({
        title: 'تم نسخ رابط Webhook',
        description: 'يمكنك لصق الرابط مباشرة في إعدادات Meta WhatsApp Webhooks.',
      });
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast({
        title: 'تعذر النسخ التلقائي',
        description: 'يمكنك تحديد الرابط ونسخه يدوياً من الحقل.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateMessageStatus = async (
    messageId: string,
    nextStatus: 'new' | 'reviewed' | 'converted' | 'archived'
  ) => {
    setUpdatingMessageId(messageId);
    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_message_status',
          messageId,
          requestStatus: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'تعذر تحديث حالة الطلب',
          description: data?.error || 'حدث خطأ أثناء تحديث حالة الرسالة.',
          variant: 'destructive',
        });
        return;
      }

      setRecentMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, requestStatus: nextStatus } : m))
      );
      toast({
        title: 'تم تحديث حالة الرسالة',
        description: `الحالة الجديدة: ${getMessageStatusLabel(nextStatus)}`,
      });
    } catch {
      toast({
        title: 'خطأ في التحديث',
        description: 'تعذر الاتصال بالخادم لتحديث حالة الطلب.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingMessageId(null);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendFeedback(null);

    if (!sendPhone.trim() || !sendText.trim()) {
      setSendFeedback({
        type: 'error',
        message: 'يرجى إدخال رقم الهاتف ونص الرسالة قبل الإرسال.',
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendPhone.trim(),
          message: sendText.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setSendFeedback({
          type: 'error',
          message: data?.error || 'فشل إرسال الرسالة عبر WhatsApp Cloud API.',
        });
        return;
      }

      setSendFeedback({
        type: 'success',
        message: `تم إرسال الرسالة بنجاح إلى ${data.to}${
          data.messageId ? ` (المعرف: ${data.messageId})` : ''
        }.`,
      });
      setSendText('');
      await loadStatus(true);
    } catch {
      setSendFeedback({
        type: 'error',
        message: 'حدث خطأ غير متوقع أثناء الاتصال بمسار الإرسال.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const statusMeta = getConnectionStatusBadge(connectionStatus);
  const completedChecklistCount = Object.values(checklistState).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-start">
      {/* Important Payment Timing Alert */}
      <Alert className="border-amber-300 bg-amber-50/90 text-amber-950">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertTitle className="font-bold text-amber-950">
          تنبيه مهم: إكمال الربط والتحقق قبل إضافة طريقة الدفع
        </AlertTitle>
        <AlertDescription className="text-amber-900 leading-relaxed mt-1">
          يُنصح بإكمال خطوات ربط الرقم والتحقق من رابط الـ Webhook واستلام/اختبار أول رسالة بنجاح
          في حساب Meta Business قبل إضافة البطاقة البنكية أو تفعيل الفوترة المدفوعة، لتجنب
          تعليق الإعداد أو الفوترة على رقم غير مكتمل التفعيل.
        </AlertDescription>
      </Alert>

      {/* Missing SQL Tables Banner */}
      {!dbReady && (
        <Alert variant="destructive" className="bg-red-50/80 border-red-200 text-red-900">
          <Database className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-bold">
            جداول واتساب غير مفعّلة في قاعدة البيانات بعد
          </AlertTitle>
          <AlertDescription className="mt-1">
            {supabaseConfigured
              ? 'يرجى تشغيل كود SQL الخاص بإنشاء جدولي whatsapp_connections و whatsapp_messages في Supabase SQL Editor لتتمكن من حفظ الإعدادات وتسجيل الرسائل الواردة.'
              : 'متغيرات الاتصال بقاعدة بيانات Supabase غير مضبوطة بعد في البيئة.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Status & Server Readiness Card */}
      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                حالة ربط WhatsApp Cloud API
              </CardTitle>
              <CardDescription>
                متابعة جاهزية الخادم، حالة التحقق من الـ Webhook، وآخر نشاط وارد من Meta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('px-3 py-1 font-medium', statusMeta.className)}>
                {statusMeta.label}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadStatus(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('ms-1.5 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                تحديث
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              {
                label: 'WHATSAPP_ACCESS_TOKEN',
                ready: envReadiness.hasAccessToken,
                hint: 'مطلوب للإرسال',
              },
              {
                label: 'WHATSAPP_PHONE_NUMBER_ID',
                ready: envReadiness.hasPhoneNumberId,
                hint: 'معرّف الرقم',
              },
              {
                label: 'WHATSAPP_VERIFY_TOKEN',
                ready: envReadiness.hasVerifyToken,
                hint: 'لتوثيق Webhook',
              },
              {
                label: 'WHATSAPP_APP_SECRET',
                ready: envReadiness.hasAppSecret,
                hint: 'توقيع اختياري آمن',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded-lg border p-2.5 flex items-start justify-between gap-2 text-xs',
                  item.ready
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-muted/40 border-border text-muted-foreground'
                )}
              >
                <div className="min-w-0">
                  <div className="font-mono font-semibold truncate" dir="ltr">
                    {item.label}
                  </div>
                  <div className="mt-0.5 text-[11px] opacity-85">{item.hint}</div>
                </div>
                {item.ready ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t">
            <span>
              آخر إشارة Webhook:{' '}
              <strong className="text-foreground">
                {formatDateTimeSafe(lastWebhookAt)}
              </strong>
            </span>
            <span>
              التحقق التلقائي للإرسال:{' '}
              <strong className={envReadiness.isReadyToSend ? 'text-emerald-700' : 'text-amber-700'}>
                {envReadiness.isReadyToSend ? 'جاهز للإرسال عبر الخادم' : 'بانتظار مفاتيح الخادم'}
              </strong>
            </span>
          </div>

          {lastError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-xs text-red-800">
              آخر ملاحظة: {lastError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Type Selector */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            1. اختيار نوع الربط
          </CardTitle>
          <CardDescription>
            اختر مسار الربط المناسب لرقم العيادة قبل بدء خطوات Meta Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setConnectionMode('new_cloud_number')}
            className={cn(
              'text-start rounded-xl border-2 p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40',
              connectionMode === 'new_cloud_number'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 bg-card'
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                رقم جديد على Cloud API
              </span>
              {connectionMode === 'new_cloud_number' && (
                <Badge className="text-[11px]">مختار</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              مناسب لتفعيل رقم جديد مخصص للأتمتة أو رقم Meta تجريبي دون التأثير على محادثات رقم
              واتساب Business الحالي على هاتف الاستقبال.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setConnectionMode('existing_business_app')}
            className={cn(
              'text-start rounded-xl border-2 p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40',
              connectionMode === 'existing_business_app'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/40 bg-card'
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                رقمي الحالي على تطبيق واتساب Business
              </span>
              {connectionMode === 'existing_business_app' && (
                <Badge className="text-[11px]">مختار</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              لربط رقم العيادة المعروف للمرضى. انتبه لمتطلبات Meta حول ترحيل الرقم أو استخدام
              وضع التعايش (Coexistence) قبل نقل الرقم إلى Cloud API.
            </p>
          </button>
        </CardContent>
      </Card>

      {/* Pre-Start Checklist */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                2. قائمة التحقق قبل البدء
              </CardTitle>
              <CardDescription>
                تأكد من إتمام الخطوات التالية بالترتيب لضمان ربط آمن وسلس.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {completedChecklistCount} / {CHECKLIST_ITEMS.length} مكتمل
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const checked = checklistState[item.key];
            return (
              <label
                key={item.key}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                  checked
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-background hover:bg-muted/30 border-border'
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => handleToggleChecklist(item.key, val === true)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      checked && 'text-emerald-950'
                    )}
                  >
                    {item.title}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      {/* Webhook & Display Settings */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            3. إعدادات Webhook وبيانات الرقم التعريفية
          </CardTitle>
          <CardDescription>
            يتم حفظ مفاتيح API السرية في متغيرات البيئة على الخادم فقط، وهنا تحفظ البيانات التعريفية للعيادة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wa-webhook-url" className="text-xs font-semibold">
              رابط الاستقبال (Callback URL) لإدخاله في Meta Webhooks
            </Label>
            <div className="flex gap-2">
              <Input
                id="wa-webhook-url"
                value={webhookUrl}
                readOnly
                dir="ltr"
                className="font-mono text-xs bg-muted/40"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyWebhook}
                className="shrink-0"
              >
                {copiedWebhook ? (
                  <>
                    <Check className="ms-1.5 h-4 w-4 text-emerald-600" />
                    تم النسخ
                  </>
                ) : (
                  <>
                    <Copy className="ms-1.5 h-4 w-4" />
                    نسخ الرابط
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              استخدم نفس قيمة <span className="font-mono">WHATSAPP_VERIFY_TOKEN</span> الموجودة في
              إعدادات الخادم عند التحقق في Meta.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-business-name" className="text-xs font-semibold">
                اسم العيادة الظاهر في واتساب
              </Label>
              <div className="relative">
                <Building2 className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="wa-business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="مثال: عيادة د. أحمد التخصصية"
                  className="pr-9"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-display-phone" className="text-xs font-semibold">
                رقم الواتساب المربوط (للعرض والتوثيق)
              </Label>
              <div className="relative">
                <Phone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="wa-display-phone"
                  value={displayPhoneNumber}
                  onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                  placeholder="96279XXXXXXX"
                  dir="ltr"
                  className="pr-9 text-left"
                  maxLength={30}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {!showInboxAndTester ? (
              <Button variant="outline" asChild onClick={onNavigateAway}>
                <Link href="/whatsapp">
                  <ExternalLink className="ms-2 h-4 w-4" />
                  فتح مركز الرسائل والاختبار (/whatsapp)
                </Link>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                لا يتم طلب أو تخزين أي رمز سري من المتصفح.
              </span>
            )}

            <Button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={isSaving || !dbReady}
            >
              {isSaving ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ms-2 h-4 w-4" />
              )}
              حفظ إعدادات الربط
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Console Sections (shown on /whatsapp) */}
      {showInboxAndTester && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Outbound Test / Direct Cloud Send */}
          <Card className="lg:col-span-5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                إرسال رسالة اختبار / تذكير عبر Cloud API
              </CardTitle>
              <CardDescription>
                اختبر مسار الإرسال الخادمي (<span className="font-mono">/api/whatsapp/send</span>) بعد ضبط مفاتيح Meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-test-phone" className="text-xs font-semibold">
                    رقم هاتف المستلم (أردني أو دولي)
                  </Label>
                  <Input
                    id="wa-test-phone"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="079XXXXXXX أو 96279XXXXXXX"
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wa-test-body" className="text-xs font-semibold">
                    نص الرسالة
                  </Label>
                  <Textarea
                    id="wa-test-body"
                    value={sendText}
                    onChange={(e) => setSendText(e.target.value)}
                    placeholder="مرحباً، هذه رسالة اختبار من نظام إدارة العيادة..."
                    rows={4}
                    maxLength={4096}
                  />
                </div>

                {!envReadiness.isReadyToSend && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    تنبيه: متغيرات <span className="font-mono">WHATSAPP_ACCESS_TOKEN</span> و{' '}
                    <span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> غير مضبوطة على
                    الخادم بعد؛ سيعيد الخادم رسالة توضيحية آمنة عند التجربة.
                  </div>
                )}

                {sendFeedback && (
                  <div
                    className={cn(
                      'rounded-lg border p-3 text-xs leading-relaxed',
                      sendFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    )}
                  >
                    {sendFeedback.message}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSendingTest}>
                  {isSendingTest ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="ms-2 h-4 w-4" />
                  )}
                  إرسال عبر WhatsApp Cloud API
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Inbound Booking Requests & Message Log */}
          <Card className="lg:col-span-7 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-emerald-600" />
                    سجل رسائل واتساب وطلبات الحجز
                  </CardTitle>
                  <CardDescription>
                    الرسائل الواردة عبر الـ Webhook والرسائل الصادرة عبر Cloud API (آخر 30 رسالة).
                  </CardDescription>
                </div>
                <Badge variant="outline">{recentMessages.length} رسالة</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center space-y-2 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto opacity-40" />
                  <p className="font-medium text-sm text-foreground">
                    لا توجد رسائل مسجلة في قاعدة البيانات حتى الآن
                  </p>
                  <p className="text-xs max-w-md mx-auto leading-relaxed">
                    بمجرد تفعيل جدول <span className="font-mono">whatsapp_messages</span> وربط الـ
                    Webhook مع Meta، ستظهر رسائل المرضى وطلبات الحجز هنا تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pl-1">
                  {recentMessages.map((msg) => {
                    const isInbound = msg.direction === 'inbound';
                    const phoneDisplay = isInbound ? msg.fromPhone : msg.toPhone || msg.fromPhone;
                    return (
                      <div
                        key={msg.id}
                        className="rounded-xl border p-3.5 bg-card space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] gap-1',
                                isInbound
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-sky-50 text-sky-800 border-sky-200'
                              )}
                            >
                              {isInbound ? (
                                <ArrowDownLeft className="h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3" />
                              )}
                              {isInbound ? 'واردة' : 'صادرة'}
                            </Badge>
                            <span className="font-semibold text-sm text-foreground">
                              {msg.contactName || 'مرسل غير مسمى'}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                              {phoneDisplay}
                            </span>
                            {msg.patientId && (
                              <Link
                                href={`/patients/${msg.patientId}`}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                ملف المريض
                              </Link>
                            )}
                          </div>

                          <span className="text-[11px] text-muted-foreground">
                            {formatDateTimeSafe(msg.receivedAt)}
                          </span>
                        </div>

                        <p className="text-sm text-foreground bg-muted/35 rounded-lg p-2.5 whitespace-pre-wrap break-words leading-relaxed">
                          {msg.messageBody}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-muted-foreground">
                            النوع: <span className="font-mono">{msg.messageType}</span>
                          </span>

                          {isInbound ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">الحالة:</span>
                              <Select
                                value={
                                  msg.requestStatus === 'new' ||
                                  msg.requestStatus === 'reviewed' ||
                                  msg.requestStatus === 'converted' ||
                                  msg.requestStatus === 'archived'
                                    ? msg.requestStatus
                                    : 'new'
                                }
                                onValueChange={(val) =>
                                  handleUpdateMessageStatus(
                                    msg.id,
                                    val as 'new' | 'reviewed' | 'converted' | 'archived'
                                  )
                                }
                                disabled={updatingMessageId === msg.id}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {REQUEST_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[11px]">
                              {getMessageStatusLabel(msg.requestStatus)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
