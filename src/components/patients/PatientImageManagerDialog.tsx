
"use client";

import * as React from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Patient } from '@/lib/types';
import { deletePatientImageFromStorage, updatePatient, uploadPatientImage } from '@/lib/api';
import { Loader2, Trash2, UploadCloud, X, AlertTriangle, Maximize } from 'lucide-react'; 
import { useSignedPatientImages } from '@/hooks/use-signed-patient-images';
import { Skeleton } from '@/components/ui/skeleton';
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
// Note: Assuming '@/components/ui/scroll-area' exists for better preview handling.
// If it doesn't exist, replace <ScrollArea> with a simple div with max-h-[95vh] and overflow-y-auto.

// --- Constants ---
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// =========================================================================
// 1. Custom Hook for Logic Separation (Cleaned and Extended)
// =========================================================================

const useImageManagement = (patient: Patient, onImagesUpdate: (updatedPatient: Patient) => void) => {
    const { toast } = useToast();
    const [currentImageUrls, setCurrentImageUrls] = React.useState<string[]>(patient.imageUrls || []);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState<Record<string, boolean>>({});
    const [imageToPreview, setImageToPreview] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        // Sync state with prop changes when patient or dialog state changes
        setCurrentImageUrls(patient.imageUrls || []);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [patient]);

    const handleFileChange = React.useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const selectedFiles = Array.from(files);
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
            if (fileInputRef.current) fileInputRef.current.value = "";
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
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [patient, currentImageUrls, onImagesUpdate, toast]);


    const handleDeleteImage = React.useCallback(async (imageUrlToDelete: string) => {
        setIsDeleting(prev => ({ ...prev, [imageUrlToDelete]: true }));
        try {
            // 1. Delete from Storage (Supabase private bucket)
            const deletedFromStorage = await deletePatientImageFromStorage(imageUrlToDelete);
            if (!deletedFromStorage) {
                toast({ title: "تحذير", description: "فشل حذف الصورة من التخزين السحابي. سيتم حذف الرابط من قاعدة البيانات.", variant: "default", duration: 7000 });
            }
            
            // 2. Delete from Database (Patient record)
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
    }, [patient, currentImageUrls, onImagesUpdate, toast]);

    return {
        currentImageUrls,
        isUploading,
        isDeleting,
        imageToPreview,
        fileInputRef,
        handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => handleFileChange(event.target.files),
        handleDeleteImage,
        setImageToPreview,
    };
};

// =========================================================================
// 2. Drag-and-Drop Upload Component (Aesthetic Improvement)
// =========================================================================

interface ImageUploadAreaProps {
    fileInputRef: React.RefObject<HTMLInputElement>;
    isUploading: boolean;
    handleFileChange: (files: FileList | null) => Promise<void>;
}

