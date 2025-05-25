
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, PatientSelectItem } from '@/lib/types';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const appointmentSchema = z.object({
  patientId: z.string().min(1, { message: "يجب اختيار مريض" }),
  date: z.date({ required_error: "يجب اختيار تاريخ الموعد" }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "يجب أن يكون الوقت صالحًا (HH:MM)" }),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormProps {
  appointment?: Appointment | null; // For editing
  patients: PatientSelectItem[];
  onSuccess: (appointment: Appointment) => void;
  setOpen: (open: boolean) => void;
}

export function AppointmentForm({ appointment, patients, onSuccess, setOpen }: AppointmentFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    appointment ? parse(appointment.date, 'yyyy-MM-dd', new Date()) : new Date()
  );
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: appointment?.patientId || '',
      date: appointment ? parse(appointment.date, 'yyyy-MM-dd', new Date()) : new Date(),
      time: appointment?.time || '09:00',
      notes: appointment?.notes || '',
    },
  });

  React.useEffect(() => {
    if (selectedDate) {
      setValue("date", selectedDate, { shouldValidate: true });
    }
  }, [selectedDate, setValue]);
  
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) setValue("date", date, { shouldValidate: true });
    setCalendarOpen(false);
  }

  const onSubmit = async (data: AppointmentFormData) => {
    setIsSubmitting(true);
    const formattedData = {
      ...data,
      date: format(data.date, 'yyyy-MM-dd'), // Ensure date is string for API
    };

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      let result: Appointment;
      const patientName = patients.find(p => p.value === data.patientId)?.label || 'اسم غير معروف';

      if (appointment) { // Editing
        result = { ...appointment, ...formattedData, patientName };
        // In real app: await updateAppointment(appointment.id, formattedData);
        toast({ title: "نجاح", description: "تم تعديل الموعد بنجاح." });
      } else { // Adding
        result = { id: String(Date.now()), createdAt: new Date().toISOString(), ...formattedData, patientName };
        // In real app: await addAppointment(formattedData);
        toast({ title: "نجاح", description: "تمت إضافة الموعد بنجاح." });
      }
      onSuccess(result);
      setOpen(false);
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ الموعد.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
      <DialogHeader>
        <DialogTitle>{appointment ? 'تعديل الموعد' : 'إضافة موعد جديد'}</DialogTitle>
        <DialogDescription>
          {appointment ? 'قم بتحديث معلومات الموعد أدناه.' : 'أدخل معلومات الموعد الجديد أدناه.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="patientId">المريض</Label>
          <Controller
            name="patientId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} dir="rtl">
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="اختر مريضًا" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.patientId && <p className="text-sm text-destructive mt-1">{errors.patientId.message}</p>}
        </div>

        <div>
          <Label htmlFor="date">التاريخ</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal mt-1", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="ms-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: arSA }) : <span>اختر تاريخًا</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                locale={arSA}
                dir="rtl"
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
        </div>
        
        <div>
          <Label htmlFor="time">الوقت</Label>
          <Input id="time" type="time" {...register("time")} className="mt-1" dir="ltr"/>
          {errors.time && <p className="text-sm text-destructive mt-1">{errors.time.message}</p>}
        </div>

        <div>
          <Label htmlFor="notes">ملاحظات (اختياري)</Label>
          <Textarea id="notes" {...register("notes")} className="mt-1"/>
          {errors.notes && <p className="text-sm text-destructive mt-1">{errors.notes.message}</p>}
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={isSubmitting || patients.length === 0}>
          {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {appointment ? 'حفظ التعديلات' : 'إضافة موعد'}
        </Button>
      </DialogFooter>
      {patients.length === 0 && <p className="text-sm text-destructive text-center pt-2">يجب إضافة مرضى أولاً لتتمكن من إضافة موعد.</p>}
    </form>
  );
}
