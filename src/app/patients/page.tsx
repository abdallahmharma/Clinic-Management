"use client";

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  Loader2,
  Search,
  RefreshCw,
  Users,
  Trash2,
  FileText,
  MessageCircle,
  Printer,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import type { Appointment, Patient } from '@/lib/types';
import { getPatientsPaginated, deletePatient as apiDeletePatient } from '@/lib/api';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { PatientImageManagerDialog } from '@/components/patients/PatientImageManagerDialog';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { useSignedPatientImages } from '@/hooks/use-signed-patient-images';
import {
  PatientsPrintExportDialog,
  type PatientExportScope,
} from '@/components/patients/PatientsPrintExportDialog';
import {
  DEFAULT_PATIENT_EXPORT_COLUMNS,
  PatientsPrintView,
  type PatientExportColumnKey,
} from '@/components/patients/PatientsPrintView';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const items: PaginationItem[] = [1];

  let windowStart = Math.max(2, currentPage - 1);
  let windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3) {
    windowStart = 2;
    windowEnd = 4;
  } else if (currentPage >= totalPages - 2) {
    windowStart = totalPages - 3;
    windowEnd = totalPages - 1;
  }

  if (windowStart > 2) {
    items.push('ellipsis-start');
  }

  for (let p = windowStart; p <= windowEnd; p++) {
    items.push(p);
  }

  if (windowEnd < totalPages - 1) {
    items.push('ellipsis-end');
  }

  items.push(totalPages);
  return items;
}

