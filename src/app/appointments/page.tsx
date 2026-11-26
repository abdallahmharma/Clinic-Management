"use client";

import * as React from 'react';
import Link from 'next/link';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  Clock,
  Edit3,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  StickyNote,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import type { Appointment, Patient } from '@/lib/types';
import { getAppointments, getPatients, deleteAppointment as apiDeleteAppointment } from '@/lib/api';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type FilterMode = 'today' | 'upcoming' | 'all' | 'date';

interface EnrichedAppointment {
  appointment: Appointment;
  phone: string;
  formattedDate: string;
  isToday: boolean;
  isUpcoming: boolean;
  timestamp: number;
  searchableText: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [filterMode, setFilterMode] = React.useState<FilterMode>('today');
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = React.useState<Appointment | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [isDeletingAppointment, setIsDeletingAppointment] = React.useState(false);

  const { toast } = useToast();
  const hasLoadedRef = React.useRef(false);

  const fetchData = React.useCallback(async () => {
    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [appointmentsData, patientsData] = await Promise.all([
        getAppointments(),
        getPatients(),
      ]);
      setAppointments(appointmentsData);
      setPatients(patientsData);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Fetch appointments data error:", error);
      toast({ title: "خطأ", description: "فشل في تحميل بيانات المواعيد.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddAppointment = React.useCallback(() => {
    if (patients.length === 0) {
      toast({ title: "تنبيه", description: "يجب إضافة مرضى أولاً قبل إضافة موعد.", variant: "default" });
      return;
    }
    setEditingAppointment(null);
    setIsFormOpen(true);
  }, [patients.length, toast]);

  const handleEditAppointment = React.useCallback((appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  }, []);

  const confirmDeleteAppointment = React.useCallback((appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteAlertOpen(true);
  }, []);

  const handleDeleteAppointment = React.useCallback(async () => {
    if (!appointmentToDelete || isDeletingAppointment) return;
    setIsDeletingAppointment(true);
    try {
      await apiDeleteAppointment(appointmentToDelete.id);
      setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete.id));
      toast({ title: "نجاح", description: "تم حذف الموعد بنجاح." });
      setIsDeleteAlertOpen(false);
      setAppointmentToDelete(null);
    } catch (error) {
      console.error("Delete appointment error:", error);
      toast({ title: "خطأ", description: "فشل في حذف الموعد.", variant: "destructive" });
    } finally {
      setIsDeletingAppointment(false);
    }
  }, [appointmentToDelete, isDeletingAppointment, toast]);

