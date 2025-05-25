
"use client";

import Image from 'next/image';
import type { Patient } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AtSign, Phone, User, Edit3, Trash2, Calendar } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';


interface PatientCardProps {
  patient: Patient;
  onEdit: (patient: Patient) => void;
  onDelete: (patientId: string) => void;
}

export function PatientCard({ patient, onEdit, onDelete }: PatientCardProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      <CardHeader className="p-0">
        <div className="relative h-40 w-full bg-muted">
          <Image
            src={patient.imageUrl || 'https://placehold.co/600x400.png'}
            alt={patient.name}
            layout="fill"
            objectFit="cover"
            data-ai-hint="person portrait"
            className={!patient.imageUrl ? 'opacity-50' : ''}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        <CardTitle className="text-lg text-primary">{patient.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>العمر: {patient.age} سنة</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span dir="ltr">{patient.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4" />
            <span dir="ltr">{patient.email}</span>
          </div>
           <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            <span>تاريخ التسجيل: {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: arSA })}</span>
          </div>
        </CardDescription>
      </CardContent>
      <CardFooter className="p-4 flex justify-end gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => onEdit(patient)}>
          <Edit3 className="ms-1 h-4 w-4" />
          تعديل
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="ms-1 h-4 w-4" />
              حذف
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
              <AlertDialogDescription>
                هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات المريض بشكل دائم وجميع مواعيده المرتبطة به.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(patient.id)} className="bg-destructive hover:bg-destructive/90">
                نعم، قم بالحذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
