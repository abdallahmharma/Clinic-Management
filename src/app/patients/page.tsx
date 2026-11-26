"use client";

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw, Users, Edit3, Trash2, Image as ImageIcon, FileText, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import type { Appointment, Patient } from '@/lib/types';
import { getPatients, deletePatient as apiDeletePatient } from '@/lib/api';
import { buildWhatsAppUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function PatientsPage() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = React.useState<Patient | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [isDeletingPatient, setIsDeletingPatient] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  const [selectedPatientForImageManagement, setSelectedPatientForImageManagement] = React.useState<Patient | null>(null);
  const [isImageManagerOpen, setIsImageManagerOpen] = React.useState(false);

  const [isAppointmentFormOpen, setIsAppointmentFormOpen] = React.useState(false);
  const [appointmentDefaultPatient, setAppointmentDefaultPatient] = React.useState<Patient | null>(null);

  const hasLoadedRef = React.useRef(false);

  const fetchPageData = React.useCallback(async () => {
    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const patientsData = await getPatients();
      setPatients(patientsData);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Fetch patients data error:", error);
      toast({ title: "خطأ", description: "فشل في تحميل بيانات المرضى.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const handleAddPatient = React.useCallback(() => {
    setEditingPatient(null);
    setIsFormOpen(true);
  }, []);

  const handleEditPatient = React.useCallback((patient: Patient) => {
    setEditingPatient(patient);
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
      setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
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
        toast({ title: "نجاح", description: `تم حذف المريض ${patientToDelete.name} وجميع صوره بنجاح.` });
      }

      setIsDeleteAlertOpen(false);
      setPatientToDelete(null);
    } catch (error) {
      console.error("Delete patient error:", error);
      toast({ title: "خطأ", description: "فشل في حذف المريض.", variant: "destructive" });
    } finally {
      setIsDeletingPatient(false);
    }
  }, [patientToDelete, isDeletingPatient, selectedPatientForImageManagement, toast]);

  const handleFormSuccess = React.useCallback((updatedPatient: Patient, openAppointmentForm?: boolean) => {
    setPatients(prev => {
      const exists = prev.some(p => p.id === updatedPatient.id);
      const next = exists
        ? prev.map(p => (p.id === updatedPatient.id ? updatedPatient : p))
        : [updatedPatient, ...prev];
      return next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
    setIsFormOpen(false);
    setEditingPatient(null);

    if (openAppointmentForm) {
      setAppointmentDefaultPatient(updatedPatient);
      setIsAppointmentFormOpen(true);
    }
  }, []);

  const handlePatientImagesUpdate = React.useCallback((updatedPatient: Patient) => {
    setPatients(prev => prev.map(p => (p.id === updatedPatient.id ? updatedPatient : p)));
    setSelectedPatientForImageManagement(updatedPatient);
  }, []);

  const handleAppointmentFormSuccess = React.useCallback((_savedAppointment: Appointment) => {
    setIsAppointmentFormOpen(false);
    setAppointmentDefaultPatient(null);
  }, []);

  const filteredPatients = React.useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return patients;
    return patients.filter(patient =>
      patient.name.toLowerCase().includes(normalizedSearch) ||
      patient.phone.includes(normalizedSearch)
    );
  }, [patients, searchTerm]);

  const primaryImageSources = React.useMemo(
    () => patients.map((p) => p.imageUrls?.[0]).filter((u): u is string => Boolean(u)),
    [patients]
  );
  const { signedUrlMap } = useSignedPatientImages(primaryImageSources);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-primary">عرض المرضى</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={fetchPageData} variant="outline" disabled={isLoading || isRefreshing} className="flex-shrink-0">
            {isLoading || isRefreshing ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
            {isRefreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button onClick={handleAddPatient} size="lg" className="flex-shrink-0">
            <PlusCircle className="ms-2 h-5 w-5" />
            إضافة مريض جديد
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="ابحث بالاسم، أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full ps-10 py-3 text-base"
        />
      </div>

      {isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">الصورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="w-[70px] text-center">العمر</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="w-[260px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="flex justify-center"><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell className="text-center space-x-1 rtl:space-x-reverse">
                    <Skeleton className="h-9 w-[70px] inline-block" />
                    <Skeleton className="h-9 w-[70px] inline-block" />
                    <Skeleton className="h-9 w-[40px] inline-block" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filteredPatients.length > 0 ? (
        <div className="rounded-md border shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px] text-center">الصورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="w-[70px] text-center">العمر</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="w-[340px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const firstImg = patient.imageUrls?.[0];
                const avatarSrc = firstImg
                  ? (firstImg.startsWith('data:') || firstImg.startsWith('blob:')
                      ? firstImg
                      : signedUrlMap[firstImg])
                  : undefined;
                const whatsAppUrl = buildWhatsAppUrl({
                  phone: patient.phone,
                  patientName: patient.name,
                });

                return (
                  <TableRow key={patient.id}>
                    <TableCell className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleOpenImageManager(patient)}
                        className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        aria-label={`إدارة صور ${patient.name}`}
                      >
                        <Avatar>
                          <AvatarImage
                            src={avatarSrc}
                            alt={patient.name}
                            data-ai-hint="person portrait"
                            className="object-cover"
                          />
                          <AvatarFallback>
                            {patient.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      <Link href={`/patients/${patient.id}`} className="hover:underline">
                        {patient.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">{patient.age}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground text-left">{patient.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: arSA })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        asChild
                        className="ms-1"
                      >
                        <Link href={`/patients/${patient.id}`} aria-label={`السجل التاريخي للمريض ${patient.name}`}>
                          <FileText className="ms-1 h-4 w-4" />
                          السجل
                        </Link>
                      </Button>
                      {whatsAppUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="ms-1 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                        >
                          <a
                            href={whatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`مراسلة واتساب للمريض ${patient.name}`}
                          >
                            <MessageCircle className="ms-1 h-4 w-4" />
                            واتساب
                          </a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled
                          className="ms-1"
                          title="رقم الهاتف غير صالح أو غير متوفر لإرسال رسالة واتساب"
                        >
                          <MessageCircle className="ms-1 h-4 w-4" />
                          واتساب
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenImageManager(patient)}
                        className="ms-1"
                        aria-label={`إدارة صور ${patient.name}`}
                      >
                        <ImageIcon className="ms-1 h-4 w-4" />
                        صور
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditPatient(patient)} className="ms-1">
                        <Edit3 className="ms-1 h-4 w-4" />
                        تعديل
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => confirmDeletePatient(patient)} className="ms-1">
                        <Trash2 className="ms-1 h-4 w-4" />
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-md shadow-sm">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">لا يوجد مرضى</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "لم يتم العثور على مرضى يطابقون بحثك." : "ابدأ بإضافة مريض جديد."}
          </p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {isFormOpen && (
            <PatientForm
              patient={editingPatient}
              onSuccess={handleFormSuccess}
              setOpen={setIsFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAppointmentFormOpen} onOpenChange={setIsAppointmentFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {isAppointmentFormOpen && (
            <AppointmentForm
              patients={patients}
              onSuccess={handleAppointmentFormSuccess}
              setOpen={setIsAppointmentFormOpen}
              defaultPatientId={appointmentDefaultPatient?.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedPatientForImageManagement && (
        <PatientImageManagerDialog
          patient={selectedPatientForImageManagement}
          isOpen={isImageManagerOpen}
          setOpen={setIsImageManagerOpen}
          onImagesUpdate={handlePatientImagesUpdate}
        />
      )}

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
  );
}