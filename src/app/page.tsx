"use client";

import * as React from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Calendar as CalendarIcon, Users, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DailyAppointments } from '@/components/dashboard/DailyAppointments';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import type { Appointment } from '@/lib/types';
import { getAppointmentsByDate, getDashboardStats } from '@/lib/api';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => new Date());
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [stats, setStats] = React.useState({
    totalPatients: 0,
    monthlyAppointmentsCount: 0,
    upcomingTodayCount: 0,
    totalTodayCount: 0,
  });

  const dateAppointmentsCacheRef = React.useRef<Map<string, Appointment[]>>(new Map());
  const initialTodayStringRef = React.useRef<string>(format(new Date(), 'yyyy-MM-dd'));

  React.useEffect(() => {
    let isMounted = true;
    const now = new Date();
    const todayString = format(now, 'yyyy-MM-dd');
    initialTodayStringRef.current = todayString;

    setStatsLoading(true);
    setIsLoading(true);

    getDashboardStats(now)
      .then((result) => {
        if (!isMounted) return;
        setStats({
          totalPatients: result.totalPatients,
          monthlyAppointmentsCount: result.monthlyAppointmentsCount,
          upcomingTodayCount: result.upcomingTodayCount,
          totalTodayCount: result.totalTodayCount,
        });
        dateAppointmentsCacheRef.current.set(todayString, result.todayAppointments);
        setAppointments(result.todayAppointments);
      })
      .catch((error) => {
        console.error("Failed to fetch dashboard stats:", error);
      })
      .finally(() => {
        if (isMounted) {
          setStatsLoading(false);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!selectedDate) return;
    const dateString = format(selectedDate, 'yyyy-MM-dd');

    const cached = dateAppointmentsCacheRef.current.get(dateString);
    if (cached) {
      setAppointments(cached);
      setIsLoading(false);
      return;
    }

    // Initial today fetch is already handled by getDashboardStats
    if (dateString === initialTodayStringRef.current && statsLoading) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getAppointmentsByDate(dateString)
      .then((data) => {
        if (!isMounted) return;
        dateAppointmentsCacheRef.current.set(dateString, data);
        setAppointments(data);
      })
      .catch((error) => {
        console.error("Failed to fetch appointments for dashboard:", error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, statsLoading]);

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    setCalendarOpen(false);
  }, []);

  const selectedDateLabel = React.useMemo(
    () => (selectedDate ? format(selectedDate, "PPP", { locale: arSA }) : null),
    [selectedDate]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-primary">لوحة التحكم</h1>
        <div className="flex gap-2">
          <Button asChild variant="default" size="lg">
            <Link href="/patients">
              <Users className="ms-2 h-5 w-5" />
              إدارة المرضى
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/appointments">
              <CalendarPlus className="ms-2 h-5 w-5" />
              إدارة المواعيد
            </Link>
          </Button>
        </div>
      </div>

      <DashboardStats
        totalPatients={stats.totalPatients}
        monthlyAppointmentsCount={stats.monthlyAppointmentsCount}
        upcomingTodayCount={stats.upcomingTodayCount}
        totalTodayCount={stats.totalTodayCount}
        isLoading={statsLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">التقويم التفاعلي</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="w-full justify-start text-left font-normal text-lg py-3 h-auto mb-4"
                >
                  <CalendarIcon className="ms-2 h-5 w-5" />
                  {selectedDateLabel ? selectedDateLabel : <span>اختر تاريخاً</span>}
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
                  className="rounded-md border"
                />
              </PopoverContent>
            </Popover>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border p-0 hidden lg:block"
              locale={arSA}
              dir="rtl"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {isLoading ? (
            <Card className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
                ))}
              </CardContent>
            </Card>
          ) : (
            selectedDate && <DailyAppointments appointments={appointments} selectedDate={selectedDate} />
          )}
        </div>
      </div>
    </div>
  );
}
