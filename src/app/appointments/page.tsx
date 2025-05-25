
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw, CalendarHeart, Edit3, Trash2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import type { Appointment, PatientSelectItem } from '@/lib/types';
import { getAppointments, getPatientSelectItems, deleteAppointment as apiDeleteAppointment } from '@/lib/api'; // Updated import
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Keep Card for other potential uses

export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [patients, setPatients] = React.useState<PatientSelectItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = React.useState<Appointment | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [appointmentsData, patientsData] = await Promise.all([
        getAppointments(),
        getPatientSelectItems(),
      ]);
      setAppointments(appointmentsData);
      setPatients(patientsData);
    } catch (error) {
      console.error("Fetch appointments data error:", error);
      toast({ title: "خطأ", description: "فشل في تحميل البيانات.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddAppointment = () => {
    if (patients.length === 0) {
      toast({ title: "تنبيه", description: "يجب إضافة مرضى أولاً قبل إضافة موعد.", variant: "default" });
      return;
    }
    setEditingAppointment(null);
    setIsFormOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsFormOpen(true);
  };

  const confirmDeleteAppointment = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return;
     try {
      await apiDeleteAppointment(appointmentToDelete.id);
      setAppointments(prev => prev.filter(a => a.id !== appointmentToDelete.id));
      toast({ title: "نجاح", description: "تم حذف الموعد بنجاح." });
    } catch (error) {
      console.error("Delete appointment error:", error);
      toast({ title: "خطأ", description: "فشل في حذف الموعد.", variant: "destructive" });
    } finally {
      setIsDeleteAlertOpen(false);
      setAppointmentToDelete(null);
    }
  };
  
  const handleFormSuccess = (updatedAppointment: Appointment) => {
    if (editingAppointment) {
      setAppointments(prev => prev.map(a => a.id === updatedAppointment.id ? updatedAppointment : a)
        .sort((a,b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime())
      );
    } else {
      setAppointments(prev => [updatedAppointment, ...prev]
        .sort((a,b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime())
      );
    }
    setIsFormOpen(false);
    setEditingAppointment(null);
  };
  
  const filteredAppointments = appointments.filter(appointment => {
    // Ensure appointment.date is valid before parsing
     let appointmentDate;
    try {
        appointmentDate = parse(appointment.date, 'yyyy-MM-dd', new Date());
         if (isNaN(appointmentDate.getTime())) { // Check if parsing resulted in a valid date
            return false; // or handle as needed
        }
    } catch (e) {
        console.warn(`Invalid date format for appointment ID ${appointment.id}: ${appointment.date}`);
        return false; // Skip this appointment if date is invalid
    }
    const formattedDate = format(appointmentDate, "d MMMM yyyy", { locale: arSA }); 
    return (
      appointment.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.time.includes(searchTerm) ||
      formattedDate.includes(searchTerm) ||
      (appointment.notes && appointment.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-primary">إدارة المواعيد</h1>
         <div className="flex gap-2 w-full sm:w-auto">
           <Button onClick={fetchData} variant="outline" disabled={isLoading} className="flex-shrink-0">
            {isLoading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
            تحديث
          </Button>
          <Button onClick={handleAddAppointment} size="lg" className="flex-shrink-0" disabled={patients.length === 0 && !isLoading}>
            <PlusCircle className="ms-2 h-5 w-5" />
            إضافة موعد جديد
          </Button>
        </div>
      </div>

       <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="ابحث باسم المريض، التاريخ، الوقت أو الملاحظات..."
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
                <TableHead>اسم المريض</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="w-[100px]">الوقت</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead className="w-[160px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell className="text-center space-x-2 rtl:space-x-reverse">
                    <Skeleton className="h-9 w-20 inline-block" />
                    <Skeleton className="h-9 w-20 inline-block" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="rounded-md border shadow-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المريض</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="w-[100px]">الوقت</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead className="w-[160px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appointment) => {
                let appointmentDate;
                let formattedDisplayDate = "تاريخ غير صالح";
                try {
                    appointmentDate = parse(appointment.date, 'yyyy-MM-dd', new Date());
                    if (isNaN(appointmentDate.getTime())) throw new Error("Invalid date");
                    formattedDisplayDate = format(appointmentDate, "EEEE, d MMMM yyyy", { locale: arSA });
                } catch (e) {
                     // formattedDisplayDate remains "تاريخ غير صالح"
                }
                
                let formattedCreatedAt = "تاريخ غير صالح";
                try {
                    const createdAtDate = new Date(appointment.createdAt);
                    if (isNaN(createdAtDate.getTime())) throw new Error("Invalid created at date");
                    formattedCreatedAt = format(createdAtDate, "dd/MM/yyyy HH:mm", { locale: arSA });
                } catch (e) {
                     // formattedCreatedAt remains "تاريخ غير صالح"
                }

                return (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium text-primary">{appointment.patientName}</TableCell>
                    <TableCell>{formattedDisplayDate}</TableCell>
                    <TableCell className="text-muted-foreground">{appointment.time}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-xs">{appointment.notes || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formattedCreatedAt}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => handleEditAppointment(appointment)} className="ms-2">
                        <Edit3 className="ms-1 h-4 w-4" />
                        تعديل
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => confirmDeleteAppointment(appointment)} className="ms-2">
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
          <CalendarHeart className="mx-auto h-12 w-12 text-muted-foreground" />
           <h3 className="mt-2 text-xl font-semibold">لا توجد مواعيد</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "لم يتم العثور على مواعيد تطابق بحثك." : (patients.length > 0 ? "ابدأ بإضافة موعد جديد." : "يرجى إضافة مرضى أولاً لتتمكن من حجز المواعيد.")}
          </p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
         {isFormOpen && ( // Conditionally render to reset form state
            <AppointmentForm
              appointment={editingAppointment}
              patients={patients}
              onSuccess={handleFormSuccess}
              setOpen={setIsFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات الموعد لـ{" "}
              <strong>{appointmentToDelete?.patientName}</strong> في تاريخ{" "}
              <strong>{appointmentToDelete && !isNaN(parse(appointmentToDelete.date, 'yyyy-MM-dd', new Date()).getTime()) ? format(parse(appointmentToDelete.date, 'yyyy-MM-dd', new Date()), "d MMMM yyyy", { locale: arSA }) : "غير محدد"}</strong>{" "}
              الساعة <strong>{appointmentToDelete?.time}</strong> بشكل دائم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setAppointmentToDelete(null); setIsDeleteAlertOpen(false);}}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAppointment} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
