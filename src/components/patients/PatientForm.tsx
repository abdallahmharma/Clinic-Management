
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/lib/types';
import { addPatient, updatePatient } from '@/lib/api'; // Updated import
import { Loader2 } from 'lucide-react';

const patientSchema = z.object({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  age: z.coerce.number().min(0, { message: "يجب أن يكون العمر رقمًا موجبًا" }).max(120),
  phone: z.string().regex(/^05\d{8}$/, { message: "يجب أن يكون رقم الهاتف سعوديًا صالحًا (05xxxxxxxx)" }),
  email: z.string().email({ message: "البريد الإلكتروني غير صالح" }),
  imageUrl: z.string().url({ message: "رابط الصورة غير صالح" }).optional().or(z.literal('')),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  patient?: Patient | null; // For editing
  onSuccess: (patient: Patient) => void; // Callback after successful submission
  setOpen: (open: boolean) => void; // To close the dialog
}

export function PatientForm({ patient, onSuccess, setOpen }: PatientFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: patient?.name || '',
      age: patient?.age || 0,
      phone: patient?.phone || '',
      email: patient?.email || '',
      imageUrl: patient?.imageUrl || '',
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    setIsSubmitting(true);
    try {
      let result: Patient;
      const patientInputData = {
        name: data.name,
        age: Number(data.age),
        phone: data.phone,
        email: data.email,
        imageUrl: data.imageUrl || undefined,
      };

      if (patient && patient.id) { // Editing
        const updatedPatient = await updatePatient(patient.id, patientInputData);
        if (!updatedPatient) throw new Error("Failed to update patient");
        result = updatedPatient;
        toast({ title: "نجاح", description: "تم تعديل بيانات المريض بنجاح." });
      } else { // Adding
        result = await addPatient(patientInputData);
        toast({ title: "نجاح", description: "تمت إضافة المريض بنجاح." });
      }
      onSuccess(result);
      setOpen(false);
    } catch (error) {
      console.error("Error submitting patient form:", error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ بيانات المريض.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
      <DialogHeader>
        <DialogTitle>{patient ? 'تعديل بيانات المريض' : 'إضافة مريض جديد'}</DialogTitle>
        <DialogDescription>
          {patient ? 'قم بتحديث معلومات المريض أدناه.' : 'أدخل معلومات المريض الجديد أدناه.'}
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">الاسم الكامل</Label>
          <Input id="name" {...register("name")} className="mt-1"/>
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="age">العمر</Label>
          <Input id="age" type="number" {...register("age")} className="mt-1"/>
          {errors.age && <p className="text-sm text-destructive mt-1">{errors.age.message}</p>}
        </div>

        <div>
          <Label htmlFor="phone">رقم الهاتف</Label>
          <Input id="phone" {...register("phone")} className="mt-1" dir="ltr" />
          {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" {...register("email")} className="mt-1" dir="ltr"/>
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="imageUrl">رابط صورة المريض (اختياري)</Label>
          <Input id="imageUrl" {...register("imageUrl")} placeholder="https://example.com/image.png" className="mt-1" dir="ltr"/>
          {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {patient ? 'حفظ التعديلات' : 'إضافة مريض'}
        </Button>
      </DialogFooter>
    </form>
  );
}