export default function PatientsPage() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState<number>(50);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState('');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [patientToDelete, setPatientToDelete] = React.useState<Patient | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [isDeletingPatient, setIsDeletingPatient] = React.useState(false);
  const { toast } = useToast();

  const [selectedPatientForImageManagement, setSelectedPatientForImageManagement] =
    React.useState<Patient | null>(null);
  const [isImageManagerOpen, setIsImageManagerOpen] = React.useState(false);

  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = React.useState(false);
  const [appointmentDefaultPatient, setAppointmentDefaultPatient] =
    React.useState<Patient | null>(null);

  const [isPrintDialogOpen, setIsPrintDialogOpen] = React.useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = React.useState<
    PatientExportColumnKey[]
  >(DEFAULT_PATIENT_EXPORT_COLUMNS);
  const [exportScope, setExportScope] = React.useState<PatientExportScope>('all');
  const [printPayload, setPrintPayload] = React.useState<{
    patients: Patient[];
    scopeLabel?: string;
  } | null>(null);

  const hasLoadedRef = React.useRef(false);
  const latestRequestIdRef = React.useRef(0);
  const debouncedSearchRef = React.useRef('');

  // Debounce search input & reset to page 1 only when effective search term changes
  React.useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed === debouncedSearchRef.current) {
      return;
    }

    if (!trimmed) {
      debouncedSearchRef.current = '';
      setDebouncedSearchTerm('');
      setCurrentPage(1);
      return;
    }

    const timer = setTimeout(() => {
      debouncedSearchRef.current = trimmed;
      setDebouncedSearchTerm(trimmed);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPatientsPage = React.useCallback(
    async (targetPage = currentPage, targetPageSize = pageSize, targetSearch = debouncedSearchTerm) => {
      const requestId = ++latestRequestIdRef.current;

      if (hasLoadedRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const result = await getPatientsPaginated({
          page: targetPage,
          pageSize: targetPageSize,
          searchTerm: targetSearch,
        });

        if (requestId !== latestRequestIdRef.current) return;

        setPatients(result.patients);
        setTotalCount(result.totalCount);
        if (result.page !== targetPage) {
          setCurrentPage(result.page);
        }
        hasLoadedRef.current = true;
      } catch (error) {
        if (requestId !== latestRequestIdRef.current) return;
        console.error("Fetch paginated patients error:", error);
        toast({
          title: "خطأ",
          description: "فشل في تحميل بيانات المرضى.",
          variant: "destructive",
        });
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [currentPage, pageSize, debouncedSearchTerm, toast]
  );

  React.useEffect(() => {
    fetchPatientsPage(currentPage, pageSize, debouncedSearchTerm);
  }, [fetchPatientsPage, currentPage, pageSize, debouncedSearchTerm]);

  // Clear temporary full-print override after browser print finishes
  React.useEffect(() => {
    const handleAfterPrint = () => {
      setPrintPayload(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleAddPatient = React.useCallback(() => {
    setIsFormOpen(true);
  }, []);

  const handleOpenImageManager = React.useCallback((patient: Patient) => {
    setSelectedPatientForImageManagement(patient);
    setIsImageManagerOpen(true);
  }, []);

  const confirmDeletePatient = React.useCallback((patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteAlertOpen(true);
  }, []);

  const handleDeletePatient = React.useCallback(async () => {
    if (!patientToDelete || isDeletingPatient) return;
    setIsDeletingPatient(true);
    try {
      const deleteResult = await apiDeletePatient(patientToDelete.id, patientToDelete.imageUrls);

      if (selectedPatientForImageManagement?.id === patientToDelete.id) {
        setSelectedPatientForImageManagement(null);
        setIsImageManagerOpen(false);
      }

      if (!deleteResult.storageDeletedAll) {
        toast({
          title: "تم حذف المريض مع تنبيه",
          description: `تم حذف سجل المريض ${patientToDelete.name}، لكن تعذر حذف ${deleteResult.failedStorageCount} صورة من التخزين السحابي.`,
          duration: 7000,
        });
      } else {
        toast({
          title: "نجاح",
          description: `تم حذف المريض ${patientToDelete.name} وجميع صوره بنجاح.`,
        });
      }

      setIsDeleteAlertOpen(false);
      setPatientToDelete(null);

      await fetchPatientsPage(currentPage, pageSize, debouncedSearchTerm);
    } catch (error) {
      console.error("Delete patient error:", error);
      toast({
        title: "خطأ",
        description: "فشل في حذف المريض.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPatient(false);
    }
  }, [
    patientToDelete,
    isDeletingPatient,
    selectedPatientForImageManagement,
    toast,
    fetchPatientsPage,
    currentPage,
    pageSize,
    debouncedSearchTerm,
  ]);

  const handleFormSuccess = React.useCallback(
    (createdPatient: Patient, openAppointmentForm?: boolean) => {
      setIsFormOpen(false);

      if (openAppointmentForm) {
        setAppointmentDefaultPatient(createdPatient);
        setIsAppointmentFormOpen(true);
      }

      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchPatientsPage(1, pageSize, debouncedSearchTerm);
      }
    },
    [currentPage, fetchPatientsPage, pageSize, debouncedSearchTerm]
  );

  const handlePatientImagesUpdate = React.useCallback((updatedPatient: Patient) => {
    setPatients((prev) => prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)));
    setSelectedPatientForImageManagement(updatedPatient);
  }, []);

  const handleAppointmentFormSuccess = React.useCallback((_savedAppointment: Appointment) => {
    setIsAppointmentFormOpen(false);
    setAppointmentDefaultPatient(null);
  }, []);

  const handlePageSizeChange = React.useCallback((value: string) => {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setPageSize(parsed);
      setCurrentPage(1);
    }
  }, []);

  const handlePrintReady = React.useCallback((patientsToPrint: Patient[], scopeLabel?: string) => {
    setPrintPayload({ patients: patientsToPrint, scopeLabel });
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const displayStart = totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const displayEnd = Math.min(safeCurrentPage * pageSize, totalCount);

  const paginationItems = React.useMemo(
    () => getPaginationItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages]
  );

  const primaryImageSources = React.useMemo(
    () => patients.map((p) => p.imageUrls?.[0]).filter((u): u is string => Boolean(u)),
    [patients]
  );
  const { signedUrlMap } = useSignedPatientImages(primaryImageSources);

  const appointmentFormPatients = React.useMemo(() => {
    if (!appointmentDefaultPatient) return patients;
    return [
      appointmentDefaultPatient,
      ...patients.filter((p) => p.id !== appointmentDefaultPatient.id),
    ];
  }, [appointmentDefaultPatient, patients]);

  const effectivePrintPatients = printPayload ? printPayload.patients : patients;
  const effectivePrintScopeLabel = printPayload
    ? printPayload.scopeLabel
    : totalPages > 1
      ? `الصفحة ${safeCurrentPage} من ${totalPages}`
      : undefined;

  return (
    <>
      <div className="space-y-6 print:hidden no-print">
        {/* Unified Header + Compact Search + Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary whitespace-nowrap">
              قائمة المرضى
            </h1>
            {!isLoading && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 tabular-nums">
                {totalCount}
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 lg:flex-nowrap">
            <div className="relative w-full sm:w-60 lg:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="ابحث بالاسم أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full ps-8 pe-9 text-sm"
                aria-label="البحث في قائمة المرضى"
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                  aria-label="مسح البحث"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button
                type="button"
                onClick={() => fetchPatientsPage(safeCurrentPage, pageSize, debouncedSearchTerm)}
                variant="outline"
                size="sm"
                disabled={isLoading || isRefreshing}
                className="h-9 flex-1 sm:flex-initial"
              >
                {isLoading || isRefreshing ? (
                  <Loader2 className="ms-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="ms-1.5 h-4 w-4" />
                )}
                {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
              </Button>

              <Button
                type="button"
                onClick={() => setIsPrintDialogOpen(true)}
                variant="outline"
                size="sm"
                disabled={isLoading || totalCount === 0}
                className="h-9 flex-1 sm:flex-initial"
              >
                <Printer className="ms-1.5 h-4 w-4" />
                طباعة الجدول
              </Button>

              <Button
                type="button"
                onClick={handleAddPatient}
                size="sm"
                className="h-9 flex-1 sm:flex-initial"
              >
                <PlusCircle className="ms-1.5 h-4 w-4" />
                إضافة مريض
              </Button>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        {isLoading ? (
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="min-w-[180px] text-right">الاسم</TableHead>
                  <TableHead className="w-[96px] text-center whitespace-nowrap">العمر</TableHead>
                  <TableHead className="w-[150px] text-center whitespace-nowrap">رقم الهاتف</TableHead>
                  <TableHead className="w-[136px] text-center whitespace-nowrap">تاريخ التسجيل</TableHead>
                  <TableHead className="w-[84px] text-center whitespace-nowrap">الصورة</TableHead>
                  <TableHead className="w-[240px] text-center whitespace-nowrap">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-right">
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-9 w-9 rounded-full mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-14" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : patients.length > 0 ? (
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
            <div className={isRefreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="min-w-[180px] text-right font-semibold">الاسم</TableHead>
                    <TableHead className="w-[96px] text-center font-semibold whitespace-nowrap">
                      العمر
                    </TableHead>
                    <TableHead className="w-[150px] text-center font-semibold whitespace-nowrap">
                      رقم الهاتف
                    </TableHead>
                    <TableHead className="w-[136px] text-center font-semibold whitespace-nowrap">
                      تاريخ التسجيل
                    </TableHead>
                    <TableHead className="w-[84px] text-center font-semibold whitespace-nowrap">
                      الصورة
                    </TableHead>
                    <TableHead className="w-[240px] text-center font-semibold whitespace-nowrap">
                      الإجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => {
                    const firstImg = patient.imageUrls?.[0];
                    const avatarSrc = firstImg
                      ? firstImg.startsWith('data:') || firstImg.startsWith('blob:')
                        ? firstImg
                        : signedUrlMap[firstImg]
                      : undefined;
                    const whatsAppUrl = buildWhatsAppUrl({
                      phone: patient.phone,
                      patientName: patient.name,
                    });

                    return (
                      <TableRow key={patient.id}>
                        <TableCell className="text-right font-medium text-primary">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="hover:underline inline-block"
                          >
                            {patient.name}
                          </Link>
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap tabular-nums text-foreground">
                          {patient.age} سنة
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap">
                          <span
                            dir="ltr"
                            className="inline-block font-mono text-sm text-muted-foreground"
                          >
                            {patient.phone}
                          </span>
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                          {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: arSA })}
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleOpenImageManager(patient)}
                              className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-transform hover:scale-105"
                              aria-label={`إدارة صور ${patient.name}`}
                              title="عرض أو إدارة صور المريض"
                            >
                              <Avatar className="h-9 w-9 border">
                                <AvatarImage
                                  src={avatarSrc}
                                  alt={patient.name}
                                  data-ai-hint="person portrait"
                                  className="object-cover"
                                />
                                <AvatarFallback className="text-xs font-semibold">
                                  {patient.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <Button
                              variant="secondary"
                              size="sm"
                              asChild
                              className="h-8 px-2.5 text-xs"
                            >
                              <Link
                                href={`/patients/${patient.id}`}
                                aria-label={`السجل التاريخي للمريض ${patient.name}`}
                              >
                                <FileText className="ms-1 h-3.5 w-3.5" />
                                السجل
                              </Link>
                            </Button>

                            {whatsAppUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-8 px-2.5 text-xs border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              >
                                <a
                                  href={whatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`مراسلة واتساب للمريض ${patient.name}`}
                                >
                                  <MessageCircle className="ms-1 h-3.5 w-3.5" />
                                  واتساب
                                </a>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled
                                className="h-8 px-2.5 text-xs"
                                title="رقم الهاتف غير صالح أو غير متوفر لإرسال رسالة واتساب"
                              >
                                <MessageCircle className="ms-1 h-3.5 w-3.5" />
                                واتساب
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => confirmDeletePatient(patient)}
                              className="h-8 px-2.5 text-xs"
                              aria-label={`حذف المريض ${patient.name}`}
                            >
                              <Trash2 className="ms-1 h-3.5 w-3.5" />
                              حذف
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground">
                <span>
                  عرض <strong className="text-foreground tabular-nums">{displayStart}</strong> إلى{' '}
                  <strong className="text-foreground tabular-nums">{displayEnd}</strong> من أصل{' '}
                  <strong className="text-foreground tabular-nums">{totalCount}</strong> مريض
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs whitespace-nowrap">لكل صفحة:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={handlePageSizeChange}
                    disabled={isRefreshing}
                  >
                    <SelectTrigger
                      className="h-8 w-[76px] text-xs"
                      aria-label="عدد السجلات في الصفحة"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((sizeOption) => (
                        <SelectItem
                          key={sizeOption}
                          value={String(sizeOption)}
                          className="text-xs"
                        >
                          {sizeOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1 || isRefreshing}
                  className="h-8 px-2.5 text-xs gap-1"
                  aria-label="الصفحة السابقة"
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>

                {paginationItems.map((item) => {
                  if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                    return (
                      <span
                        key={item}
                        className="px-1.5 text-xs text-muted-foreground select-none"
                        aria-hidden="true"
                      >
                        ...
                      </span>
                    );
                  }

                  const isActive = item === safeCurrentPage;
                  return (
                    <Button
                      key={item}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(item)}
                      disabled={isRefreshing}
                      className="h-8 min-w-[32px] px-2 text-xs tabular-nums"
                      aria-label={`صفحة ${item}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {item}
                    </Button>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage >= totalPages || isRefreshing}
                  className="h-8 px-2.5 text-xs gap-1"
                  aria-label="الصفحة التالية"
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg shadow-sm bg-card">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-xl font-semibold">لا يوجد مرضى</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? "لم يتم العثور على مرضى يطابقون بحثك." : "ابدأ بإضافة مريض جديد."}
            </p>
          </div>
        )}

        {/* Add Patient Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
            {isFormOpen && (
              <PatientForm
                patient={null}
                onSuccess={handleFormSuccess}
                setOpen={setIsFormOpen}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Add Appointment Dialog (after patient creation) */}
        <Dialog open={isAppointmentFormOpen} onOpenChange={setIsAppointmentFormOpen}>
          <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
            {isAppointmentFormOpen && (
              <AppointmentForm
                patients={appointmentFormPatients}
                onSuccess={handleAppointmentFormSuccess}
                setOpen={setIsAppointmentFormOpen}
                defaultPatientId={appointmentDefaultPatient?.id}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Image Manager Dialog (opened by clicking patient avatar) */}
        {selectedPatientForImageManagement && (
          <PatientImageManagerDialog
            patient={selectedPatientForImageManagement}
            isOpen={isImageManagerOpen}
            setOpen={setIsImageManagerOpen}
            onImagesUpdate={handlePatientImagesUpdate}
          />
        )}

        {/* Print & Export Options Modal */}
        <PatientsPrintExportDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          totalFilteredCount={totalCount}
          currentPagePatients={patients}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          exportScope={exportScope}
          onExportScopeChange={setExportScope}
          selectedColumns={selectedExportColumns}
          onSelectedColumnsChange={setSelectedExportColumns}
          onPrintReady={handlePrintReady}
          searchTerm={debouncedSearchTerm}
        />

        {/* Delete Patient Confirmation */}
        <AlertDialog
          open={isDeleteAlertOpen}
          onOpenChange={(open) => {
            if (!isDeletingPatient) {
              setIsDeleteAlertOpen(open);
              if (!open) setPatientToDelete(null);
            }
          }}
        >
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
              <AlertDialogDescription>
                هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات المريض{" "}
                <strong>{patientToDelete?.name}</strong> بشكل دائم وجميع مواعيده وصوره المرتبطة به.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeletingPatient}
                onClick={() => {
                  setPatientToDelete(null);
                  setIsDeleteAlertOpen(false);
                }}
              >
                إلغاء
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeletingPatient}
                onClick={(e) => {
                  e.preventDefault();
                  handleDeletePatient();
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeletingPatient ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : null}
                {isDeletingPatient ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Print-Only RTL Table */}
      <PatientsPrintView
        patients={effectivePrintPatients}
        selectedColumns={selectedExportColumns}
        searchTerm={debouncedSearchTerm}
        scopeLabel={effectivePrintScopeLabel}
      />
    </>
  );
}