  const handleFormSuccess = React.useCallback((savedAppointment: Appointment) => {
    setAppointments(prev => {
      const exists = prev.some(a => a.id === savedAppointment.id);
      const next = exists
        ? prev.map(a => (a.id === savedAppointment.id ? savedAppointment : a))
        : [savedAppointment, ...prev];
      return next.sort(
        (a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
      );
    });
    setIsFormOpen(false);
    setEditingAppointment(null);
  }, []);

  const handleSelectSpecificDate = React.useCallback((date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setFilterMode('date');
    setDatePickerOpen(false);
  }, []);

  const patientPhoneMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      if (p.phone) map.set(p.id, p.phone);
    }
    return map;
  }, [patients]);

  const now = new Date();
  const todayString = format(now, 'yyyy-MM-dd');
  const currentTimeString = format(now, 'HH:mm');
  const todayHeaderLabel = React.useMemo(
    () => format(new Date(), 'EEEE، d MMMM yyyy', { locale: arSA }),
    []
  );

  const selectedDateString = React.useMemo(
    () => format(selectedDate, 'yyyy-MM-dd'),
    [selectedDate]
  );
  const selectedDateLabel = React.useMemo(
    () => format(selectedDate, 'd MMMM yyyy', { locale: arSA }),
    [selectedDate]
  );

  const enrichedAppointments = React.useMemo<EnrichedAppointment[]>(() => {
    return appointments
      .map((appointment) => {
        let parsedDate: Date;
        try {
          parsedDate = parse(appointment.date, 'yyyy-MM-dd', new Date());
          if (isNaN(parsedDate.getTime())) return null;
        } catch {
          return null;
        }

        const timeShort = appointment.time.slice(0, 5);
        const isToday = appointment.date === todayString;
        const isUpcoming =
          appointment.date > todayString ||
          (isToday && timeShort >= currentTimeString);

        const phone = appointment.patientPhone || patientPhoneMap.get(appointment.patientId) || 'غير متوفر';
        const formattedDate = format(parsedDate, 'EEEE، d MMMM yyyy', { locale: arSA });
        const timestamp = new Date(`${appointment.date}T${timeShort || '00:00'}:00`).getTime();

        const searchableText = [
          appointment.patientName,
          appointment.type,
          phone,
          appointment.time,
          appointment.notes || '',
        ]
          .join(' ')
          .toLowerCase();

        return {
          appointment,
          phone,
          formattedDate,
          isToday,
          isUpcoming,
          timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
          searchableText,
        };
      })
      .filter((item): item is EnrichedAppointment => item !== null);
  }, [appointments, patientPhoneMap, todayString, currentTimeString]);

  const counts = React.useMemo(() => {
    let today = 0;
    let upcoming = 0;
    for (const item of enrichedAppointments) {
      if (item.isToday) today += 1;
      if (item.isUpcoming) upcoming += 1;
    }
    return {
      today,
      upcoming,
      all: enrichedAppointments.length,
    };
  }, [enrichedAppointments]);

  const visibleAppointments = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = enrichedAppointments.filter((item) => {
      if (filterMode === 'today' && !item.isToday) return false;
      if (filterMode === 'upcoming' && !item.isUpcoming) return false;
      if (filterMode === 'date' && item.appointment.date !== selectedDateString) return false;

      if (normalizedSearch && !item.searchableText.includes(normalizedSearch)) {
        return false;
      }
      return true;
    });

    // Sort chronologically ascending for today/specific date/upcoming so doctor sees earliest first
    if (filterMode === 'today' || filterMode === 'date' || filterMode === 'upcoming') {
      return [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    }

    // For 'all', newest first
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }, [enrichedAppointments, filterMode, selectedDateString, searchTerm]);

  const deleteConfirmDateLabel = React.useMemo(() => {
    if (!appointmentToDelete) return "غير محدد";
    try {
      const parsed = parse(appointmentToDelete.date, 'yyyy-MM-dd', new Date());
      if (isNaN(parsed.getTime())) return "غير محدد";
      return format(parsed, "d MMMM yyyy", { locale: arSA });
    } catch {
      return "غير محدد";
    }
  }, [appointmentToDelete]);

  const activeHeading = React.useMemo(() => {
    switch (filterMode) {
      case 'today':
        return 'جدول مواعيد اليوم';
      case 'upcoming':
        return 'المواعيد القادمة';
      case 'date':
        return `مواعيد ${selectedDateLabel}`;
      default:
        return 'جميع المواعيد';
    }
  }, [filterMode, selectedDateLabel]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2.5">
            <CalendarClock className="h-8 w-8" />
            {activeHeading}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            اليوم: <span className="font-medium text-foreground">{todayHeaderLabel}</span>
            {' · '}
            مواعيد اليوم: <span className="font-semibold text-primary">{counts.today}</span>
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={fetchData} variant="outline" disabled={isLoading || isRefreshing} className="flex-shrink-0">
            {isLoading || isRefreshing ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ms-2 h-4 w-4" />
            )}
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button
            onClick={handleAddAppointment}
            size="lg"
            className="flex-shrink-0"
            disabled={isLoading || patients.length === 0}
          >
            <PlusCircle className="ms-2 h-5 w-5" />
            إضافة موعد جديد
          </Button>
        </div>
      </div>

      {/* Quick Filters + Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={filterMode === 'today' ? 'default' : 'outline'}
              onClick={() => setFilterMode('today')}
              className="gap-1.5"
            >
              <Clock className="h-4 w-4" />
              اليوم
              <Badge variant={filterMode === 'today' ? 'secondary' : 'outline'} className="px-1.5 py-0 text-xs">
                {counts.today}
              </Badge>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={filterMode === 'upcoming' ? 'default' : 'outline'}
              onClick={() => setFilterMode('upcoming')}
              className="gap-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              القادمة
              <Badge variant={filterMode === 'upcoming' ? 'secondary' : 'outline'} className="px-1.5 py-0 text-xs">
                {counts.upcoming}
              </Badge>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={filterMode === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterMode('all')}
              className="gap-1.5"
            >
              الكل
              <Badge variant={filterMode === 'all' ? 'secondary' : 'outline'} className="px-1.5 py-0 text-xs">
                {counts.all}
              </Badge>
            </Button>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={filterMode === 'date' ? 'default' : 'outline'}
                  className="gap-1.5"
                >
                  <CalendarIcon className="h-4 w-4" />
                  {filterMode === 'date' ? selectedDateLabel : 'اختيار تاريخ محدد'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleSelectSpecificDate}
                  initialFocus
                  locale={arSA}
                  dir="rtl"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ابحث باسم المريض، نوع الجلسة، رقم الهاتف أو الملاحظات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-10 py-2.5 text-base"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                aria-label="مسح البحث"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 w-full">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visibleAppointments.length > 0 ? (
        <div className="space-y-3">
          {visibleAppointments.map(({ appointment, phone, formattedDate, isToday, isUpcoming }) => {
            const whatsAppUrl = buildWhatsAppUrl({
              phone: appointment.patientPhone || patientPhoneMap.get(appointment.patientId),
              patientName: appointment.patientName,
              appointmentDate: formattedDate,
              appointmentTime: appointment.time.slice(0, 5),
              sessionType: appointment.type,
            });

            return (
              <Card
                key={appointment.id}
                className={`shadow-sm transition-colors hover:border-primary/40 ${
                  isToday && isUpcoming ? 'border-primary/35 bg-card' : ''
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left/Main Info */}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4 flex-1 min-w-0">
                      {/* Time Block */}
                      <div className="flex sm:flex-col items-center sm:items-center justify-between sm:justify-center gap-2 rounded-lg border bg-primary/5 px-3.5 py-2.5 sm:min-w-[104px] text-center flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-lg font-bold text-primary" dir="ltr">
                          <Clock className="h-4 w-4" />
                          <span>{appointment.time.slice(0, 5)}</span>
                        </div>
                        <Badge
                          variant={isUpcoming ? 'default' : 'secondary'}
                          className="text-[11px] font-medium"
                        >
                          {isToday ? (isUpcoming ? 'اليوم · قادم' : 'اليوم · منتهي') : (isUpcoming ? 'قادم' : 'سابق')}
                        </Badge>
                      </div>

                      {/* Patient & Details */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <Link
                            href={`/patients/${appointment.patientId}`}
                            className="text-lg font-bold text-primary hover:underline inline-flex items-center gap-1.5"
                          >
                            {appointment.patientName}
                          </Link>
                          <Badge variant="outline" className="gap-1 font-medium">
                            <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            {appointment.type}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-4 w-4 text-primary" />
                            <span dir="ltr" className="font-medium text-foreground">{phone}</span>
                          </span>
                          {(filterMode === 'upcoming' || filterMode === 'all') && (
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarIcon className="h-4 w-4 text-primary" />
                              <span>{formattedDate}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                          <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className={appointment.notes ? 'text-foreground' : 'text-muted-foreground'}>
                            {appointment.notes || 'لا توجد ملاحظات مسجلة'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0">
                      {whatsAppUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        >
                          <a
                            href={whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`تذكير واتساب للمريض ${appointment.patientName}`}
                          >
                            <MessageCircle className="ms-1.5 h-4 w-4" />
                            تذكير واتساب
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          title="رقم الهاتف غير صالح أو غير متوفر لإرسال رسالة واتساب"
                        >
                          <MessageCircle className="ms-1.5 h-4 w-4" />
                          تذكير واتساب
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/patients/${appointment.patientId}`}>
                          <FileText className="ms-1.5 h-4 w-4" />
                          السجل
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAppointment(appointment)}
                      >
                        <Edit3 className="ms-1.5 h-4 w-4" />
                        تعديل
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => confirmDeleteAppointment(appointment)}
                      >
                        <Trash2 className="ms-1.5 h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg shadow-sm bg-card">
          <CalendarHeart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-3 text-xl font-semibold">
            {searchTerm
              ? 'لا توجد مواعيد مطابقة للبحث'
              : filterMode === 'today'
                ? 'لا توجد مواعيد مجدولة لهذا اليوم'
                : filterMode === 'upcoming'
                  ? 'لا توجد مواعيد قادمة'
                  : filterMode === 'date'
                    ? `لا توجد مواعيد بتاريخ ${selectedDateLabel}`
                    : 'لا توجد مواعيد مسجلة'}
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {searchTerm
              ? 'جرّب تغيير كلمات البحث أو التبديل إلى فلتر "الكل".'
              : patients.length > 0
                ? 'يمكنك إضافة موعد جديد مباشرة أو التبديل إلى المواعيد القادمة / الكل.'
                : 'يرجى إضافة مرضى أولاً لتتمكن من حجز المواعيد.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filterMode === 'today' && counts.upcoming > 0 && !searchTerm && (
              <Button variant="outline" size="sm" onClick={() => setFilterMode('upcoming')}>
                عرض المواعيد القادمة ({counts.upcoming})
              </Button>
            )}
            {patients.length > 0 && (
              <Button size="sm" onClick={handleAddAppointment}>
                <PlusCircle className="ms-1.5 h-4 w-4" />
                إضافة موعد جديد
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Appointment Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {isFormOpen && (
            <AppointmentForm
              appointment={editingAppointment}
              patients={patients}
              defaultDate={filterMode === 'date' ? selectedDate : undefined}
              onSuccess={handleFormSuccess}
              setOpen={setIsFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={(open) => {
          if (!isDeletingAppointment) {
            setIsDeleteAlertOpen(open);
            if (!open) setAppointmentToDelete(null);
          }
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات الموعد لـ{" "}
              <strong>{appointmentToDelete?.patientName}</strong> في تاريخ{" "}
              <strong>{deleteConfirmDateLabel}</strong>{" "}
              الساعة <strong>{appointmentToDelete?.time}</strong> بشكل دائم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeletingAppointment}
              onClick={() => {
                setAppointmentToDelete(null);
                setIsDeleteAlertOpen(false);
              }}
            >
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingAppointment}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAppointment();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeletingAppointment ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : null}
              {isDeletingAppointment ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
