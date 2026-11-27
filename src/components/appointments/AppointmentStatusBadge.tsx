"use client";

import * as React from 'react';
import { CheckCheck, CheckCircle2, Clock, UserX, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/lib/types';
import {
  APPOINTMENT_STATUS_META,
  normalizeAppointmentStatus,
} from '@/lib/appointment-status';

interface AppointmentStatusBadgeProps {
  status?: AppointmentStatus | string | null;
  className?: string;
}

const STATUS_ICONS: Record<AppointmentStatus, React.ComponentType<{ className?: string }>> = {
  confirmed: CheckCircle2,
  pending: Clock,
  completed: CheckCheck,
  cancelled: XCircle,
  no_show: UserX,
};

export function AppointmentStatusBadge({ status, className }: AppointmentStatusBadgeProps) {
  const normalized = normalizeAppointmentStatus(status);
  const meta = APPOINTMENT_STATUS_META[normalized];
  const Icon = STATUS_ICONS[normalized];

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 font-medium whitespace-nowrap', meta.badgeClassName, className)}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{meta.label}</span>
    </Badge>
  );
}