const ImageUploadArea: React.FC<ImageUploadAreaProps> = ({ fileInputRef, isUploading, handleFileChange }) => {
    const [isDragOver, setIsDragOver] = React.useState(false);

    const onDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragOver(false);
        if (isUploading) return;
        handleFileChange(event.dataTransfer.files);
    }, [handleFileChange, isUploading]);

    const onDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!isUploading) setIsDragOver(true);
    }, [isUploading]);

    const onDragLeave = React.useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleButtonClick = React.useCallback(() => {
        if (fileInputRef.current && !isUploading) {
            fileInputRef.current.click();
        }
    }, [fileInputRef, isUploading]);
    
    // Convert the event-based handler to the files-based handler
    const onInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(e.target.files);
    }, [handleFileChange]);

    return (
        <div 
            className={`
                border-2 border-dashed rounded-lg p-6 text-center
                transition-colors duration-200 ease-in-out
                ${isUploading ? 'cursor-not-allowed opacity-70 bg-gray-100 border-gray-300' : 'cursor-pointer'}
                ${!isUploading && isDragOver ? 'border-primary bg-primary/10' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
            `}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={handleButtonClick}
        >
            <Input
                id="imageUpload"
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                onChange={onInputChange}
                className="hidden" 
                disabled={isUploading}
            />
            
            <UploadCloud className={`mx-auto h-10 w-10 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-primary">اضغط للرفع</span> أو اسحب وأفلت الصور هنا.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
                الأنواع المدعومة: JPG, PNG, WEBP. الحد الأقصى للحجم: {MAX_FILE_SIZE_MB}MB.
            </p>
            {isUploading && (
                <div className="flex items-center justify-center mt-3">
                    <Loader2 className="h-5 w-5 animate-spin me-2 text-primary" />
                    <span className="text-primary font-medium">جاري ضغط ورفع الصور...</span>
                </div>
            )}
        </div>
    );
};

// =========================================================================
// 3. Image Preview Dialog (Accessible)
// =========================================================================

interface ImagePreviewDialogProps {
    isOpen: boolean;
    imageUrl: string | null;
    onClose: () => void;
    patientName: string;
}

const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({ isOpen, imageUrl, onClose, patientName }) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-4xl max-w-full h-full p-0" dir="rtl">
                
                {/* ACCESSIBILITY FIX: Visually hidden title and description (using sr-only) */}
                <DialogHeader className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">معاينة صورة المريض: {patientName}</DialogTitle>
                    <DialogDescription className="sr-only">صورة مكبرة لسجل المريض.</DialogDescription>
                </DialogHeader>

                {/* VISIBLE CLOSE BUTTON */}
                <div className="absolute top-4 left-4 z-20">
                    <Button variant="ghost" size="icon" onClick={onClose} className="bg-background/80 hover:bg-background">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                
                {/* IMAGE CONTENT */}
                <div className="w-full h-full max-h-[95vh] overflow-y-auto">
                    <div className="relative w-full min-h-[500px] flex items-center justify-center p-4">
                        {imageUrl ? (
                            <Image
                                src={imageUrl}
                                alt={`معاينة صورة المريض ${patientName}`}
                                width={1200} 
                                height={800} 
                                className="rounded-lg shadow-2xl object-contain max-h-[82vh] w-auto"
                            />
                        ) : (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// =========================================================================
// 4. Main Component
// =========================================================================

interface PatientImageManagerDialogProps {
  patient: Patient | null;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onImagesUpdate: (updatedPatient: Patient) => void;
}

export function PatientImageManagerDialog({ patient, isOpen, setOpen, onImagesUpdate }: PatientImageManagerDialogProps) {
  if (!patient) return null;

  return (
    <PatientImageManagerDialogContent
      patient={patient}
      isOpen={isOpen}
      setOpen={setOpen}
      onImagesUpdate={onImagesUpdate}
    />
  );
}

interface PatientImageManagerDialogContentProps {
  patient: Patient;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  onImagesUpdate: (updatedPatient: Patient) => void;
}

function PatientImageManagerDialogContent({
  patient,
  isOpen,
  setOpen,
  onImagesUpdate,
}: PatientImageManagerDialogContentProps) {
    const {
        currentImageUrls,
        isUploading,
        isDeleting,
        imageToPreview,
        fileInputRef,
        handleFileChange,
        handleDeleteImage,
        setImageToPreview,
    } = useImageManagement(patient, onImagesUpdate);

  const { signedUrlMap } = useSignedPatientImages(currentImageUrls);

  const previewDisplayUrl = imageToPreview
    ? (imageToPreview.startsWith('data:') || imageToPreview.startsWith('blob:')
        ? imageToPreview
        : signedUrlMap[imageToPreview] ?? null)
    : null;

  const isAnyDeleting = React.useMemo(
    () => Object.values(isDeleting).some(Boolean),
    [isDeleting]
  );

  const closeDialog = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleUploadFiles = React.useCallback(
    (files: FileList | null) => handleFileChange({ target: { files } } as React.ChangeEvent<HTMLInputElement>),
    [handleFileChange]
  );

  return (
    <>
        {/* Main Image Management Dialog */}
        <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) setOpen(open); }}>
          <DialogContent className="sm:max-w-[800px] p-0" dir="rtl">
            <DialogHeader className="p-4 pb-1">
                <DialogTitle className="text-xl font-bold text-primary mb-1"> إدارة صور المريض: <span className="text-primary/90">{patient.name}</span>
                </DialogTitle>
                 <DialogDescription className="text-sm text-muted-foreground mt-0">  عرض، إضافة، أو حذف صور السجلات الطبية للمريض.
                 </DialogDescription>
                    </DialogHeader>


            <div className="p-6 pt-0 space-y-4 max-h-[70vh] overflow-y-auto">
              
              <ImageUploadArea 
                    fileInputRef={fileInputRef} 
                    isUploading={isUploading} 
                    handleFileChange={handleUploadFiles}
                />

              <div className="space-y-3">
                <Label className="text-lg font-semibold block border-b pb-2">الصور الحالية ({currentImageUrls.length})</Label>
                {currentImageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {currentImageUrls.map(url => {
                        const isImageDeleting = isDeleting[url];
                        const displayUrl =
                          url.startsWith('data:') || url.startsWith('blob:')
                            ? url
                            : signedUrlMap[url];
                        return (
                            // Image Card Wrapper
                            <div key={url} className="relative group aspect-square">
                                <div 
                                    className={`relative w-full h-full cursor-pointer rounded-md border overflow-hidden transition-all duration-300 ${isImageDeleting ? 'pointer-events-none' : 'hover:ring-2 hover:ring-primary/50'}`}
                                    onClick={() => { if (!isImageDeleting) setImageToPreview(url); }} 
                                >
                                    {displayUrl ? (
                                        <Image
                                            src={displayUrl}
                                            alt={`صورة مريض ${patient.name}`}
                                            fill 
                                            className={`rounded-md bg-muted object-cover transition-opacity duration-300 ${isImageDeleting ? 'opacity-30 blur-sm' : 'opacity-100'}`}
                                        />
                                    ) : (
                                        <Skeleton className="h-full w-full rounded-md" />
                                    )}
                                    {/* Maximize Icon Overlay for visual cue */}
                                    <div className='absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity'>
                                        <Maximize className='h-8 w-8 text-white drop-shadow-lg'/>
                                    </div>
                                </div>

                                {/* Deleting Overlay (Better UX) */}
                                {isImageDeleting && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                                        <Loader2 className="h-6 w-6 animate-spin text-destructive" />
                                    </div>
                                )}

                                {/* Delete Button with Confirmation */}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 left-2 h-8 w-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity" 
                                            disabled={isImageDeleting || isUploading}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent dir="rtl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="flex items-center text-destructive">
                                                <AlertTriangle className="h-6 w-6 me-2" /> تأكيد الحذف
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                هل انت متأكد من حذف الصورة.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isImageDeleting}>إلغاء</AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={() => handleDeleteImage(url)} 
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={isImageDeleting}
                                            >
                                                {isImageDeleting ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : null}
                                                {isImageDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-secondary/20 rounded-md">
                    <X className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">لا توجد صور حالية. ابدأ الرفع الآن.</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-6 pt-1 border-t">
              <Button variant="outline" onClick={closeDialog} disabled={isUploading || isAnyDeleting}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Preview Dialog */}
        <ImagePreviewDialog 
            isOpen={Boolean(imageToPreview)}
            imageUrl={previewDisplayUrl} 
            onClose={() => setImageToPreview(null)} 
            patientName={patient.name}
        />
    </>
  );
}
