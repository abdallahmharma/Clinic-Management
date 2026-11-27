import type { AppointmentStatus } from './types';

export const APPOINTMENT_STATUS_VALUES = [
  'confirmed',
  'pending',
  'completed',
  'cancelled',
  'no_show',
] as const;

export interface AppointmentStatusMeta {
  value: AppointmentStatus;
  label: string;
  badgeClassName: string;
}

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, AppointmentStatusMeta> = {
  confirmed: {
    value: 'confirmed',
    label: 'مؤكد',
    badgeClassName:
      'border-sky-500/35 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-300',
  },
  pending: {
    value: 'pending',
    label: 'قيد الانتظار',
    badgeClassName:
      'border-amber-500/35 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-300',
  },
  completed: {
    value: 'completed',
    label: 'مكتمل',
    badgeClassName:
      'border-emerald-500/35 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  cancelled: {
    value: 'cancelled',
    label: 'ملغي',
    badgeClassName:
      'border-destructive/35 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/20 dark:text-red-300',
  },
  no_show: {
    value: 'no_show',
    label: 'لم يحضر',
    badgeClassName:
      'border-slate-400/40 bg-slate-100 text-slate-700 dark:border-slate-600/50 dark:bg-slate-800/60 dark:text-slate-300',
  },
};

export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatusMeta[] = APPOINTMENT_STATUS_VALUES.map(
  (status) => APPOINTMENT_STATUS_META[status]
);

export function normalizeAppointmentStatus(status?: string | null): AppointmentStatus {
  if (!status) return 'confirmed';
  const normalized = status.trim().toLowerCase();
  if ((APPOINTMENT_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as AppointmentStatus;
  }
  return 'confirmed';
}

export function getAppointmentStatusLabel(status?: string | null): string {
  return APPOINTMENT_STATUS_META[normalizeAppointmentStatus(status)].label;
}

export function isActiveUpcomingStatus(status?: string | null): boolean {
  const normalized = normalizeAppointmentStatus(status);
  return normalized === 'confirmed' || normalized === 'pending';
}
