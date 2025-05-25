
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw, CalendarHeart } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AppointmentForm } from '@/components/appointments/AppointmentForm';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import type { Appointment, PatientSelectItem } from '@/lib/types';
import { getAppointments, getPatientSelectItems, deleteAppointment as apiDeleteAppointment } from '@/lib/mockApi';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';


export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [patients, setPatients] = React.useState<PatientSelectItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
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

  const handleDeleteAppointment = async (appointmentId: string) => {
     try {
      await apiDeleteAppointment(appointmentId); // Using mock API
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));
      toast({ title: "نجاح", description: "تم حذف الموعد بنجاح." });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف الموعد.", variant: "destructive" });
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
    const appointmentDate = parse(appointment.date, 'yyyy-MM-dd', new Date());
    const formattedDate = format(appointmentDate, "d MMMM yyyy", { locale: arSA }); // For searching by formatted date
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
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-5 w-1/4 ml-auto" />
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="p-4 flex justify-end gap-2 border-t pt-3">
                 <Skeleton className="h-9 w-20" />
                 <Skeleton className="h-9 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard 
              key={appointment.id} 
              appointment={appointment}
              onEdit={handleEditAppointment}
              onDelete={handleDeleteAppointment}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <CalendarHeart className="mx-auto h-12 w-12 text-muted-foreground" />
           <h3 className="mt-2 text-xl font-semibold">لا توجد مواعيد</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "لم يتم العثور على مواعيد تطابق بحثك." : (patients.length > 0 ? "ابدأ بإضافة موعد جديد." : "يرجى إضافة مرضى أولاً لتتمكن من حجز المواعيد.")}
          </p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
         {isFormOpen && (
            <AppointmentForm
              appointment={editingAppointment}
              patients={patients}
              onSuccess={handleFormSuccess}
              setOpen={setIsFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
