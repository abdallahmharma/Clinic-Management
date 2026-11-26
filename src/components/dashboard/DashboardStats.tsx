"use client";

import * as React from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Users, CalendarDays, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStatsProps {
  totalPatients: number;
  monthlyAppointmentsCount: number;
  upcomingTodayCount: number;
  totalTodayCount: number;
  isLoading: boolean;
}

export function DashboardStats({
  totalPatients,
  monthlyAppointmentsCount,
  upcomingTodayCount,
  totalTodayCount,
  isLoading,
}: DashboardStatsProps) {
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: arSA });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((item) => (
          <Card key={item} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'عدد المرضى المسجلين',
      value: totalPatients,
      subtitle: 'إجمالي الملفات المسجلة في العيادة',
      icon: Users,
    },
    {
      title: 'إجمالي المواعيد لهذا الشهر',
      value: monthlyAppointmentsCount,
      subtitle: `مواعيد شهر ${currentMonthLabel}`,
      icon: CalendarDays,
    },
    {
      title: 'المواعيد القادمة اليوم',
      value: upcomingTodayCount,
      subtitle:
        totalTodayCount > 0
          ? `من أصل ${totalTodayCount} مواعيد مجدولة اليوم`
          : 'لا توجد مواعيد مجدولة لليوم',
      icon: CalendarClock,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
