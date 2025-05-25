
"use client";

import type { Appointment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, CalendarDays, Clock, StickyNote, Edit3, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface AppointmentCardProps {
  appointment: Appointment;
  onEdit: (appointment: Appointment) => void;
  onDelete: (appointmentId: string) => void;
}

export function AppointmentCard({ appointment, onEdit, onDelete }: AppointmentCardProps) {
  const appointmentDate = parse(appointment.date, 'yyyy-MM-dd', new Date());
  const formattedDate = format(appointmentDate, "EEEE, d MMMM yyyy", { locale: arSA });

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg text-primary flex items-center gap-2">
            <User className="h-5 w-5" />
            {appointment.patientName}
          </CardTitle>
          <div className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">{appointment.time}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-accent" />
          <span>{formattedDate}</span>
        </div>
        {appointment.notes && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground pt-1">
            <StickyNote className="h-4 w-4 text-accent mt-1 flex-shrink-0" />
            <p className="break-words">{appointment.notes}</p>
          </div>
        )}
         <div className="flex items-center gap-2 text-xs text-muted-foreground/80 pt-2">
            <Clock className="h-3 w-3" />
            <span>تاريخ الإنشاء: {format(new Date(appointment.createdAt), "dd/MM/yyyy HH:mm", { locale: arSA })}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 flex justify-end gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => onEdit(appointment)}>
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
                هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف بيانات الموعد بشكل دائم.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(appointment.id)} className="bg-destructive hover:bg-destructive/90">
                نعم، قم بالحذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
