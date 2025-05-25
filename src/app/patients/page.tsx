
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw, Users, Edit3, Trash2, X, Image as ImageIcon } from 'lucide-react'; // Added X and ImageIcon
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import type { Patient } from '@/lib/types';
import { getPatients, deletePatient as apiDeletePatient } from '@/lib/api';
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
import { PatientImageManagerDialog } from '@/components/patients/PatientImageManagerDialog'; // New import

export default function PatientsPage() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
  const [patientToDelete, setPatientToDelete] = React.useState<Patient | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  const [selectedPatientForImageManagement, setSelectedPatientForImageManagement] = React.useState<Patient | null>(null);
  const [isImageManagerOpen, setIsImageManagerOpen] = React.useState(false);

  const fetchPatients = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPatients();
      setPatients(data);
    } catch (error) {
      console.error("Fetch patients error:", error);
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
      console.error("Delete patient error:", error);
      toast({ title: "خطأ", description: "فشل في حذف المريض.", variant: "destructive" });
    } finally {
      setIsDeleteAlertOpen(false);
      setPatientToDelete(null);
    }
  };

  const handleFormSuccess = (updatedPatient: Patient) => {
    if (editingPatient) { 
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } else { 
      setPatients(prev => [updatedPatient, ...prev]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }
    setIsFormOpen(false);
    setEditingPatient(null);
  };
  
  const handlePatientImagesUpdate = (updatedPatient: Patient) => {
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
    // Optionally: setIsImageManagerOpen(false); // if you want to close dialog automatically
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
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
                <TableHead className="w-[200px] text-center">إجراءات</TableHead> 
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
                <TableHead className="w-[200px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="flex justify-center">
                    <button 
                      onClick={() => {
                        setSelectedPatientForImageManagement(patient);
                        setIsImageManagerOpen(true);
                      }}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      aria-label={`إدارة صور ${patient.name}`}
                    >
                      <Avatar>
                        <AvatarImage 
                          src={patient.imageUrls && patient.imageUrls.length > 0 ? patient.imageUrls[0] : undefined} 
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
                  <TableCell className="font-medium text-primary">{patient.name}</TableCell>
                  <TableCell className="text-center">{patient.age}</TableCell>
                  <TableCell dir="ltr" className="text-muted-foreground text-left">{patient.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: arSA })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSelectedPatientForImageManagement(patient);
                          setIsImageManagerOpen(true);
                        }} 
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

      {selectedPatientForImageManagement && (
        <PatientImageManagerDialog
            patient={selectedPatientForImageManagement}
            isOpen={isImageManagerOpen}
            setOpen={setIsImageManagerOpen}
            onImagesUpdate={handlePatientImagesUpdate}
        />
      )}

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات المريض{" "}
              <strong>{patientToDelete?.name}</strong> بشكل دائم وجميع مواعيده وصوره المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setPatientToDelete(null); setIsDeleteAlertOpen(false);}}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePatient} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
