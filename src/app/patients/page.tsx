
"use client";

import * as React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw, Users, Edit3, Trash2, User as UserIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import type { Patient } from '@/lib/types';
import { getPatients, deletePatient as apiDeletePatient } from '@/lib/mockApi';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function PatientsPage() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = React.useState<Patient | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  const fetchPatients = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPatients();
      setPatients(data);
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تحميل قائمة المرضى.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleAddPatient = () => {
    setEditingPatient(null);
    setIsFormOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setIsFormOpen(true);
  };

  const confirmDeletePatient = (patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteAlertOpen(true);
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    try {
      await apiDeletePatient(patientToDelete.id);
      setPatients(prev => prev.filter(p => p.id !== patientToDelete.id));
      toast({ title: "نجاح", description: `تم حذف المريض ${patientToDelete.name} بنجاح.` });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف المريض.", variant: "destructive" });
    } finally {
      setIsDeleteAlertOpen(false);
      setPatientToDelete(null);
    }
  };

  const handleFormSuccess = (updatedPatient: Patient) => {
    if (editingPatient) { // Edit
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } else { // Add
      setPatients(prev => [updatedPatient, ...prev]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }
    setIsFormOpen(false);
    setEditingPatient(null);
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-primary">عرض المرضى</h1>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button onClick={fetchPatients} variant="outline" disabled={isLoading} className="flex-shrink-0">
            {isLoading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
            تحديث
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
          placeholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..."
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
                <TableHead className="w-[80px]">الصورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead className="w-[70px]">العمر</TableHead>
                <TableHead>رقم الهاتف</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="w-[150px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                  <TableCell className="flex gap-2">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
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
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead className="w-[160px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="flex justify-center">
                    <Avatar>
                      <AvatarImage src={patient.imageUrl || undefined} alt={patient.name} data-ai-hint="person portrait" />
                      <AvatarFallback>
                        {patient.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-primary">{patient.name}</TableCell>
                  <TableCell className="text-center">{patient.age}</TableCell>
                  <TableCell dir="ltr" className="text-muted-foreground">{patient.phone}</TableCell>
                  <TableCell dir="ltr" className="text-muted-foreground">{patient.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: arSA })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" size="sm" onClick={() => handleEditPatient(patient)} className="ms-2">
                      <Edit3 className="ms-1 h-4 w-4" />
                      تعديل
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => confirmDeletePatient(patient)} className="ms-2">
                      <Trash2 className="ms-1 h-4 w-4" />
                      حذف
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات المريض{" "}
              <strong>{patientToDelete?.name}</strong> بشكل دائم وجميع مواعيده المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPatientToDelete(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePatient} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
