
"use client";

import type { Appointment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, User, StickyNote, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface DailyAppointmentsProps {
  appointments: Appointment[];
  selectedDate: Date;
}

export function DailyAppointments({ appointments, selectedDate }: DailyAppointmentsProps) {
  const formattedDate = format(selectedDate, "EEEE, d MMMM yyyy", { locale: arSA });

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">مواعيد يوم {formattedDate}</CardTitle>
        {appointments.length === 0 && <CardDescription>لا توجد مواعيد لهذا اليوم.</CardDescription>}
      </CardHeader>
      <CardContent>
        {appointments.length > 0 && (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <Card key={appointment.id} className="bg-background/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-md text-primary">{appointment.patientName}</h3>
                      <Badge variant="outline" className="text-sm">{appointment.time}</Badge>
                    </div>
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2 font-medium">
                        <Stethoscope className="h-4 w-4 text-accent" />
                        {appointment.type}
                      </p>
                      {appointment.notes && (
                        <p className="flex items-start gap-2">
                          <StickyNote className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                          <span>{appointment.notes}</span>
                        </p>
                      )}
                       <p className="flex items-center gap-2 pt-1 text-xs">
                          <CalendarClock className="h-3 w-3 text-accent" />
                          <span>تاريخ الإنشاء: {format(new Date(appointment.createdAt), "dd/MM/yyyy HH:mm", { locale: arSA })}</span>
                        </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
