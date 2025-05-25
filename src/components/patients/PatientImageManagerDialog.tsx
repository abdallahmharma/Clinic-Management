
"use client";

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/lib/types';
import { updatePatient, uploadPatientImage } from '@/lib/api';
import { Loader2, Trash2, UploadCloud, X } from 'lucide-react';
import { getStoragePathFromUrl } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
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

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface PatientImageManagerDialogProps {
  patient: Patient | null;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onImagesUpdate: (updatedPatient: Patient) => void;
}

export function PatientImageManagerDialog({ patient, isOpen, setOpen, onImagesUpdate }: PatientImageManagerDialogProps) {
  const { toast } = useToast();
  const [currentImageUrls, setCurrentImageUrls] = React.useState<string[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (patient) {
      setCurrentImageUrls(patient.imageUrls || []);
    } else {
      setCurrentImageUrls([]);
    }
    if (fileInputRef.current) { // Reset file input when dialog opens or patient changes
        fileInputRef.current.value = "";
    }
  }, [patient, isOpen]);

  if (!patient) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFiles = Array.from(event.target.files);
      const validFiles = selectedFiles.filter(file =>
        file.size <= MAX_FILE_SIZE_BYTES && ACCEPTED_IMAGE_TYPES.includes(file.type)
      );

      if (validFiles.length !== selectedFiles.length) {
        toast({
          title: "ملفات غير صالحة",
          description: `بعض الملفات تجاوزت الحد الأقصى للحجم (${MAX_FILE_SIZE_MB}MB) أو نوعها غير مدعوم. تم تجاهلها.`,
          variant: "destructive",
        });
      }

      if (validFiles.length === 0) {
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear if no valid files
        return;
      }
      
      setIsUploading(true);
      try {
        const uploadPromises = validFiles.map(file => uploadPatientImage(file, patient.id));
        const newUploadedUrls = await Promise.all(uploadPromises);

        const updatedImageUrls = [...currentImageUrls, ...newUploadedUrls];

        const updatedPatientData = await updatePatient(patient.id, { imageUrls: updatedImageUrls });
        if (updatedPatientData) {
          setCurrentImageUrls(updatedImageUrls);
          onImagesUpdate(updatedPatientData);
          toast({ title: "نجاح", description: "تم تحميل الصور وتحديث بيانات المريض." });
        } else {
          throw new Error("Failed to update patient after image upload.");
        }
      } catch (error) {
        console.error("Error uploading images:", error);
        toast({ title: "خطأ في الرفع", description: "فشل في تحميل الصور. الرجاء المحاولة مرة أخرى.", variant: "destructive" });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file input after processing
      }
    }
  };

  const handleDeleteImage = async (imageUrlToDelete: string) => {
    setIsDeleting(prev => ({ ...prev, [imageUrlToDelete]: true }));
    try {
      const storagePath = getStoragePathFromUrl(imageUrlToDelete, 'patient-images');
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from('patient-images').remove([storagePath]);
        if (storageError) {
          console.error("Error deleting image from storage:", storageError);
          toast({ title: "خطأ في الحذف من التخزين", description: `فشل حذف الصورة من التخزين: ${storageError.message}. قد تحتاج للحذف اليدوي.`, variant: "destructive", duration: 7000 });
        }
      } else {
        console.warn("Could not determine storage path for deletion:", imageUrlToDelete);
        toast({ title: "تحذير", description: "لم يتمكن من تحديد مسار الصورة في التخزين للحذف.", variant: "default", duration: 7000 });
      }

      const updatedImageUrls = currentImageUrls.filter(url => url !== imageUrlToDelete);
      const updatedPatientData = await updatePatient(patient.id, { imageUrls: updatedImageUrls });

      if (updatedPatientData) {
        setCurrentImageUrls(updatedImageUrls);
        onImagesUpdate(updatedPatientData);
        toast({ title: "نجاح", description: "تم حذف الصورة بنجاح." });
      } else {
        throw new Error("Failed to update patient after image deletion.");
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      toast({ title: "خطأ في الحذف", description: "فشل في حذف الصورة. الرجاء المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setIsDeleting(prev => ({ ...prev, [imageUrlToDelete]: false }));
    }
  };

  const closeDialog = () => {
    setOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) closeDialog()}}>
      <DialogContent className="sm:max-w-[600px] p-0" dir="rtl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl">إدارة صور المريض: {patient.name}</DialogTitle>
          <DialogDescription>عرض، إضافة، أو حذف صور المريض.</DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <Label htmlFor="imageUpload" className="text-base font-medium">
              {isUploading ? "جاري رفع الصور..." : "إضافة صور جديدة (سيتم الرفع مباشرة)"}
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="imageUpload"
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                onChange={handleFileChange}
                className="flex-grow"
                disabled={isUploading}
              />
              {isUploading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">الصور الحالية ({currentImageUrls.length})</Label>
            {currentImageUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {currentImageUrls.map(url => (
                  <div key={url} className="relative group aspect-square">
                    <Image
                      src={url}
                      alt={`صورة مريض ${patient.name}`}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md border bg-muted"
                      data-ai-hint="medical patient photo"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          disabled={isDeleting[url] || isUploading}
                        >
                          {isDeleting[url] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد أنك تريد حذف هذه الصورة؟ هذا الإجراء سيقوم بحذف الصورة من التخزين بشكل دائم.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteImage(url)} className="bg-destructive hover:bg-destructive/90">
                            نعم، قم بالحذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد صور حالية لهذا المريض.</p>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={closeDialog} disabled={isUploading}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
