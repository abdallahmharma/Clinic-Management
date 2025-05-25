
"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PatientForm } from '@/components/patients/PatientForm';
import { PatientCard } from '@/components/patients/PatientCard';
import type { Patient } from '@/lib/types';
import { getPatients, addPatient as apiAddPatient, updatePatient as apiUpdatePatient, deletePatient as apiDeletePatient } from '@/lib/mockApi';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function PatientsPage() {
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingPatient, setEditingPatient] = React.useState<Patient | null>(null);
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

  const handleDeletePatient = async (patientId: string) => {
    try {
      await apiDeletePatient(patientId); // Using mock API
      setPatients(prev => prev.filter(p => p.id !== patientId));
      toast({ title: "نجاح", description: "تم حذف المريض بنجاح." });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حذف المريض.", variant: "destructive" });
    }
  };

  const handleFormSuccess = (updatedPatient: Patient) => {
    if (editingPatient) { // Edit
      setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
    } else { // Add
      setPatients(prev => [updatedPatient, ...prev]);
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
        <h1 className="text-3xl font-bold text-primary">إدارة المرضى</h1>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <Skeleton className="h-40 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-3/4" />
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
      ) : filteredPatients.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPatients.map((patient) => (
            <PatientCard 
              key={patient.id} 
              patient={patient} 
              onEdit={handleEditPatient}
              onDelete={handleDeletePatient}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">لا يوجد مرضى</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "لم يتم العثور على مرضى يطابقون بحثك." : "ابدأ بإضافة مريض جديد."}
          </p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0" dir="rtl">
          {/* PatientForm is rendered here, needs patient and onSuccess props */}
          {/* Conditional rendering to ensure form has the right context when dialog opens */}
          {isFormOpen && (
            <PatientForm 
              patient={editingPatient} 
              onSuccess={handleFormSuccess}
              setOpen={setIsFormOpen}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
