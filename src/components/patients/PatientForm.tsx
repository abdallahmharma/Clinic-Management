
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
import { addPatient, updatePatient, uploadPatientImage } from '@/lib/api';
import { Loader2, X } from 'lucide-react';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const patientSchema = z.object({
  name: z.string().min(3, { message: "يجب أن يكون الاسم 3 أحرف على الأقل" }),
  age: z.coerce.number().min(0, { message: "يجب أن يكون العمر رقمًا موجبًا" }).max(120),
  phone: z.string().regex(/^0\d{9}$/, { message: "رقم الهاتف يجب أن يتكون من 10 أرقام ويبدأ بـ 0 (مثال: 0772150001)" }),
  imageFiles: z.custom<FileList>()
    .optional()
    .refine(files => !files || files.length === 0 || Array.from(files).every(file => file.size <= MAX_FILE_SIZE_BYTES), 
            `حجم كل ملف يجب أن لا يتجاوز ${MAX_FILE_SIZE_MB} ميجابايت.`)
    .refine(files => !files || files.length === 0 || Array.from(files).every(file => ACCEPTED_IMAGE_TYPES.includes(file.type)),
            `فقط صيغ .jpg, .jpeg, .png, .webp مدعومة.`),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  patient?: Patient | null;
  onSuccess: (patient: Patient) => void;
  setOpen: (open: boolean) => void;
}

export function PatientForm({ patient, onSuccess, setOpen }: PatientFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [existingImageUrls, setExistingImageUrls] = React.useState<string[]>(patient?.imageUrls || []);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: patient?.name || '',
      age: patient?.age || ('' as any),
      phone: patient?.phone || '',
      imageFiles: undefined,
    },
  });

  const imageFiles = watch("imageFiles");

  React.useEffect(() => {
    if (patient) {
        reset({
            name: patient.name,
            age: patient.age,
            phone: patient.phone,
            imageFiles: undefined, // Clear file input on patient change
        });
        setExistingImageUrls(patient.imageUrls || []);
    } else {
        reset({ name: '', age: '' as any, phone: '', imageFiles: undefined });
        setExistingImageUrls([]);
    }
    setSelectedFiles([]); // Clear selected files preview on patient change or new form
  }, [patient, reset]);


  React.useEffect(() => {
    if (imageFiles && imageFiles.length > 0) {
      setSelectedFiles(Array.from(imageFiles));
    } else {
      setSelectedFiles([]);
    }
  }, [imageFiles]);

  const onSubmit = async (data: PatientFormData) => {
    setIsSubmitting(true);
    let currentImageUrls: string[] = [...existingImageUrls];

    try {
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(file => 
          uploadPatientImage(file, patient?.id) 
        );
        const newUploadedUrls = await Promise.all(uploadPromises);
        currentImageUrls.push(...newUploadedUrls);
      }

      const patientInputData = {
        name: data.name,
        age: Number(data.age),
        phone: data.phone,
        imageUrls: currentImageUrls.length > 0 ? currentImageUrls : null, // Send null if no images
      };

      let result: Patient;
      if (patient && patient.id) {
        const updatedPatient = await updatePatient(patient.id, patientInputData as Partial<Omit<Patient, 'id' | 'createdAt'>>);
        if (!updatedPatient) throw new Error("Failed to update patient");
        result = updatedPatient;
        toast({ title: "نجاح", description: "تم تعديل بيانات المريض بنجاح." });
      } else {
        result = await addPatient(patientInputData as Omit<Patient, 'id' | 'createdAt'>);
        toast({ title: "نجاح", description: "تمت إضافة المريض بنجاح." });
      }
      onSuccess(result);
      setOpen(false);
    } catch (error: any) {
      console.error("Error submitting patient form:", error.message ? { message: error.message, details: error.details, code: error.code } : error);
      const errorMessage = error.message || "حدث خطأ أثناء حفظ بيانات المريض.";
      toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRemoveExistingImage = (urlToRemove: string) => {
    setExistingImageUrls(prev => prev.filter(url => url !== urlToRemove));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
      <DialogHeader>
        <DialogTitle>{patient ? 'تعديل بيانات المريض' : 'إضافة مريض جديد'}</DialogTitle>
        <DialogDescription>
          {patient ? 'قم بتحديث معلومات المريض أدناه.' : 'أدخل معلومات المريض الجديد أدناه.'}
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 max-h-[70vh] overflow-y-auto p-5 pr-2">
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
          <Label htmlFor="imageFiles">صور المريض (اختياري)</Label>
          <Input id="imageFiles" type="file" multiple {...register("imageFiles")} className="mt-1" accept={ACCEPTED_IMAGE_TYPES.join(",")} />
          {errors.imageFiles && <p className="text-sm text-destructive mt-1">{errors.imageFiles.message as string}</p>}
        </div>

        {existingImageUrls.length > 0 && (
          <div>
            <Label>الصور الحالية:</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {existingImageUrls.map(url => (
                <div key={url} className="relative group">
                  <img src={url} alt="صورة مريض حالية" className="h-20 w-20 object-cover rounded-md border" />
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    onClick={() => handleRemoveExistingImage(url)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedFiles.length > 0 && (
            <div>
                <Label>الصور المحددة للرفع:</Label>
                <ul className="mt-1 list-disc ps-5 text-sm text-muted-foreground">
                    {selectedFiles.map((file, index) => (
                        <li key={index}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                    ))}
                </ul>
            </div>
        )}

      </div>

      <DialogFooter className="pt-4 border-t p-5">
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
