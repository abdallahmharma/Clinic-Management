
"use client";

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Patient } from '@/lib/types';
import { addAppointment, updateAppointment } from '@/lib/api';
import { format, parse } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { CalendarIcon, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const appointmentSchema = z.object({
  patientId: z.string().min(1, { message: "يجب اختيار مريض" }),
  date: z.date({ required_error: "يجب اختيار تاريخ الموعد" }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "يجب أن يكون الوقت صالحًا (HH:MM)" }),
  type: z.string().min(1, { message: "يجب اختيار نوع الموعد" }),
  notes: z.string().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

const appointmentTypes = [
  "كشف جديد",
  "متابعة",
  "استشارة",
  "إجراء طبي",
  "غير ذلك",
];

interface AppointmentFormProps {
  appointment?: Appointment | null;
  patients: Patient[];
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
  const [patientComboboxOpen, setPatientComboboxOpen] = React.useState(false);

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: appointment?.patientId || '',
      date: appointment ? parse(appointment.date, 'yyyy-MM-dd', new Date()) : new Date(),
      time: appointment?.time || '09:00',
      type: appointment?.type || '',
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
    const appointmentInputData = {
      patientId: data.patientId,
      date: format(data.date, 'yyyy-MM-dd'),
      time: data.time,
      type: data.type,
      notes: data.notes || undefined,
    };

    try {
      let result: Appointment;
      if (appointment && appointment.id) {
        const updatedAppointment = await updateAppointment(appointment.id, appointmentInputData);
        if (!updatedAppointment) throw new Error("Failed to update appointment");
        result = updatedAppointment;
        toast({ title: "نجاح", description: "تم تعديل الموعد بنجاح." });
      } else {
        result = await addAppointment(appointmentInputData);
        toast({ title: "نجاح", description: "تمت إضافة الموعد بنجاح." });
      }
      onSuccess(result);
      setOpen(false);
    } catch (error) {
      console.error("Error submitting appointment form:", error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ الموعد.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const patientSelectItems = patients.map(p => ({
    value: p.id,
    label: p.name,
    phone: p.phone
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
      <DialogHeader>
        <DialogTitle>{appointment ? 'تعديل الموعد' : 'إضافة موعد جديد'}</DialogTitle>
        <DialogDescription>
          {appointment ? 'قم بتحديث معلومات الموعد أدناه.' : 'أدخل معلومات الموعد الجديد أدناه.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 px-6 py-2 max-h-[70vh] overflow-y-auto">
        <div>
          <Label htmlFor="patientId">المريض</Label>
          <Controller
            name="patientId"
            control={control}
            render={({ field }) => (
              <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientComboboxOpen}
                    className="w-full justify-between mt-1"
                    disabled={patients.length === 0}
                  >
                    {field.value
                      ? patientSelectItems.find((p) => p.value === field.value)?.label
                      : "اختر مريضًا..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command
                    filter={(value, search) => {
                      const patient = patientSelectItems.find(p => p.value.toLowerCase() === value.toLowerCase());
                      if (patient) {
                        const nameMatch = patient.label.toLowerCase().includes(search.toLowerCase());
                        const phoneMatch = patient.phone.includes(search);
                        if (nameMatch || phoneMatch) return 1;
                      } else if (value.toLowerCase().includes(search.toLowerCase())) { 
                        return 1;
                      }
                      return 0;
                    }}
                  >
                    <CommandInput placeholder="ابحث عن مريض بالاسم أو رقم الهاتف..." />
                    <CommandList>
                      <CommandEmpty>لم يتم العثور على مريض.</CommandEmpty>
                      <CommandGroup>
                        {patientSelectItems.map((p) => (
                          <CommandItem
                            key={p.value}
                            value={p.value}
                            onSelect={(currentValue) => {
                              setValue("patientId", currentValue === field.value ? "" : currentValue, { shouldValidate: true });
                              setPatientComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === p.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {p.label} <span className="text-xs text-muted-foreground ms-2">({p.phone})</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.patientId && <p className="text-sm text-destructive mt-1">{errors.patientId.message}</p>}
        </div>

        <div>
          <Label htmlFor="type">نوع الموعد</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="اختر نوع الموعد..." />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
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

      <DialogFooter className="pt-4 px-6 pb-6 border-t">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={isSubmitting || patients.length === 0}>
          {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {appointment ? 'حفظ التعديلات' : 'إضافة موعد'}
        </Button>
      </DialogFooter>
      {patients.length === 0 && !isSubmitting && <p className="text-sm text-destructive text-center pt-2 px-6">يجب إضافة مرضى أولاً لتتمكن من إضافة موعد.</p>}
    </form>
  );
}
