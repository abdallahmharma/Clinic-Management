"use client";

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock,
  Edit3,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize,
  Phone,
  RefreshCw,
  StickyNote,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  deleteAppointment as apiDeleteAppointment,
  deletePatientImageFromStorage,
  getAppointmentsByPatientId,
  getPatientById,
  updatePatient,
} from '@/lib/api';
import { useSignedPatientImages } from '@/hooks/use-signed-patient-images';
import type { Appointment, Patient } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import { PatientImageManagerDialog } from '@/components/patients/PatientImageManagerDialog';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';

function isAppointmentUpcoming(appointment: Appointment): boolean {
  const now = new Date();
  const todayString = format(now, 'yyyy-MM-dd');
  if (appointment.date > todayString) return true;
  if (appointment.date < todayString) return false;
  const currentTime = format(now, 'HH:mm');
  return appointment.time.slice(0, 5) >= currentTime;
}

function getAppointmentTimestamp(appointment: Appointment): number {
  const timePart = appointment.time.slice(0, 5) || '00:00';
  const ts = new Date(`${appointment.date}T${timePart}:00`).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function formatAppointmentDate(dateStr: string): string {
  try {
    const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return format(parsed, 'EEEE, d MMMM yyyy', { locale: arSA });
  } catch {
    return dateStr;
  }
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id;
  const { toast } = useToast();

  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [notFoundError, setNotFoundError] = React.useState(false);

  const [isPatientFormOpen, setIsPatientFormOpen] = React.useState(false);
  const [isImageManagerOpen, setIsImageManagerOpen] = React.useState(false);
  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = React.useState<Appointment | null>(null);
  const [isDeletingAppointment, setIsDeletingAppointment] = React.useState(false);

  const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);
  const [deletingImages, setDeletingImages] = React.useState<Record<string, boolean>>({});
  const { signedUrlMap } = useSignedPatientImages(patient?.imageUrls);
  const hasLoadedRef = React.useRef(false);

  const fetchPatientRecord = React.useCallback(async () => {
    if (!patientId) return;
    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setNotFoundError(false);
    try {
      const [patientData, appointmentsData] = await Promise.all([
        getPatientById(patientId),
        getAppointmentsByPatientId(patientId),
      ]);

      if (!patientData) {
        setPatient(null);
        setAppointments([]);
        setNotFoundError(true);
        return;
      }

      setPatient(patientData);
      setAppointments(appointmentsData);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading patient history:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل السجل التاريخي للمريض.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [patientId, toast]);

  React.useEffect(() => {
    fetchPatientRecord();
  }, [fetchPatientRecord]);

  const sortedAllAppointments = React.useMemo(() => {
    return [...appointments].sort(
      (a, b) => getAppointmentTimestamp(b) - getAppointmentTimestamp(a)
    );
  }, [appointments]);

  const upcomingAppointments = React.useMemo(() => {
    return sortedAllAppointments
      .filter(isAppointmentUpcoming)
      .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b));
  }, [sortedAllAppointments]);

  const pastAppointments = React.useMemo(() => {
    return sortedAllAppointments.filter((appt) => !isAppointmentUpcoming(appt));
  }, [sortedAllAppointments]);

  const handlePatientUpdated = React.useCallback(
    (updatedPatient: Patient, openAppointmentForm?: boolean) => {
      setPatient(updatedPatient);
      setAppointments((prev) =>
        prev.map((appt) => ({ ...appt, patientName: updatedPatient.name }))
      );
      setIsPatientFormOpen(false);
      if (openAppointmentForm) {
        setEditingAppointment(null);
        setIsAppointmentFormOpen(true);
      }
    },
    []
  );

  const handleImagesUpdated = React.useCallback((updatedPatient: Patient) => {
    setPatient(updatedPatient);
  }, []);

  const openNewAppointmentForm = React.useCallback(() => {
    setEditingAppointment(null);
    setIsAppointmentFormOpen(true);
  }, []);

  const handleAppointmentSuccess = React.useCallback((savedAppointment: Appointment) => {
    setAppointments((prev) => {
      const exists = prev.some((item) => item.id === savedAppointment.id);
      const next = exists
        ? prev.map((item) => (item.id === savedAppointment.id ? savedAppointment : item))
        : [savedAppointment, ...prev];
      return next.sort((a, b) => getAppointmentTimestamp(b) - getAppointmentTimestamp(a));
    });
    setIsAppointmentFormOpen(false);
    setEditingAppointment(null);
  }, []);

  const handleDeleteAppointment = React.useCallback(async () => {
    if (!appointmentToDelete || isDeletingAppointment) return;
    setIsDeletingAppointment(true);
    try {
      await apiDeleteAppointment(appointmentToDelete.id);
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentToDelete.id));
      toast({ title: 'نجاح', description: 'تم حذف الموعد بنجاح.' });
      setAppointmentToDelete(null);
    } catch (error) {
      console.error('Error deleting appointment from patient history:', error);
      toast({ title: 'خطأ', description: 'فشل في حذف الموعد.', variant: 'destructive' });
    } finally {
      setIsDeletingAppointment(false);
    }
  }, [appointmentToDelete, isDeletingAppointment, toast]);

  const handleDeleteImage = React.useCallback(
    async (imageUrlToDelete: string) => {
      if (!patient) return;
      setDeletingImages((prev) => ({ ...prev, [imageUrlToDelete]: true }));
      try {
        const deletedFromStorage = await deletePatientImageFromStorage(imageUrlToDelete);
        if (!deletedFromStorage) {
          toast({
            title: 'تحذير',
            description: 'تعذر حذف الملف من التخزين السحابي، سيتم إزالة الرابط من ملف المريض.',
            duration: 6000,
          });
        }

        const nextImageUrls = (patient.imageUrls || []).filter((url) => url !== imageUrlToDelete);
        const updatedPatient = await updatePatient(patient.id, { imageUrls: nextImageUrls });
        if (!updatedPatient) throw new Error('Failed to update patient images');
        setPatient(updatedPatient);
        setPreviewImageUrl((prevPreview) => (prevPreview === imageUrlToDelete ? null : prevPreview));
        toast({ title: 'نجاح', description: 'تم حذف الصورة بنجاح.' });
      } catch (error) {
        console.error('Error deleting patient image:', error);
        toast({ title: 'خطأ', description: 'فشل في حذف الصورة.', variant: 'destructive' });
      } finally {
        setDeletingImages((prev) => ({ ...prev, [imageUrlToDelete]: false }));
      }
    },
    [patient, toast]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1 w-full">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <Skeleton className="h-6 w-36" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFoundError || !patient) {
    return (
      <Card className="shadow-lg max-w-xl mx-auto mt-10">
        <CardHeader className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <CardTitle className="text-2xl text-primary">المريض غير موجود</CardTitle>
          <CardDescription>
            تعذر العثور على سجل لهذا المريض، ربما تم حذفه أو أن الرابط غير صحيح.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/patients">
              <ArrowRight className="ms-2 h-4 w-4" />
              العودة إلى قائمة المرضى
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const patientImages = patient.imageUrls || [];
  const firstPatientImage = patientImages[0];
  const avatarImageSrc = firstPatientImage
    ? (firstPatientImage.startsWith('data:') || firstPatientImage.startsWith('blob:')
        ? firstPatientImage
        : signedUrlMap[firstPatientImage])
    : undefined;
  const previewDisplayUrl = previewImageUrl
    ? (previewImageUrl.startsWith('data:') || previewImageUrl.startsWith('blob:')
        ? previewImageUrl
        : signedUrlMap[previewImageUrl] ?? null)
    : null;

  const renderAppointmentTimeline = (items: Appointment[], emptyText: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-10 bg-secondary/20 rounded-lg border border-dashed">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setEditingAppointment(null);
              setIsAppointmentFormOpen(true);
            }}
          >
            <CalendarPlus className="ms-2 h-4 w-4" />
            إضافة موعد جديد
          </Button>
        </div>
      );
    }

    return (
      <div className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:right-4 before:w-0.5 before:bg-border">
        {items.map((appointment) => {
          const upcoming = isAppointmentUpcoming(appointment);
          return (
            <div key={appointment.id} className="relative pe-10">
              <span
                className={`absolute right-2.5 top-5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                  upcoming ? 'bg-primary ring-4 ring-primary/15' : 'bg-muted-foreground/50'
                }`}
              />
              <Card className={upcoming ? 'border-primary/40 shadow-sm' : 'bg-background/70'}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={upcoming ? 'default' : 'secondary'}>
                        {upcoming ? 'موعد قادم' : 'موعد سابق'}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        {appointment.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingAppointment(appointment);
                          setIsAppointmentFormOpen(true);
                        }}
                        aria-label="تعديل الموعد"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setAppointmentToDelete(appointment)}
                        aria-label="حذف الموعد"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      {formatAppointmentDate(appointment.date)}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground" dir="ltr">
                      <Clock className="h-4 w-4 text-primary" />
                      {appointment.time}
                    </span>
                  </div>

                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className={appointment.notes ? 'text-foreground' : 'text-muted-foreground'}>
                        {appointment.notes || 'لا توجد ملاحظات مسجلة لهذا الموعد.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>
                      تاريخ الإنشاء:{' '}
                      {format(new Date(appointment.createdAt), 'dd/MM/yyyy HH:mm', { locale: arSA })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/patients">
              <ArrowRight className="ms-1.5 h-4 w-4" />
              المرضى
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">
              السجل التاريخي للمريض
            </h1>
            <p className="text-sm text-muted-foreground">
              جميع البيانات والمواعيد والملاحظات والصور في مكان واحد
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={fetchPatientRecord} disabled={isLoading || isRefreshing}>
            {isRefreshing ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ms-2 h-4 w-4" />
            )}
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button variant="outline" onClick={() => setIsPatientFormOpen(true)}>
            <Edit3 className="ms-2 h-4 w-4" />
            تعديل البيانات
          </Button>
          <Button variant="secondary" onClick={() => setIsImageManagerOpen(true)}>
            <ImagePlus className="ms-2 h-4 w-4" />
            رفع صورة
          </Button>
          <Button onClick={openNewAppointmentForm}>
            <CalendarPlus className="ms-2 h-4 w-4" />
            إضافة موعد جديد
          </Button>
        </div>
      </div>

      {/* Basic Patient Info */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage
                  src={avatarImageSrc}
                  alt={patient.name}
                  className="object-cover"
                />
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {patient.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">{patient.name}</h2>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="h-4 w-4 text-primary" />
                    العمر: <strong className="text-foreground">{patient.age} سنة</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-primary" />
                    الهاتف:{' '}
                    <strong className="text-foreground" dir="ltr">
                      {patient.phone}
                    </strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    تاريخ الإضافة:{' '}
                    <strong className="text-foreground">
                      {format(new Date(patient.createdAt), 'dd MMMM yyyy', { locale: arSA })}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:min-w-[320px]">
              <div className="rounded-lg border bg-background p-3 text-center">
                <div className="text-2xl font-bold text-primary">{appointments.length}</div>
                <div className="text-xs text-muted-foreground">إجمالي المواعيد</div>
              </div>
              <div className="rounded-lg border bg-background p-3 text-center">
                <div className="text-2xl font-bold text-primary">{upcomingAppointments.length}</div>
                <div className="text-xs text-muted-foreground">المواعيد القادمة</div>
              </div>
              <div className="rounded-lg border bg-background p-3 text-center">
                <div className="text-2xl font-bold text-primary">{patientImages.length}</div>
                <div className="text-xs text-muted-foreground">الصور المحفوظة</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Timeline + Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Chronological Appointments Timeline */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                السجل الزمني للمواعيد والملاحظات
              </CardTitle>
              <CardDescription>
                المواعيد مرتبة زمنياً مع تمييز الجلسات القادمة والسابقة
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingAppointment(null);
                setIsAppointmentFormOpen(true);
              }}
            >
              <CalendarPlus className="ms-1.5 h-4 w-4" />
              موعد جديد
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" dir="rtl">
              <TabsList className="mb-4 grid w-full grid-cols-3">
                <TabsTrigger value="all">الكل ({sortedAllAppointments.length})</TabsTrigger>
                <TabsTrigger value="upcoming">القادمة ({upcomingAppointments.length})</TabsTrigger>
                <TabsTrigger value="past">السابقة ({pastAppointments.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                {renderAppointmentTimeline(
                  sortedAllAppointments,
                  'لا توجد أي مواعيد مسجلة لهذا المريض حتى الآن.'
                )}
              </TabsContent>
              <TabsContent value="upcoming">
                {renderAppointmentTimeline(
                  upcomingAppointments,
                  'لا توجد مواعيد قادمة مجدولة لهذا المريض.'
                )}
              </TabsContent>
              <TabsContent value="past">
                {renderAppointmentTimeline(
                  pastAppointments,
                  'لا توجد مواعيد سابقة في سجل هذا المريض.'
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Patient Images Gallery */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                معرض صور المريض ({patientImages.length})
              </CardTitle>
              <CardDescription>اضغط على أي صورة للتكبير والمعاينة</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsImageManagerOpen(true)}>
              <ImagePlus className="ms-1.5 h-4 w-4" />
              رفع صورة
            </Button>
          </CardHeader>
          <CardContent>
            {patientImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {patientImages.map((url) => {
                  const isDeletingImg = Boolean(deletingImages[url]);
                  const displayUrl =
                    url.startsWith('data:') || url.startsWith('blob:') ? url : signedUrlMap[url];
                  return (
                    <div key={url} className="relative group aspect-square">
                      <div
                        className={`relative w-full h-full cursor-pointer rounded-md border overflow-hidden transition-all ${
                          isDeletingImg
                            ? 'pointer-events-none opacity-40'
                            : 'hover:ring-2 hover:ring-primary/50'
                        }`}
                        onClick={() => setPreviewImageUrl(url)}
                      >
                        {displayUrl ? (
                          <Image
                            src={displayUrl}
                            alt={`صورة المريض ${patient.name}`}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <Skeleton className="h-full w-full rounded-md" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize className="h-6 w-6 text-white drop-shadow" />
                        </div>
                      </div>

                      {isDeletingImg && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                          <Loader2 className="h-5 w-5 animate-spin text-destructive" />
                        </div>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 left-2 h-7 w-7 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isDeletingImg}
                            aria-label="حذف الصورة"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد حذف الصورة</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف هذه الصورة من سجل المريض؟
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteImage(url)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              نعم، قم بالحذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-secondary/20 rounded-lg border border-dashed">
                <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  لا توجد صور مرفوعة لهذا المريض حتى الآن.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsImageManagerOpen(true)}
                >
                  <ImagePlus className="ms-2 h-4 w-4" />
                  رفع أول صورة
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Patient Dialog */}
      <Dialog open={isPatientFormOpen} onOpenChange={setIsPatientFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {isPatientFormOpen && (
            <PatientForm
              patient={patient}
              onSuccess={handlePatientUpdated}
              setOpen={setIsPatientFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Appointment Dialog */}
      <Dialog open={isAppointmentFormOpen} onOpenChange={setIsAppointmentFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {isAppointmentFormOpen && (
            <AppointmentForm
              appointment={editingAppointment}
              patients={[patient]}
              defaultPatientId={patient.id}
              onSuccess={handleAppointmentSuccess}
              setOpen={setIsAppointmentFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Image Manager Dialog */}
      <PatientImageManagerDialog
        patient={patient}
        isOpen={isImageManagerOpen}
        setOpen={setIsImageManagerOpen}
        onImagesUpdate={handleImagesUpdated}
      />

      {/* Enlarged Image Preview Dialog */}
      <Dialog open={!!previewImageUrl} onOpenChange={() => setPreviewImageUrl(null)}>
        <DialogContent className="sm:max-w-4xl max-w-full p-0" dir="rtl">
          <DialogHeader className="sr-only">
            <DialogTitle>معاينة صورة المريض: {patient.name}</DialogTitle>
            <DialogDescription>عرض مكبر لصورة من السجل الطبي للمريض</DialogDescription>
          </DialogHeader>
          <div className="absolute top-4 left-4 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPreviewImageUrl(null)}
              className="bg-background/80 hover:bg-background"
              aria-label="إغلاق المعاينة"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="w-full max-h-[90vh] overflow-y-auto p-4 flex items-center justify-center min-h-[300px]">
            {previewDisplayUrl ? (
              <Image
                src={previewDisplayUrl}
                alt={`معاينة صورة ${patient.name}`}
                width={1200}
                height={800}
                className="rounded-lg object-contain max-h-[82vh] w-auto"
              />
            ) : previewImageUrl ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Appointment Confirmation */}
      <AlertDialog
        open={!!appointmentToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeletingAppointment) setAppointmentToDelete(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الموعد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف موعد <strong>{appointmentToDelete?.type}</strong> بتاريخ{' '}
              <strong>
                {appointmentToDelete ? formatAppointmentDate(appointmentToDelete.date) : ''}
              </strong>{' '}
              الساعة <strong>{appointmentToDelete?.time}</strong>؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAppointment}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAppointment();
              }}
              disabled={isDeletingAppointment}
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
